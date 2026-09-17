"""
fragment-stars-api (bbbuilt/fragment-stars-api) integratsiyasi.

https://api-fragment.duckdns.org — no-KYC rejimida TON va USDT (usdt_ton)
to'lovlarini qo'llab-quvvatlaydigan Fragment.com aggregatori.

No-KYC USDT ishlash tartibi:
  - Stars asosiy narxi USDT da to'lanadi,
  - API komissiyasi (~0.25%) TON da to'lanadi.
Hamyonda kamida 1 TON (gaz + komissiya) bo'lishi talab qilinadi.

Flow:
  1) POST /api/v1/stars/buy   -> request_id
  2) GET  /api/v1/queue/{request_id} -> completed | failed
"""

import base64
import logging
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class FragmentStarsAPIService:
    """fragment-stars-api (api-fragment.duckdns.org) client."""

    BASE_URL = "https://api-fragment.duckdns.org"

    def __init__(self):
        self.base_url = settings.FRAGMENT_STARS_API_URL or self.BASE_URL
        self._timeout = 90.0

    def enabled(self) -> bool:
        return getattr(settings, "FRAGMENT_STARS_API_ENABLED", False)

    @staticmethod
    def _base64_seed(seed: str) -> str:
        return base64.b64encode(seed.strip().encode("utf-8")).decode("utf-8")

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        with httpx.Client(timeout=self._timeout) as client:
            resp = client.post(f"{self.base_url}{path}", json=payload)
            try:
                data = resp.json()
            except Exception:
                raise RuntimeError(
                    f"fragment-stars-api {path} javobini o'qib bo'lmadi (HTTP {resp.status_code})"
                )
        if not data.get("success"):
            err = data.get("error") or {}
            message = err.get("message") if isinstance(err, dict) else data.get("message")
            code = err.get("error_code") if isinstance(err, dict) else data.get("error_code")
            raise RuntimeError(message or code or f"fragment-stars-api {path} failed")
        return data

    def buy_stars(
        self,
        username: str,
        amount: int,
        seed: str,
        payment_method: str = "ton",
    ) -> Dict[str, Any]:
        """Stars sotib olish (no-KYC). payment_method: 'ton' | 'usdt_ton'."""
        clean_user = username.strip()
        if not clean_user.startswith("@"):
            clean_user = f"@{clean_user}"
        payload = {
            "username": clean_user,
            "amount": int(amount),
            "seed": self._base64_seed(seed),
            "payment_method": payment_method,
        }
        result = self._post("/api/v1/stars/buy", payload)
        data = result.get("data") or {}
        return {
            "success": True,
            "request_id": data.get("request_id") or "",
            "data": data,
        }

    def buy_premium(
        self,
        username: str,
        duration_months: int,
        seed: str,
        payment_method: str = "ton",
    ) -> Dict[str, Any]:
        """Telegram Premium sotib olish (no-KYC)."""
        clean_user = username.strip()
        if not clean_user.startswith("@"):
            clean_user = f"@{clean_user}"
        payload = {
            "username": clean_user,
            "duration": int(duration_months),
            "seed": self._base64_seed(seed),
            "payment_method": payment_method,
        }
        result = self._post("/api/v1/premium/buy", payload)
        data = result.get("data") or {}
        return {
            "success": True,
            "request_id": data.get("request_id") or "",
            "data": data,
        }

    def check_request(self, request_id: str) -> Dict[str, Any]:
        """Buyurtma holatini tekshirish: completed | failed."""
        with httpx.Client(timeout=self._timeout) as client:
            resp = client.get(f"{self.base_url}/api/v1/queue/{request_id}")
            try:
                data = resp.json()
            except Exception:
                raise RuntimeError(
                    f"fragment-stars-api queue javobini o'qib bo'lmadi (HTTP {resp.status_code})"
                )
        return data

    async def wait_completion(self, request_id: str, timeout: float = 180.0) -> Dict[str, Any]:
        """Buyurtma yakunlanguncha kutadi (polling).

        Completed/success -> holat qaytaradi, failed -> RuntimeError.
        """
        import asyncio

        elapsed = 0.0
        interval = 3.0
        while elapsed < timeout:
            data = self.check_request(request_id)
            inner = (data.get("data") or {})
            status = inner.get("status") or data.get("status") or ""
            if status in ("completed", "success"):
                logger.info("fragment-stars-api request %s completed", request_id)
                return data
            if status in ("failed", "error"):
                logger.warning("fragment-stars-api request %s failed: %s", request_id, data)
                return data
            await asyncio.sleep(interval)
            elapsed += interval
        raise RuntimeError(f"fragment-stars-api request {request_id} timeout ({timeout}s)")


fragment_stars_api_service = FragmentStarsAPIService()
