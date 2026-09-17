# backend/app/services/fragment_pyfragment.py
"""
Fragment.com bilan real bog'lanish - pyfragment kutubxonasi orqali.

pyfragment (bohd4nx/pyfragment) - Fragment.com marketplace API uchun async client.
  Dependencies: curl-cffi (browser impersonation) + tonutils (TON wallet).
  Talab qilinadi:
    - TON_API_KEY (tonconsole.com yoki t.me/toncenter'dan)
    - Fragment cookie'lari: stel_ssid, stel_dt, stel_token, stel_ton_token
    - Xarid qiluvchi TON hamyoni seed-frazasi (12/24 so'z)

Ishga tushirish uchun .env da:
  PYFRAGMENT_ENABLED=true
  TON_API_KEY=...
  FRAGMENT_COOKIE_SSID=...
  FRAGMENT_COOKIE_DT=-300
  FRAGMENT_COOKIE_TOKEN=...
  FRAGMENT_COOKIE_TON_TOKEN=...
  PYFRAGMENT_WALLET_VERSION=V5R1
  PYFRAGMENT_API_PROVIDER=tonapi
"""

import logging
from typing import Any, Dict, Optional

from app.config import parse_cookie_string, settings

logger = logging.getLogger(__name__)

REQUIRED_COOKIE_KEYS = ("stel_ssid", "stel_dt", "stel_token", "stel_ton_token")
PREMIUM_MONTHS_VALID = (3, 6, 12)


def _relax_cookie_requirement() -> None:
    """
    pyfragment kutubxonasi cookie kalitlarini qat'iy tekshiradi (stel_ssid, stel_dt,
    stel_token, stel_ton_token). Lekin stel_token va stel_ton_token hech qanday
    kodda ishlatilmaydi — faqat sessiya (stel_ssid + stel_dt) yetarli. Shu sababli
    talabni faqat stel_ssid + stel_dt ga yumshatamiz. Bundan tashqari api_key
    keyless (None) rejimini ham qo'llab-quvvatlaymiz.
    """
    try:
        import pyfragment.core.constants as constants_mod
        import pyfragment.core.validation as validation_mod

        relaxed = ("stel_ssid", "stel_dt")
        constants_mod.REQUIRED_COOKIE_KEYS = relaxed
        validation_mod.REQUIRED_COOKIE_KEYS = relaxed

        # USDT to'lovi uchun minimal TON (gaz) talabini pastlatiramiz:
        # pyfragment 0.33 TON talab qiladi, lekin haqiqiy gaz ~0.02 TON.
        constants_mod.MIN_GRAM_BALANCE = 0.02
        constants_mod.MIN_USDT_BALANCE = 0.0

        # tonapi/account moduli importni o'z namespace'ida saqlaydi — shuni ham yangilaymiz
        try:
            import pyfragment.services.tonapi.account as account_mod

            account_mod.MIN_GRAM_BALANCE = constants_mod.MIN_GRAM_BALANCE
            account_mod.MIN_USDT_BALANCE = constants_mod.MIN_USDT_BALANCE
        except Exception:
            pass

        original_validate = validation_mod.validate_credentials

        def _validate_credentials_keyless(seed: str, api_key: str) -> None:
            if not seed or not str(seed).strip():
                raise RuntimeError("Seed (mnemonic) talab qilinadi")
            word_count = len(seed.split())
            if word_count not in constants_mod.MNEMONIC_WORD_COUNTS_VALID:
                raise RuntimeError(f"Seed {word_count} ta so'zdan iborat (12 yoki 24 talab qilinadi)")

        validation_mod.validate_credentials = _validate_credentials_keyless
        try:
            import pyfragment.client as client_mod

            client_mod.validate_credentials = _validate_credentials_keyless
        except Exception:
            pass
        logger.info("pyfragment: keyless api_key + relaksed cookie talabi qo'llandi")
    except Exception as exc:
        logger.warning("pyfragment cookie talabini yumshatib bo'lmadi: %s", exc)


_relax_cookie_requirement()


class PyFragmentService:
    """pyfragment orqali Fragment.com xaridlari va TON hamyoni ma'lumotlari."""

    def __init__(self):
        self._imported: Optional[bool] = None

    # ---------- Mavjudlik ----------

    def available(self) -> bool:
        """pyfragment ishlashi uchun barcha shartlar bajarilganmi tekshiradi."""
        if not getattr(settings, "PYFRAGMENT_ENABLED", False):
            return False
        if self._imported is None:
            try:
                import pyfragment  # noqa: F401
                from pyfragment.enums import PaymentMethod  # noqa: F401

                self._imported = True
            except Exception as exc:
                logger.warning("pyfragment import failed: %s", exc)
                self._imported = False
        if not self._imported:
            return False
        cookies = self._build_cookies()
        missing = [k for k in ("stel_ssid", "stel_dt") if not cookies.get(k)]
        if missing:
            logger.warning("pyfragment: cookie yetishmayapti: %s", ", ".join(missing))
            return False
        return True

    # ---------- Cookie yig'ish ----------

    def _build_cookies(self) -> Dict[str, str]:
        """Env sozlamalaridan pyfragment cookie dict'ini yig'adi."""
        cookies: Dict[str, str] = {}
        raw = getattr(settings, "FRAGMENT_COOKIES", None)
        if raw:
            parsed = parse_cookie_string(raw)
            for k, v in parsed.items():
                if v.strip():
                    cookies[k.strip()] = v.strip()
        for env_key, cookie_key in (
            ("FRAGMENT_COOKIE_SSID", "stel_ssid"),
            ("FRAGMENT_COOKIE_DT", "stel_dt"),
            ("FRAGMENT_COOKIE_TOKEN", "stel_token"),
            ("FRAGMENT_COOKIE_TON_TOKEN", "stel_ton_token"),
        ):
            val = getattr(settings, env_key, None)
            if val and str(val).strip():
                cookies[cookie_key] = str(val).strip()
        return cookies

    # ---------- Client ----------

    def _build_client(self, seed: str):
        from pyfragment import FragmentClient

        api_key = getattr(settings, "TON_API_KEY", None)
        if not api_key or str(api_key).strip().lower() in ("", "your-ton-api-key"):
            api_key = ""

        return FragmentClient(
            seed=seed,
            api_key=api_key,
            cookies=self._build_cookies(),
            wallet_version=getattr(settings, "PYFRAGMENT_WALLET_VERSION", "V5R1"),
            api_provider=getattr(settings, "PYFRAGMENT_API_PROVIDER", "tonapi"),
            timeout=float(getattr(settings, "PYFRAGMENT_TIMEOUT", 30.0)),
        )

    def _payment_method(self, method: Optional[str]):
        from pyfragment.enums import PaymentMethod

        if (method or "").lower() in ("usdt", "usdt_ton"):
            return PaymentMethod.USDT_GRAM
        return PaymentMethod.GRAM

    # ---------- Balans ----------

    async def get_wallet(self, seed: str) -> Dict[str, Any]:
        """pyfragment orqali TON hamyoni ma'lumotlari va balansini olish."""
        client = self._build_client(seed)
        async with client:
            info = await client.get_wallet()
        return {
            "success": True,
            "address": info.address,
            "state": info.state,
            "gram_balance": info.gram_balance,
            "usdt_balance": info.usdt_balance,
        }

    # ---------- Stars ----------

    async def buy_stars(
        self,
        username: str,
        amount: int,
        seed: str,
        payment_method: Optional[str] = None,
    ) -> Dict[str, Any]:
        """pyfragment orqali Telegram Stars sotib olish."""
        client = self._build_client(seed)
        async with client:
            result = await client.purchase_stars(
                username=username,
                amount=amount,
                payment_method=self._payment_method(payment_method),
            )
        return {
            "success": True,
            "response": {
                "transaction_id": result.transaction_id,
                "username": result.username,
                "amount": result.amount,
            },
            "tx_id": result.transaction_id,
        }

    # ---------- Premium ----------

    async def buy_premium(
        self,
        username: str,
        months: int,
        seed: str,
        payment_method: Optional[str] = None,
    ) -> Dict[str, Any]:
        """pyfragment orqali Telegram Premium obunasini sovg'a qilish."""
        months = self._normalize_months(months)
        client = self._build_client(seed)
        async with client:
            result = await client.purchase_premium(
                username=username,
                months=months,
                payment_method=self._payment_method(payment_method),
            )
        return {
            "success": True,
            "response": {
                "transaction_id": result.transaction_id,
                "username": result.username,
                "amount": result.amount,
            },
            "tx_id": result.transaction_id,
        }

    @staticmethod
    def _normalize_months(months: int) -> int:
        """pyfragment faqat 3/6/12 oyni qo'llab-quvvatlaydi - eng yaqiniga moslaydi."""
        if months in PREMIUM_MONTHS_VALID:
            return months
        if months <= 3:
            return 3
        return min(PREMIUM_MONTHS_VALID, key=lambda m: abs(m - months))


pyfragment_service = PyFragmentService()
