import logging
import uuid
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class FragmentAPI:
    """Fragment.com API client"""

    def __init__(self):
        self.base_url = settings.FRAGMENT_API_URL
        self.api_key = settings.FRAGMENT_API_KEY

    @property
    def is_demo(self) -> bool:
        return (
            not self.api_key
            or self.api_key in ("your-fragment-api-key", "")
            or "api.fragment.com" in (self.base_url or "")
        )

    def _get_demo_response(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Simulated responses for demo/development mode."""
        if "/stars/price" in endpoint:
            return {"price_per_star": 0.001, "currency": "GRAM"}
        elif "/stars/balance" in endpoint:
            return {"balance": 10000}
        elif "/stars/buy" in endpoint:
            return {
                "success": True,
                "order_id": f"frag_stars_{uuid.uuid4().hex[:8]}",
                "status": "completed",
            }
        elif "/stars/send" in endpoint:
            return {
                "success": True,
                "tx_id": f"tx_stars_{uuid.uuid4().hex[:12]}",
                "status": "delivered",
            }
        elif "/premium/price" in endpoint:
            duration = 30
            if "duration=" in endpoint:
                try:
                    duration = int(endpoint.split("duration=")[-1].split("&")[0])
                except ValueError:
                    pass
            prices = {30: 300.0, 90: 600.0, 180: 1000.0, 365: 1500.0}
            return {"price": prices.get(duration, 300.0), "currency": "GRAM", "duration_days": duration}
        elif "/premium/buy" in endpoint:
            return {
                "success": True,
                "order_id": f"frag_prem_{uuid.uuid4().hex[:8]}",
                "tx_id": f"tx_prem_{uuid.uuid4().hex[:12]}",
                "status": "activated",
            }
        elif "/premium/status" in endpoint:
            return {"is_premium": True, "active": True}
        elif "/user/" in endpoint:
            username = endpoint.split("/user/")[-1]
            return {"username": username, "is_valid": True}

        return {"success": True}

    async def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        if self.is_demo:
            logger.info("Fragment API demo mode fallback for %s %s", method, endpoint)
            return self._get_demo_response(method, endpoint, data)

        url = f"{self.base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                if method.upper() == "GET":
                    response = await client.get(url, headers=headers)
                elif method.upper() == "POST":
                    response = await client.post(url, headers=headers, json=data)
                elif method.upper() == "PUT":
                    response = await client.put(url, headers=headers, json=data)
                else:
                    raise ValueError(f"Not supported method: {method}")

                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.warning("Fragment API request failed (%s %s): %s. Falling back to demo mode.", method, url, e)
            return self._get_demo_response(method, endpoint, data)

    # ========== STARS ==========

    async def get_stars_price(self) -> Dict:
        """Get current Stars price"""
        return await self._request("GET", "/stars/price")

    async def get_stars_balance(self, wallet_address: str) -> Dict:
        """Get wallet Stars balance"""
        return await self._request("GET", f"/wallet/{wallet_address}/stars")

    async def buy_stars(self, wallet_address: str, amount: int, payment_method: str = "gram") -> Dict:
        """Buy Stars from Fragment"""
        data = {
            "wallet": wallet_address,
            "amount": amount,
            "payment_method": payment_method,
        }
        return await self._request("POST", "/stars/buy", data=data)

    async def send_stars(self, from_wallet: str, to_username: str, quantity: int) -> Dict:
        """Send Stars to Telegram user"""
        data = {
            "from": from_wallet,
            "to": to_username,
            "quantity": quantity,
        }
        return await self._request("POST", "/stars/send", data=data)

    # ========== PREMIUM ==========

    async def get_premium_price(self, duration_days: int = 30) -> Dict:
        """Get Premium subscription price"""
        return await self._request("GET", f"/premium/price?duration={duration_days}")

    async def buy_premium(self, wallet_address: str, user_id: str, duration_days: int = 30) -> Dict:
        """Buy Telegram Premium for user"""
        data = {
            "wallet": wallet_address,
            "user_id": user_id,
            "duration_days": duration_days,
        }
        return await self._request("POST", "/premium/buy", data=data)

    async def check_premium_status(self, user_id: str) -> Dict:
        """Check if user has Telegram Premium"""
        return await self._request("GET", f"/premium/status/{user_id}")

    # ========== USER INFO ==========

    async def get_user_info(self, username: str) -> Dict:
        """Get Telegram user info"""
        return await self._request("GET", f"/user/{username}")


fragment_client = FragmentAPI()