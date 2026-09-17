"""
TON Blockchain dan REAL wallet balansini olish servisi.

Manbalar (ketma-ket):
1) TonAPI.io  -> https://tonapi.io/v2  (bepul, kalitsiz)
2) TON Center -> https://toncenter.com/api/v2 (api_key ixtiyoriy)

Bu servis TON mainnet bo'ylab real balansni qaytaradi:
  - GRAM (g'arbda "TON") native balans
  - USDT (Jetton) balans
Qaytgan qiymatlar DB'da cache shaklida saqlanadi.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Mavjud USDT Jettoni mainnet (tether.ton): EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs
# Ixtiyoriy - TonAPI uni avtomatik aniqlaydi.
USDT_JETTON_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"

TON_DECIMALS = 9  # 1 TON = 1e9 nanoTON


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TONBalanceService:
    """TON blockchain'dan haqiqiy balansni olish."""

    def __init__(self):
        self.tonapi_url = "https://tonapi.io/v2"
        self.toncenter_url = "https://toncenter.com/api/v2"
        self.ton_api_key = getattr(settings, "TON_API_KEY", None)
        if self.ton_api_key and self.ton_api_key.startswith("your-"):
            self.ton_api_key = None
        self.timeout = 10.0

    # TonAPI account`dan aniqlanadigan wallet turlari (ustuvorlik tartibida).
    WALLET_TYPE_RULES = [
        ("wallet_v5r2", "v5R2"),
        ("wallet_v5r1", "v5R1"),
        ("wallet_v4r2", "v4R2"),
        ("wallet_v4r1", "v4R1"),
        ("wallet_v3r2", "v3R2"),
        ("wallet_v3r1", "v3R1"),
        ("wallet_highload", "Highload"),
        ("wallet_w5", "W5"),
        ("wallet_oeb", "OEB"),
    ]

    # ---------- TonAPI.io (asosiy) ----------

    async def _tonapi_account(self, client: httpx.AsyncClient, address: str) -> Dict:
        """TonAPI.v2 dan account ma'lumotlarini olish (balance + interfaces + methods)."""
        url = f"{self.tonapi_url}/accounts/{address}"
        res = await client.get(url)
        res.raise_for_status()
        return res.json()

    async def _tonapi_balance(self, client: httpx.AsyncClient, address: str) -> Optional[float]:
        """TonAPI.v2 dan native TON balansini olish (nanoTON -> TON)."""
        data = await self._tonapi_account(client, address)
        nano = data.get("balance", 0)
        return round(int(nano) / 10**TON_DECIMALS, 9)

    @staticmethod
    def _detect_wallet_type(data: Dict) -> str:
        """Account ma'lumotlaridan wallet turini aniqlaydi (v4R2, v3R2, v5R1, W5, OEB ...).

        TonAPI `/accounts/{address}` javobidagi `interfaces`, `get_methods` va
        `methods` ro'yxatlaridan kontrakt turini topadi. Aniqlanmasa "Unknown".
        """
        candidates: list = []
        for key in ("interfaces", "get_methods", "methods"):
            for item in data.get(key) or []:
                s = str(item).lower().strip()
                if "wallet" in s or s in ("w5", "oeb", "highload"):
                    candidates.append(s)

        for cand in candidates:
            for fragment, label in TONBalanceService.WALLET_TYPE_RULES:
                if fragment in cand:
                    return label

        # Umumiy fallback: "wallet_v3r2" -> "v3R2"
        for cand in candidates:
            if cand.startswith("wallet"):
                name = cand.replace("wallet_", "").replace("_", "")
                if name.startswith("v") and len(name) >= 3:
                    return f"{name[:2]}{name[2:].upper()}"
                return name.upper()
        return "Unknown"

    async def _tonapi_jettons(self, client: httpx.AsyncClient, address: str) -> list:
        """TonAPI.v2 dan foydalanuvchi egalik qilayotgan jetonlarni olish."""
        url = f"{self.tonapi_url}/accounts/{address}/jettons"
        res = await client.get(url)
        res.raise_for_status()
        data = res.json()
        return data.get("balances", [])

    # ---------- TON Center (zaxira) ----------

    async def _toncenter_balance(self, client: httpx.AsyncClient, address: str) -> Optional[float]:
        """TON Center getAddressBalance (nanoTON -> TON)."""
        params = {"address": address}
        if self.ton_api_key:
            params["api_key"] = self.ton_api_key
        res = await client.get(f"{self.toncenter_url}/getAddressBalance", params=params)
        res.raise_for_status()
        data = res.json()
        if not data.get("ok"):
            return None
        nano = int(data.get("result", 0))
        return round(nano / 10**TON_DECIMALS, 9)

    async def _toncenter_jettons(self, client: httpx.AsyncClient, address: str) -> list:
        """TON Center getWalletInfo / Jetton manzilidan balans."""
        params = {"address": address}
        if self.ton_api_key:
            params["api_key"] = self.ton_api_key
        res = await client.get(f"{self.toncenter_url}/getWalletInfo", params=params)
        res.raise_for_status()
        data = res.json()
        if not data.get("ok"):
            return []
        return data.get("result", [])

    # ---------- Umumiy ----------

    async def get_wallet_type(self, address: str) -> str:
        """TonAPI orqali wallet turini aniqlash (v4R2, v3R2, v5R1, W5, OEB ...)."""
        if not address or len(address) < 40:
            return "Unknown"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                data = await self._tonapi_account(client, address)
                return self._detect_wallet_type(data)
        except Exception as exc:
            logger.warning("get_wallet_type error: %s", exc)
            return "Unknown"

    async def get_wallet_balance(self, address: str) -> Dict:
        """
        Wallet balansini REAL TON blockchain'dan olish.

        Returns:
            {
                "ton_balance": 10.5,
                "usdt_balance": 0.0,
                "stars_balance": 0,
                "wallet_address": "...",
                "source": "tonapi" | "toncenter" | "cache",
                "error": None | str,
                "updated_at": "..."
            }
        """
        if not address or len(address) < 40:
            return {
                "ton_balance": 0.0,
                "usdt_balance": 0.0,
                "stars_balance": 0,
                "wallet_address": address,
                "source": "demo" if address else "none",
                "error": None if address else "Wallet address missing",
                "updated_at": _now_iso(),
            }

        ton_balance: Optional[float] = None
        usdt_balance: float = 0.0
        wallet_type = "Unknown"
        jettons_src = "tonapi"
        error_msg: Optional[str] = None

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # 1) TonAPI.io
                try:
                    account_data = await self._tonapi_account(client, address)
                    ton_balance = round(
                        int(account_data.get("balance", 0)) / 10**TON_DECIMALS, 9
                    )
                    wallet_type = self._detect_wallet_type(account_data)
                    try:
                        balances = await self._tonapi_jettons(client, address)
                        for item in balances:
                            jetton = item.get("jetton", {})
                            symbol = (jetton.get("symbol") or "").upper()
                            if symbol in ("USDT", "USD₮"):
                                decimals = int(jetton.get("decimals", 9))
                                raw = int(item.get("balance", 0))
                                usdt_balance = round(raw / 10**decimals, 6)
                                break
                    except Exception as exc:  # pragma: no cover
                        logger.warning("TonAPI jettons error: %s", exc)
                except Exception as exc:
                    logger.warning("TonAPI balance error: %s", exc)
                    jettons_src = "toncenter"

                # 2) Zaxira sifatida TON Center
                if ton_balance is None:
                    try:
                        ton_balance = await self._toncenter_balance(client, address)
                        if ton_balance is not None:
                            jettons_src = "toncenter"
                    except Exception as exc:  # pragma: no cover
                        logger.warning("TON Center balance error: %s", exc)
        except Exception as exc:
            error_msg = str(exc)
            logger.error("get_wallet_balance error: %s", exc)

        source = "tonapi" if jettons_src == "tonapi" and ton_balance is not None else (
            "toncenter" if ton_balance is not None else "none"
        )
        if ton_balance is None:
            ton_balance = 0.0
            if not error_msg:
                error_msg = "Balance not available (check wallet or network)"

        return {
            "ton_balance": ton_balance,
            "usdt_balance": usdt_balance,
            "stars_balance": 0,  # Telegram Stars - alohida servis (ton_stars) orqali
            "wallet_address": address,
            "wallet_type": wallet_type,
            "source": source,
            "error": error_msg,
            "updated_at": _now_iso(),
        }


ton_balance = TONBalanceService()