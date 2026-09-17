"""Analytics statistikasini yangilash servisi.

Har bir bajarilgan tranzaksiya bo'yicha Analytics jadvalida kunlik
yozuvni oshiradi. Bu orqali dashboard uchun real vaqtdagi statistika
yuritiladi.
"""

import logging
from datetime import datetime, time, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Analytics, Transaction, TransactionStatus, TransactionType

logger = logging.getLogger(__name__)


async def record_transaction(db: AsyncSession, transaction: Optional[Transaction]) -> None:
    """Tugallangan tranzaksiyani Analytics jadvaliga yozadi."""
    if transaction is None:
        return

    # Bugungi sana bo'yicha analytics yozuvini topish (yoki yangi yaratish)
    now = datetime.now(timezone.utc)
    start_of_day = datetime.combine(now.date(), time.min)

    stmt = (
        select(Analytics)
        .where(Analytics.date >= start_of_day)
        .order_by(Analytics.date.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    analytics = result.scalar_one_or_none()

    if analytics is None:
        analytics = Analytics(date=now)
        db.add(analytics)

    # Umumiy hisoblagichlar
    analytics.total_transactions = (analytics.total_transactions or 0) + 1
    analytics.daily_transactions = (analytics.daily_transactions or 0) + 1

    if transaction.status == TransactionStatus.COMPLETED:
        if transaction.transaction_type == TransactionType.STARS:
            quantity = transaction.quantity or 0
            analytics.total_stars_sold = (analytics.total_stars_sold or 0) + quantity
            analytics.daily_stars = (analytics.daily_stars or 0) + quantity
        elif transaction.transaction_type == TransactionType.PREMIUM:
            analytics.total_premium_sold = (analytics.total_premium_sold or 0) + 1
            analytics.daily_premium = (analytics.daily_premium or 0) + 1

        if transaction.currency == "GRAM":
            analytics.total_revenue_gram = (analytics.total_revenue_gram or 0.0) + transaction.amount
            analytics.daily_revenue = (analytics.daily_revenue or 0.0) + transaction.amount
        elif transaction.currency == "USDT":
            analytics.total_revenue_usdt = (analytics.total_revenue_usdt or 0.0) + transaction.amount

    # Muvaffaqiyat ulushi: Transaction jadvalidan hisoblanadi
    analytics.success_rate = await _compute_success_rate(db)

    await db.commit()
    logger.info(
        "Analytics yangilandi: tranzaksiya=%s, status=%s",
        transaction.id,
        transaction.status.value,
    )


async def _compute_success_rate(db: AsyncSession) -> float:
    try:
        total_stmt = select(func.count()).select_from(Transaction)
        total = (await db.execute(total_stmt)).scalar() or 0

        if total == 0:
            return 0.0

        success_stmt = select(func.count()).select_from(Transaction).where(
            Transaction.status == TransactionStatus.COMPLETED
        )
        success = (await db.execute(success_stmt)).scalar() or 0

        return round(success / total * 100, 1)
    except Exception as exc:  # pragma: no cover
        logger.warning("Success rate hisoblashda xatolik: %s", exc)
        return 0.0