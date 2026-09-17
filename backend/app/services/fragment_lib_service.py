# backend/app/services/fragment_lib_service.py
"""
fragment-api-lib (Fragment Community API) integratsiyasi.

Ushbu servis 24 so'zlik TON seed-frazasi (va ixtiyoriy KYC cookies) orqali
Fragment.com dagi Stars va Premium xaridlarini avtomatik amalga oshiradi.
"""

import logging
from typing import Any, Dict, Optional

from app.config import settings

logger = logging.getLogger(__name__)

try:
    from fragment_api_lib.client import FragmentAPIClient
    from fragment_api_lib.exceptions import FragmentAPIError
    FRAGMENT_LIB_INSTALLED = True
except ImportError:
    FRAGMENT_LIB_INSTALLED = False
    logger.warning("fragment-api-lib o'rnatilmagan")


class FragmentLibService:
    """fragment-api-lib kutubxonasi orqali Fragment.com avtomatizatsiyasi."""

    def __init__(self):
        self.base_url = settings.FRAGMENT_API_LIB_URL
        self.default_seed = settings.FRAGMENT_SEED_PHRASE
        self.default_cookies = settings.EFFECTIVE_FRAGMENT_COOKIES

    def _get_client(self, seed: Optional[str] = None, cookies: Optional[str] = None) -> Any:
        if not FRAGMENT_LIB_INSTALLED:
            raise RuntimeError("fragment-api-lib kutubxonasi backend tizimida mavjud emas")

        active_seed = seed or self.default_seed
        active_cookies = cookies or self.default_cookies
        return FragmentAPIClient(
            seed=active_seed,
            fragment_cookies=active_cookies,
            base_url=self.base_url,
        )

    def ping(self) -> Dict[str, Any]:
        """Fragment API Server mavjudligini tekshirish."""
        try:
            client = self._get_client()
            return client.ping()
        except Exception as e:
            logger.error("FragmentLib ping error: %s", e)
            return {"status": "error", "message": str(e)}

    def get_balance(self, seed: Optional[str] = None) -> Dict[str, Any]:
        """TON Wallet balansini olish (seed-phrase orqali)."""
        try:
            client = self._get_client(seed=seed)
            return client.get_balance(seed=seed)
        except Exception as e:
            logger.error("FragmentLib get_balance error: %s", e)
            return {"success": False, "error": str(e)}

    def buy_stars(
        self,
        username: str,
        amount: int,
        seed: Optional[str] = None,
        without_kyc: bool = True,
        show_sender: bool = False,
        cookies: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Stars sotib olish va yuborish.
        - without_kyc=True: KYC talab qilmaydigan rejim (tavsiya etiladi)
        - without_kyc=False: KYC cookies talab qilinadi (past komissiya)
        """
        try:
            client = self._get_client(seed=seed, cookies=cookies)
            clean_user = username.replace("@", "").strip()

            if without_kyc:
                res = client.buy_stars_without_kyc(
                    username=clean_user,
                    amount=amount,
                    seed=seed,
                )
            else:
                res = client.buy_stars(
                    username=clean_user,
                    amount=amount,
                    show_sender=show_sender,
                    fragment_cookies=cookies,
                    seed=seed,
                )
            return {"success": True, "data": res}
        except Exception as e:
            logger.error("FragmentLib buy_stars error: %s", e)
            return {"success": False, "error": str(e)}

    def buy_premium(
        self,
        username: str,
        duration: int = 3,
        seed: Optional[str] = None,
        without_kyc: bool = True,
        show_sender: bool = False,
        cookies: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Telegram Premium sotib olish (3, 6 yoki 12 oy).
        - without_kyc=True: KYC siz rejim
        """
        try:
            client = self._get_client(seed=seed, cookies=cookies)
            clean_user = username.replace("@", "").strip()

            if without_kyc:
                res = client.buy_premium_without_kyc(
                    username=clean_user,
                    duration=duration,
                    seed=seed,
                )
            else:
                res = client.buy_premium(
                    username=clean_user,
                    duration=duration,
                    show_sender=show_sender,
                    fragment_cookies=cookies,
                    seed=seed,
                )
            return {"success": True, "data": res}
        except Exception as e:
            logger.error("FragmentLib buy_premium error: %s", e)
            return {"success": False, "error": str(e)}

    def get_user_info(self, username: str, cookies: Optional[str] = None) -> Dict[str, Any]:
        """Telegram foydalanuvchisi ma'lumotlarini olish."""
        try:
            client = self._get_client(cookies=cookies)
            clean_user = username.replace("@", "").strip()
            return client.get_user_info(username=clean_user, fragment_cookies=cookies)
        except Exception as e:
            logger.error("FragmentLib get_user_info error: %s", e)
            return {"success": False, "error": str(e)}

    def get_orders(self, seed: Optional[str] = None, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        """Fragment xaridlar tarixini olish."""
        try:
            client = self._get_client(seed=seed)
            return client.get_orders(seed=seed, limit=limit, offset=offset)
        except Exception as e:
            logger.error("FragmentLib get_orders error: %s", e)
            return {"success": False, "error": str(e)}


fragment_lib_service = FragmentLibService()
