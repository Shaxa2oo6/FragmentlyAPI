"""Fragment.com va Stripe webhook'larini qabul qilish.

Ushbu endpointlar tashqi to'lov/xarid provayderlaridan kelayotgan
xabarnomalarni qabul qiladi va tranzaksiya hamda user balanslarini
yangilaydi.
"""

import hashlib
import hmac
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Transaction, TransactionStatus, User
from app.services.analytics import record_transaction

router = APIRouter(tags=["Webhooks"])

logger = logging.getLogger(__name__)


def _verify_hmac(payload: bytes, signature: str, secret: Optional[str]) -> bool:
    """Stripe uslubidagi v1 imzo tekshiruvi (t=...;v1=...)."""
    if not secret:
        # Demo rejim: secret sozlanmagan bo'lsa, tekshiruv o'tkazib yuboriladi
        return True

    parts = {}
    for item in signature.split(";"):
        if "=" in item:
            key, _, value = item.partition("=")
            parts[key.strip()] = value.strip()

    timestamp = parts.get("t")
    expected = parts.get("v1")
    if not timestamp or not expected:
        return False

    signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode("utf-8")
    computed = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, expected)


@router.post("/webhook/fragment")
async def fragment_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Fragment.com to'lov/xarid provayderidan webhook.

    Kutilayotgan body:
    { "status": "done"|"failed", "order_id": "...", "task_id": 123,
      "tx_id": "...", "error": "..." }
    """
    logger.info("Fragment webhook qabul qilindi: %s", request.headers.get("X-Fragment-Signature", "-"))
    data = await request.json()

    order_id = str(data.get("order_id") or data.get("task_id") or data.get("fragment_tx_id") or "")

    if not order_id:
        raise HTTPException(status_code=400, detail="order_id talab qilinadi")

    # Bizning tranzaksiyani fragment_order_id orqali topish
    stmt = select(Transaction).where(Transaction.fragment_order_id == order_id)
    result = await db.execute(stmt)
    transaction = result.scalar_one_or_none()

    if not transaction:
        # Fragment buyurgan id bo'lishi mumkin
        stmt2 = select(Transaction).where(Transaction.fragment_tx_id == order_id)
        result2 = await db.execute(stmt2)
        transaction = result2.scalar_one_or_none()

    if not transaction:
        logger.warning("Fragment webhook: tranzaksiya topilmadi order=%s", order_id)
        return {"received": True, "matched": False}

    status = str(data.get("status", "")).lower()
    if status in ("done", "success", "completed"):
        transaction.status = TransactionStatus.COMPLETED
        if data.get("tx_id"):
            transaction.fragment_tx_id = str(data.get("tx_id"))
        transaction.completed_at = func.now()
        logger.info("Tranzaksiya #%s fragment bo'yicha muvaffaqiyatli", transaction.id)
        await record_transaction(db, transaction)
    elif status in ("failed", "error", "cancelled"):
        transaction.status = TransactionStatus.FAILED
        transaction.error_message = str(data.get("error") or "Fragment webhook: xatolik")
        await db.commit()
        logger.warning("Tranzaksiya #%s fragment bo'yicha muvaffaqiyatsiz", transaction.id)
    else:
        logger.info("Fragment webhook: status o'zgartirilmadi -> %s", status)

    return {"received": True, "matched": True, "transaction_id": transaction.id}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Stripe dan webhook.

    - payment_intent.succeeded: user balansiga mablag' qo'shiladi.
      payment_intent metadata: { "user_id": "...", "amount": "...", "method": "gram"|"usdt" }
    """
    payload = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    if not _verify_hmac(payload, signature, settings.STRIPE_WEBHOOK_SECRET):
        raise HTTPException(status_code=400, detail="Noto'g'ri imzo")

    try:
        event = await request.json()
    except Exception as exc:
        logger.error("Stripe webhook body parse xatolik: %s", exc)
        raise HTTPException(status_code=400, detail="Body noto'g'ri JSON")

    event_type = event.get("type")
    event_data = event.get("data", {}).get("object", {})
    logger.info("Stripe webhook qabul qilindi: %s", event_type)

    if event_type == "payment_intent.succeeded":
        metadata = event_data.get("metadata", {})
        user_id = metadata.get("user_id")
        amount = metadata.get("amount")
        method = metadata.get("method", "gram")

        if not user_id or not amount:
            return {"received": True, "processed": False, "reason": "metadata yetarli emas"}

        stmt = select(User).where(User.id == int(user_id))
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            return {"received": True, "processed": False, "reason": "user topilmadi"}

        # Stripe summasi tikentda (1$ = 100 sent) keladi, shu sabab /100 qilinadi
        try:
            amount_value = float(amount)
        except (TypeError, ValueError):
            amount_value = float(amount) / 100

        if method == "usdt":
            user.balance_usdt += amount_value
        else:
            user.balance_gram += amount_value

        await db.commit()
        logger.info("Stripe to'lovi: user=%s +%.2f %s", user.username, amount_value, method)
        return {"received": True, "processed": True}

    # Boshqa eventlar (payout, charge...) - shunchaki qabul qilinadi
    return {"received": True, "processed": True, "event": event_type}