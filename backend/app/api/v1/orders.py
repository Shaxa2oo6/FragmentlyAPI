"""
Orders API v1 - Buyurtma holatini tekshirish va tranzaksiyalar tarixi.

Ushbu endpointlar API (X-API-Key) orqali:
  1. Bitta buyurtma holatini real-vaqt rejimida tekshirish.
  2. Foydalanuvchining umumiy tranzaksiyalar tarixini olish.
"""

import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Transaction, TransactionStatus, TransactionType, User

router = APIRouter(prefix="/api/v1/orders", tags=["Orders v1"])

logger = logging.getLogger(__name__)

# Holat -> foydalanuvchiga tushunarli belgi (status_label)
STATUS_LABELS = {
    TransactionStatus.PENDING: "Kutilmoqda",
    TransactionStatus.PROCESSING: "Jarayonda",
    TransactionStatus.COMPLETED: "Muvaffaqiyatli",
    TransactionStatus.FAILED: "Muvaffaqiyatsiz",
    TransactionStatus.REFUNDED: "Qaytarilgan",
}


def _serialize_order(tx: Transaction) -> dict:
    """Tranzaksiyani client-facing canonical formatga aylantiradi."""
    user = tx.user
    return {
        "success": True,
        "order_id": tx.fragment_tx_id or f"tx_{tx.id}",
        "transaction_id": tx.id,
        # Formatlangan tranzaksiya ID: #TX-84920
        "tx_id": f"#TX-{tx.id}",
        "type": tx.transaction_type.value,
        "status": tx.status.value,
        "status_label": STATUS_LABELS.get(tx.status, tx.status.value),
        "amount": tx.amount,
        "currency": tx.currency,
        "target_username": tx.target_username,
        "premium_user_username": tx.premium_user_username,
        "premium_duration": tx.premium_duration,
        "quantity": tx.quantity,
        "user_id": tx.user_id,
        # Foydalanuvchi ob'ekti: username (@user) yoki telegram_id
        "user": {
            "username": user.username if user else None,
            "telegram_username": getattr(user, "telegram_username", None) if user else None,
            "telegram_id": getattr(user, "telegram_id", None) if user else None,
            "email": user.email if user else None,
        },
        "payment_method": tx.payment_method.value if tx.payment_method else None,
        "commission": tx.commission_amount or 0.0,
        "commission_rate": tx.commission_rate,
        "is_refund": bool(tx.is_refund),
        "refund_reason": tx.refund_reason,
        "error_reason": tx.error_message or tx.refund_reason,
        "tx_hash": tx.tx_hash,
        "fragment_tx_id": tx.fragment_tx_id,
        "created_at": tx.created_at.isoformat() if tx.created_at else None,
        "completed_at": tx.completed_at.isoformat() if tx.completed_at else None,
    }


@router.get(
    "/status/{order_id}/",
    summary="Buyurtma holatini tekshirish",
    description=(
        "Stars yoki Premium sotib olayotganda qaytarilgan order_id (fragment_tx_id) "
        "yoki transaction_id yordamida buyurtma holatini real-vaqt rejimida tekshiradi."
    ),
)
async def get_order_status(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Bitta buyurtmaning holatini qaytaradi.

    - order_id sifatida `fragment_tx_id`, `tx_hash` yoki raqamli `transaction_id`
      qabul qilinadi (masalan: `tx_9823412`, `frag_stars_a1b2c3d4` yoki `123`).
    - Faqat joriy foydalanuvchiga tegishli buyurtmalar ko'rinadi.
    """
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .where(Transaction.transaction_type != TransactionType.COMMISSION)
        .options(selectinload(Transaction.user))
    )

    raw_str = str(order_id).strip()
    # Qo'llab-quvvatlanadigan formatlar:
    #   "30"        -> transaction_id
    #   "#TX-30"    -> tx_id (API javobidagi format)
    #   "TX-30" / "tx_30" / "tx-30"
    #   "frag_stars_abc" (fragment_tx_id) yoki tx_hash
    tx_id_match = re.fullmatch(r'(?:#?\s*[tT][xX][_-]?\s*)?(\d+)', raw_str)

    if tx_id_match:
        tx_id_num = int(tx_id_match.group(1))
        stmt = stmt.where(
            (Transaction.id == tx_id_num)
            | (Transaction.fragment_tx_id == raw_str)
            | (Transaction.tx_hash == raw_str)
        )
    else:
        stmt = stmt.where(
            (Transaction.fragment_tx_id == raw_str)
            | (Transaction.tx_hash == raw_str)
        )

    result = await db.execute(stmt)
    tx = result.scalars().first()

    if not tx:
        raise HTTPException(
            status_code=404,
            detail=f"Buyurtma topilmadi: {order_id}",
        )

    return _serialize_order(tx)


@router.get(
    "/history/",
    summary="Tranzaksiyalar tarixi",
    description=(
        "Foydalanuvchining barcha buyurtmalarini (Stars / Premium / Tarif / Refund) "
        "filter va pagination bilan qaytaradi."
    ),
)
async def get_order_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[TransactionStatus] = None,
    transaction_type: Optional[TransactionType] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foydalanuvchining tranzaksiyalar tarixi (filter + pagination)."""
    base = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .where(Transaction.transaction_type != TransactionType.COMMISSION)
        .options(selectinload(Transaction.user))
    )

    if status:
        base = base.where(Transaction.status == status)
    if transaction_type and transaction_type != TransactionType.COMMISSION:
        base = base.where(Transaction.transaction_type == transaction_type)
    # Komissiya (Commission) tranzaksiyalari foydalanuvchi tarixida umuman ko'rinmaydi
    base = base.where(Transaction.transaction_type != TransactionType.COMMISSION)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = base.order_by(desc(Transaction.created_at)).limit(limit).offset(offset)
    result = await db.execute(stmt)
    transactions = result.scalars().all()

    logger.info(
        "Order history: user=%s total=%s limit=%s offset=%s status=%s",
        current_user.username,
        total,
        limit,
        offset,
        status.value if status else "-",
    )

    return {
        "success": True,
        "orders": [_serialize_order(t) for t in transactions],
        "total": total,
        "page_size": limit,
        "offset": offset,
    }
