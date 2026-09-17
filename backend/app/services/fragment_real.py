# backend/app/services/fragment_real.py
"""
Fragment.com bilan real bog'lanish va buyurtma bajarish.

Uchta real mexanizm:
1. pyfragment (bohd4nx/pyfragment) - Fragment.com direkt async client:
     purchase_stars / purchase_premium (KYC talab qilmaydi).
     TON_API_KEY + to'liq cookie'lar (stel_ssid, stel_dt, stel_token,
     stel_ton_token) talab qilinadi. PYFRAGMENT_ENABLED=true qilinganda ishlaydi.
2. fragment-api-lib  (tavsiya) - Fragment bilan "gapiruvchi" aggregator SDK:
     buy_stars_without_kyc / buy_premium_without_kyc (KYC talab qilmaydi)
     buy_stars / buy_premium (KYC cookie bilan)
   Bu usulda tranzaksiya SDK ichida TON hamyoni seed-frazasi orqali bajariladi.
3. Direct TON transfer - fragment_real.init_*_payload dan olingan smart-kontrakt
   payload'ini wallet_ton.execute_ton_transfer orqali yuborish.

Qaysi usul ishlatilishi PYFRAGMENT_ENABLED / FRAGMENT_API_LIB_ENABLED
sozlamalariga bog'liq.
"""

import logging
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _api_lib_available() -> bool:
    if not getattr(settings, "FRAGMENT_API_LIB_ENABLED", False):
        return False
    try:
        from fragment_api_lib.client import FragmentAPIClient  # noqa: F401

        return True
    except Exception as exc:
        logger.warning("fragment-api-lib import failed: %s", exc)
        return False


class RealFragmentService:
    """
    Fragment.com bilan real bog'lanish va buyurtma bajarish.
    """

    def __init__(self):
        self.tonapi_url = "https://tonapi.io/v2"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }

    # ---------- Narx ----------

    async def get_stars_rate(self) -> float:
        """Joriy 1 Star narxini GRAM da (rasmiy USD anchor + jonli TON/USD kursi)."""
        from app.services.fragment_prices import fragment_prices

        return await fragment_prices.get_star_price_gram()

    # ---------- fragment-api-lib (asosiy real usul) ----------

    async def buy_stars_via_lib(
        self,
        username: str,
        quantity: int,
        seed: str,
        wallet_type: Optional[str] = None,
        payment_method: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Stars sotib olish.

        USDT (usdt_ton) no-KYC ni fragment-stars-api qo'llab-quvvatlaydi — u birinchi
        o'rinda ishlatiladi. Aks holda V2 API (wallet_type qo'llab-quvvatlaydi) ishlatiladi,
        muvaffaqiyatsiz bo'lsa legacy fragment-api-lib (v1) fallback qilinadi.
        """
        from app.services.fragment_stars_api import fragment_stars_api_service

        method_key = (payment_method or "").upper()
        stars_api_method = "ton" if method_key not in ("USDT", "USDT_TON") else "usdt_ton"

        if fragment_stars_api_service.enabled():
            try:
                result = fragment_stars_api_service.buy_stars(
                    username=username,
                    amount=quantity,
                    seed=seed,
                    payment_method=stars_api_method,
                )
                request_id = result.get("request_id", "")
                logger.info("fragment-stars-api buy_stars ok: request=%s", request_id)
                return {
                    "success": True,
                    "response": result.get("data"),
                    "tx_id": request_id or str(result.get("data") or {}),
                    "source": "fragment-stars-api",
                }
            except Exception as exc:
                if method_key in ("USDT", "USDT_TON"):
                    raise RuntimeError(
                        f"USDT xaridi bajarilmadi: {exc} "
                        "(Hamyonda kamida 1 TON bo'lishi kerak — USDT bilan birga gaz/komissiya TON'da to'lanadi)"
                    )
                logger.warning("fragment-stars-api buy_stars failed (%s), fallback to lib v2", exc)

        from app.services.fragment_v2_service import fragment_v2_service

        v2_wallet = (wallet_type or "v5r1").lower().replace(" ", "").replace("r", "r")
        if v2_wallet.startswith("v5"):
            v2_wallet = "v5r1"
        else:
            v2_wallet = "v4r2"

        v2_method = "ton"
        if method_key in ("USDT", "USDT_TON"):
            v2_method = "usdt_ton"

        try:
            result = fragment_v2_service.buy_stars_without_kyc(
                username=username,
                amount=quantity,
                seed=seed,
                wallet_type=v2_wallet,
                payment_method=v2_method,
            )
            logger.info("fragment v2 buy_stars ok: order=%s hash=%s",
                        result.get("order_id"), result.get("transaction_hash"))
            return {
                "success": True,
                "response": result.get("data"),
                "tx_id": result.get("transaction_hash") or result.get("order_id") or "",
            }
        except Exception as exc:
            if v2_method == "usdt_ton":
                raise RuntimeError(f"USDT to'lovida fragment v2 muvaffaqiyatsiz: {exc}")
            logger.warning("fragment v2 buy_stars failed (%s), fallback to lib v1", exc)

        from app.services.fragment_lib_service import fragment_lib_service

        result = fragment_lib_service.buy_stars(
            username=username,
            amount=quantity,
            seed=seed,
            without_kyc=not bool(getattr(settings, "FRAGMENT_COOKIES", None)),
        )
        if not result.get("success"):
            raise RuntimeError(result.get("error", "fragment-api-lib buy_stars failed"))
        logger.info("fragment-api-lib buy_stars: %s", result.get("data"))
        data = result.get("data") or {}
        return {
            "success": True,
            "response": data,
            "tx_id": str(data.get("transaction_id") or data.get("order_id") or data),
        }

    async def buy_premium_via_lib(
        self,
        username: str,
        duration_months: int,
        seed: str,
        wallet_type: Optional[str] = None,
        payment_method: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Premium sotib olish.

        USDT (usdt_ton) no-KYC ni fragment-stars-api qo'llab-quvvatlaydi — u birinchi
        o'rinda ishlatiladi. Aks holda V2 API (wallet_type qo'llab-quvvatlaydi) ishlatiladi,
        muvaffaqiyatsiz bo'lsa legacy fragment-api-lib (v1) fallback qilinadi.
        """
        from app.services.fragment_stars_api import fragment_stars_api_service

        method_key = (payment_method or "").upper()
        stars_api_method = "ton" if method_key not in ("USDT", "USDT_TON") else "usdt_ton"

        if fragment_stars_api_service.enabled():
            try:
                result = fragment_stars_api_service.buy_premium(
                    username=username,
                    duration_months=duration_months,
                    seed=seed,
                    payment_method=stars_api_method,
                )
                request_id = result.get("request_id", "")
                logger.info("fragment-stars-api buy_premium ok: request=%s", request_id)
                return {
                    "success": True,
                    "response": result.get("data"),
                    "tx_id": request_id or str(result.get("data") or {}),
                    "source": "fragment-stars-api",
                }
            except Exception as exc:
                logger.warning("fragment-stars-api buy_premium failed (%s), fallback to lib v2", exc)

        from app.services.fragment_v2_service import fragment_v2_service

        v2_wallet = (wallet_type or "v5r1").lower().replace(" ", "")
        v2_wallet = "v5r1" if v2_wallet.startswith("v5") else "v4r2"

        v2_method = "ton"
        if method_key in ("USDT", "USDT_TON"):
            v2_method = "usdt_ton"

        try:
            result = fragment_v2_service.buy_premium_without_kyc(
                username=username,
                duration_months=duration_months,
                seed=seed,
                wallet_type=v2_wallet,
                payment_method=v2_method,
            )
            logger.info("fragment v2 buy_premium ok: order=%s hash=%s",
                        result.get("order_id"), result.get("transaction_hash"))
            return {
                "success": True,
                "response": result.get("data"),
                "tx_id": result.get("transaction_hash") or result.get("order_id") or "",
            }
        except Exception as exc:
            if v2_method == "usdt_ton":
                raise RuntimeError(f"USDT to'lovida fragment v2 muvaffaqiyatsiz: {exc}")
            logger.warning("fragment v2 buy_premium failed (%s), fallback to lib v1", exc)

        from app.services.fragment_lib_service import fragment_lib_service

        result = fragment_lib_service.buy_premium(
            username=username,
            duration=duration_months,
            seed=seed,
            without_kyc=not bool(getattr(settings, "FRAGMENT_COOKIES", None)),
        )
        if not result.get("success"):
            raise RuntimeError(result.get("error", "fragment-api-lib buy_premium failed"))
        logger.info("fragment-api-lib buy_premium: %s", result.get("data"))
        data = result.get("data") or {}
        return {
            "success": True,
            "response": data,
            "tx_id": str(data.get("transaction_id") or data.get("order_id") or data),
        }

    async def get_balance_via_lib(self, seed: str) -> Dict[str, Any]:
        """fragment-api-lib orqali TON hamyoni balansini olish."""
        from app.services.fragment_lib_service import fragment_lib_service

        result = fragment_lib_service.get_balance(seed=seed)
        if not result.get("success"):
            return {"success": False, "error": result.get("error", "get_balance failed")}
        return {"success": True, "response": result.get("data")}

    # ---------- pyfragment (Fragment.com direct async client) ----------

    def pyfragment_available(self) -> bool:
        """pyfragment mexanizmi foydalanishga tayyormi."""
        from app.services.fragment_pyfragment import pyfragment_service

        return pyfragment_service.available()

    async def buy_stars_via_pyfragment(
        self,
        username: str,
        quantity: int,
        seed: str,
        payment_method: Optional[str] = None,
    ) -> Dict[str, Any]:
        """pyfragment orqali Stars sotib olish (KYC talab qilmaydi)."""
        from app.services.fragment_pyfragment import pyfragment_service

        result = await pyfragment_service.buy_stars(
            username=username,
            amount=quantity,
            seed=seed,
            payment_method=payment_method,
        )
        if not result.get("success"):
            raise RuntimeError(result.get("error", "pyfragment buy_stars failed"))
        logger.info("pyfragment buy_stars: %s", result.get("response"))
        return {
            "success": True,
            "response": result.get("response"),
            "tx_id": str(result.get("tx_id") or result.get("response") or result),
        }

    async def buy_premium_via_pyfragment(
        self,
        username: str,
        duration_months: int,
        seed: str,
        payment_method: Optional[str] = None,
    ) -> Dict[str, Any]:
        """pyfragment orqali Premium sovg'a qilish (KYC talab qilmaydi)."""
        from app.services.fragment_pyfragment import pyfragment_service

        result = await pyfragment_service.buy_premium(
            username=username,
            months=duration_months,
            seed=seed,
            payment_method=payment_method,
        )
        if not result.get("success"):
            raise RuntimeError(result.get("error", "pyfragment buy_premium failed"))
        logger.info("pyfragment buy_premium: %s", result.get("response"))
        return {
            "success": True,
            "response": result.get("response"),
            "tx_id": str(result.get("tx_id") or result.get("response") or result),
        }

    async def get_balance_via_pyfragment(self, seed: str) -> Dict[str, Any]:
        """pyfragment orqali TON hamyoni balansi va holatini olish."""
        from app.services.fragment_pyfragment import pyfragment_service

        result = await pyfragment_service.get_wallet(seed=seed)
        if not result.get("success"):
            return {"success": False, "error": result.get("error", "get_wallet failed")}
        return {"success": True, "response": result}

    # ---------- Direct TON transfer (payload) ----------

    def _resolve_wallet(self, kind: str) -> str:
        key = "FRAGMENT_STARS_WALLET" if kind == "stars" else "FRAGMENT_PREMIUM_WALLET"
        return getattr(settings, key, "") or ""

    async def init_stars_buy_payload(self, username: str, quantity: int) -> Dict[str, Any]:
        """
        Telegram foydalanuvchisi uchun Stars xarid qilish smart-kontrakt payload'ini shakllantirish
        """
        destination = self._resolve_wallet("stars")
        if not destination:
            raise ValueError("FRAGMENT_STARS_WALLET sozlanmagan! Env faylida ko'rsating.")

        rate = await self.get_stars_rate()
        total_ton = round(rate * quantity, 8)

        return {
            "success": True,
            "recipient": username.replace("@", ""),
            "quantity": quantity,
            "amount_ton": total_ton,
            "amount_usd": round(quantity * getattr(settings, "FRAGMENT_STARS_PRICE_USD", 0.016), 4),
            "destination_address": destination,
            "comment": f"stars:{username}:{quantity}",
            "network": "mainnet",
        }

    async def init_premium_buy_payload(
        self, user_id: str, duration_days: int, username: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Telegram Premium obunasi uchun smart-kontrakt payload'ini shakllantirish
        """
        destination = self._resolve_wallet("premium")
        if not destination:
            raise ValueError("FRAGMENT_PREMIUM_WALLET sozlanmagan! Env faylida ko'rsating.")

        from app.services.fragment_prices import fragment_prices

        amount = await fragment_prices.get_premium_price_for_days(duration_days)

        return {
            "success": True,
            "user_id": user_id,
            "username": username,
            "duration_days": duration_days,
            "amount_ton": amount,
            "destination_address": destination,
            "comment": f"premium:{user_id}:{duration_days}",
            "network": "mainnet",
        }


fragment_service = RealFragmentService()