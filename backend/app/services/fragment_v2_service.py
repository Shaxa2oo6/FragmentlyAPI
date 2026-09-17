# backend/app/services/fragment_v2_service.py
"""
fragment-api.net v2 API integratsiyasi (wallet_type=v5r1 qo'llab-quvvatlaydi).

V1 (fragment-api-lib) faqat v4R2 wallet derivatsiya qiladi, bu esa v5R1 da
pul saqlagan foydalanuvchilarda "Insufficient balance" xatosini beradi.
V2 API pay bosqichida ``wallet_type`` ("v4r2" / "v5r1") parametrini qabul
qiladi, shuning uchun foydalanuvchining haqiqiy wallet turi bilan to'lov
amalga oshiriladi.

Flow:
  1) POST /v2/auth                       -> auth_key (fragment_cookies + seed)
  2) POST /v2/buyStarsWithoutKYC/create  -> order_uuid, cost
  3) POST /v2/buyStarsWithoutKYC/pay     -> real to'lov (wallet_type bilan)
  4) GET  /v2/buyStarsWithoutKYC/check   -> order holati
"""

import logging
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class FragmentV2Service:
    """fragment-api.net v2 API client (sync HTTP)."""

    BASE_URL = "https://api.fragment-api.net"

    def __init__(self):
        self.base_url = settings.FRAGMENT_API_LIB_URL or self.BASE_URL
        self.cookies = settings.EFFECTIVE_FRAGMENT_COOKIES
        self._timeout = 60.0

    # ---------- ichki yordamchi ----------

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        with httpx.Client(timeout=self._timeout) as client:
            resp = client.post(f"{self.base_url}{path}", json=payload)
            try:
                data = resp.json()
            except Exception:
                raise RuntimeError(
                    f"Fragment v2 {path} javobini o'qib bo'lmadi (HTTP {resp.status_code})"
                )
        if not data.get("success"):
            raise RuntimeError(
                data.get("message") or data.get("error_code") or f"Fragment v2 {path} failed"
            )
        return data

    def _get(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        with httpx.Client(timeout=self._timeout) as client:
            resp = client.get(f"{self.base_url}{path}", params=params)
            try:
                data = resp.json()
            except Exception:
                raise RuntimeError(
                    f"Fragment v2 {path} javobini o'qib bo'lmadi (HTTP {resp.status_code})"
                )
        if not data.get("success"):
            raise RuntimeError(
                data.get("message") or data.get("error_code") or f"Fragment v2 {path} failed"
            )
        return data

    @staticmethod
    def _base64_seed(seed: str) -> str:
        return seed.strip()

    # ---------- auth ----------

    def auth(self, seed: str) -> str:
        """auth_key yaratadi (fragment_cookies + seed)."""
        cookies = self.cookies
        if not cookies:
            raise RuntimeError("Fragment v2 auth uchun FRAGMENT_COOKIES sozlanmagan")
        data = self._post(
            "/v2/auth",
            {
                "fragment_cookies": cookies,
                "seed": self._base64_seed(seed),
            },
        )
        auth_key = data.get("auth_key")
        if not auth_key:
            raise RuntimeError("Fragment v2 auth auth_key qaytarmadi")
        return auth_key

    # ---------- Stars ----------

    def buy_stars_without_kyc(
        self,
        username: str,
        amount: int,
        seed: str,
        wallet_type: str = "v5r1",
        payment_method: str = "ton",
    ) -> Dict[str, Any]:
        """V2 buyStarsWithoutKYC flow: auth -> create -> pay -> check."""
        clean_user = username.replace("@", "").strip()
        auth_key = self.auth(seed)

        created = self._post(
            "/v2/buyStarsWithoutKYC/create",
            {
                "username": clean_user,
                "amount": int(amount),
                "payment_method": payment_method,
            },
        )
        order_uuid = created.get("order_id")
        cost = created.get("cost")
        if not order_uuid or cost is None:
            raise RuntimeError("Fragment v2 create order_uuid/cost qaytarmadi")

        paid = self._post(
            "/v2/buyStarsWithoutKYC/pay",
            {
                "order_uuid": order_uuid,
                "auth_key": auth_key,
                "cost": float(cost),
                "wallet_type": wallet_type,
            },
        )
        tx_hash = paid.get("transaction_hash") or ""

        checked = {}
        try:
            checked = self._get(
                "/v2/buyStarsWithoutKYC/check", {"uuid": order_uuid}
            )
        except Exception as exc:
            logger.warning("Fragment v2 stars check failed: %s", exc)

        logger.info("Fragment v2 stars buy ok order=%s cost=%s hash=%s", order_uuid, cost, tx_hash)
        return {
            "success": True,
            "order_id": order_uuid,
            "cost": cost,
            "transaction_hash": tx_hash,
            "status": checked.get("status") or paid.get("message") or "success",
            "data": paid,
        }

    def buy_premium_without_kyc(
        self,
        username: str,
        duration_months: int,
        seed: str,
        wallet_type: str = "v5r1",
        payment_method: str = "ton",
    ) -> Dict[str, Any]:
        """V2 buyPremiumWithoutKYC flow: auth -> create -> pay -> check."""
        clean_user = username.replace("@", "").strip()
        auth_key = self.auth(seed)

        created = self._post(
            "/v2/buyPremiumWithoutKYC/create",
            {
                "username": clean_user,
                "duration": int(duration_months),
                "payment_method": payment_method,
            },
        )
        order_uuid = created.get("order_id")
        cost = created.get("cost")
        if not order_uuid or cost is None:
            raise RuntimeError("Fragment v2 premium create order_uuid/cost qaytarmadi")

        paid = self._post(
            "/v2/buyPremiumWithoutKYC/pay",
            {
                "order_uuid": order_uuid,
                "auth_key": auth_key,
                "cost": float(cost),
                "wallet_type": wallet_type,
            },
        )
        tx_hash = paid.get("transaction_hash") or ""

        checked = {}
        try:
            checked = self._get(
                "/v2/buyPremiumWithoutKYC/check", {"uuid": order_uuid}
            )
        except Exception as exc:
            logger.warning("Fragment v2 premium check failed: %s", exc)

        logger.info("Fragment v2 premium buy ok order=%s cost=%s hash=%s", order_uuid, cost, tx_hash)
        return {
            "success": True,
            "order_id": order_uuid,
            "cost": cost,
            "transaction_hash": tx_hash,
            "status": checked.get("status") or paid.get("message") or "success",
            "data": paid,
        }


fragment_v2_service = FragmentV2Service()
