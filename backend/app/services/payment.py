"""To'lov servisi.

Real platformada to'lovlar TON/USDT (blockchain) yoki Stripe orqali amalga
oshiriladi. Bu servis to'lov tizimi bilan ishlash interfeysini ta'minlaydi.
"""

import logging
import uuid
from typing import Optional

logger = logging.getLogger(__name__)


class PaymentService:
    async def create_payment(
        self,
        amount: float,
        currency: str,
        user_id: int,
        description: str = "",
    ) -> dict:
        """To'lov buyurtmasini yaratadi (demo: haqiqiy integratsiya kerak)."""
        payment_id = f"PAY-{uuid.uuid4().hex[:12].upper()}"
        logger.info("Payment created: %s amount=%s %s for user=%s", payment_id, amount, currency, user_id)
        return {
            "payment_id": payment_id,
            "amount": amount,
            "currency": currency,
            "status": "pending",
            "description": description,
        }

    async def verify_payment(self, payment_id: str) -> Optional[dict]:
        """To'lovning blockchain/Stripe holatini tekshiradi (demo)."""
        logger.info("Verifying payment: %s", payment_id)
        return {
            "payment_id": payment_id,
            "status": "confirmed",
        }


payment_service = PaymentService()