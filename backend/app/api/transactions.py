import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Transaction, TransactionStatus, TransactionType, User

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

logger = logging.getLogger(__name__)


@router.get("/")
async def get_transactions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[TransactionStatus] = None,
    transaction_type: Optional[TransactionType] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foydalanuvchining tranzaksiyalari (filter + pagination)"""
    # Umumiy so'rov bazasi (filterlar bilan)
    base = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .options(selectinload(Transaction.user))
    )

    if status:
        base = base.where(Transaction.status == status)
    if transaction_type:
        base = base.where(Transaction.transaction_type == transaction_type)
    else:
        # Umumiy "Tranzaksiyalar" ro'yxatida faqat xizmat ko'rsatish buyurtmalari
        # (Telegram Stars / Premium) ko'rinadi. "Tarif" (tariff) va "Komissiya"
        # (commission) to'lovlari "Obuna tarixi" blokiga ajratilgan.
        base = base.where(
            Transaction.transaction_type.notin_(
                [TransactionType.TARIFF, TransactionType.COMMISSION]
            )
        )

    # Umumiy son (pagination uchun)
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Sahifalangan so'rov
    stmt = base.order_by(desc(Transaction.created_at)).limit(limit).offset(offset)
    result = await db.execute(stmt)
    transactions = result.scalars().all()

    logger.info(
        "Transactions: user=%s total=%s limit=%s offset=%s status=%s",
        current_user.username,
        total,
        limit,
        offset,
        status.value if status else "-",
    )

    return {
        "transactions": [
            {
                "id": t.id,
                "tx_id": f"#TX-{t.id}",
                "type": t.transaction_type.value,
                "status": t.status.value,
                "payment_method": t.payment_method.value,
                "quantity": t.quantity,
                "target_username": t.target_username,
                "premium_duration": t.premium_duration,
                "premium_user_id": t.premium_user_id,
                "premium_user_username": t.premium_user_username,
                "amount": t.amount,
                "currency": t.currency,
                "commission": t.commission_amount or 0.0,
                "commission_rate": t.commission_rate,
                "is_refund": bool(t.is_refund),
                "refund_reason": t.refund_reason,
                "error_message": t.error_message,
                "original_transaction_id": t.original_transaction_id,
                "tx_hash": t.tx_hash,
                "fragment_tx_id": t.fragment_tx_id,
                "user_id": t.user_id,
                "user": {
                    "username": t.user.username if t.user else None,
                    "telegram_username": getattr(t.user, "telegram_username", None) if t.user else None,
                    "telegram_id": getattr(t.user, "telegram_id", None) if t.user else None,
                    "email": t.user.email if t.user else None,
                },
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in transactions
        ],
        "total": total,
        "page_size": limit,
        "offset": offset,
    }


@router.get("/{transaction_id}")
async def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bitta tranzaksiya detallari"""
    stmt = select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
        Transaction.transaction_type.notin_(
            [TransactionType.TARIFF, TransactionType.COMMISSION]
        ),
    )
    result = await db.execute(stmt)
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {
        "id": transaction.id,
        "tx_id": f"#TX-{transaction.id}",
        "type": transaction.transaction_type.value,
        "status": transaction.status.value,
        "payment_method": transaction.payment_method.value,
        "quantity": transaction.quantity,
        "target_username": transaction.target_username,
        "premium_duration": transaction.premium_duration,
        "premium_user_id": transaction.premium_user_id,
        "premium_user_username": transaction.premium_user_username,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "commission": transaction.commission_amount or 0.0,
        "commission_rate": transaction.commission_rate,
        "is_refund": bool(transaction.is_refund),
        "refund_reason": transaction.refund_reason,
        "original_transaction_id": transaction.original_transaction_id,
        "tx_hash": transaction.tx_hash,
        "fragment_tx_id": transaction.fragment_tx_id,
        "error_message": transaction.error_message,
        "user_id": transaction.user_id,
        "user": {
            "username": transaction.user.username if transaction.user else None,
            "telegram_username": getattr(transaction.user, "telegram_username", None) if transaction.user else None,
            "telegram_id": getattr(transaction.user, "telegram_id", None) if transaction.user else None,
            "email": transaction.user.email if transaction.user else None,
        },
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
        "completed_at": transaction.completed_at.isoformat() if transaction.completed_at else None,
    }


@router.post("/{transaction_id}/refund")
async def refund_transaction_by_id(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Buyurtma bajarilmasa to'liq qaytarish (asosiy summa + komissiya).

    Refund platforma o'z hamyonidan foydalanuvchi hamyoniga yuboriladi.
    """
    from app.services.refund_service import refund_transaction

    tx = await db.get(Transaction, transaction_id)
    if not tx or tx.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Tranzaksiya topilmadi")

    if tx.status not in (TransactionStatus.FAILED, TransactionStatus.PROCESSING):
        raise HTTPException(
            status_code=400,
            detail="FaQat bajarilmagan (failed/processing) buyurtmalar qaytarilishi mumkin",
        )

    try:
        result = await refund_transaction(
            db=db,
            user_id=current_user.id,
            transaction_id=transaction_id,
            reason="Foydalanuvchi tomonidan so'ralgan refund",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Refund xatolik: {exc}")

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Refund amalga oshmadi"))

    return result