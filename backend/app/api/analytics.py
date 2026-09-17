from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Transaction, TransactionStatus, TransactionType, User

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

PERIOD_DAYS = 30


def _pct_change(current: float, previous: float) -> float:
    """Ikki davr o'rtasidagi foiz o'zgarishini hisoblaydi."""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


async def _stats_for_period(
    db: AsyncSession,
    user_id: int,
    start: datetime,
    end: datetime,
) -> dict:
    """Berilgan vaqt oralig'idagi statistika."""
    period_filter = and_(
        Transaction.user_id == user_id,
        Transaction.created_at >= start,
        Transaction.created_at < end,
    )

    total = (
        await db.execute(
            select(func.count()).select_from(Transaction).where(period_filter)
        )
    ).scalar() or 0

    success = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                and_(
                    period_filter,
                    Transaction.status == TransactionStatus.COMPLETED,
                )
            )
        )
    ).scalar() or 0

    stars = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                and_(
                    period_filter,
                    Transaction.transaction_type == TransactionType.STARS,
                    Transaction.status == TransactionStatus.COMPLETED,
                )
            )
        )
    ).scalar() or 0

    premium = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                and_(
                    period_filter,
                    Transaction.transaction_type == TransactionType.PREMIUM,
                    Transaction.status == TransactionStatus.COMPLETED,
                )
            )
        )
    ).scalar() or 0

    revenue_gram = (
        await db.execute(
            select(func.sum(Transaction.amount))
            .select_from(Transaction)
            .where(
                and_(
                    period_filter,
                    Transaction.status == TransactionStatus.COMPLETED,
                    Transaction.currency == "GRAM",
                )
            )
        )
    ).scalar() or 0.0

    revenue_usdt = (
        await db.execute(
            select(func.sum(Transaction.amount))
            .select_from(Transaction)
            .where(
                and_(
                    period_filter,
                    Transaction.status == TransactionStatus.COMPLETED,
                    Transaction.currency == "USDT",
                )
            )
        )
    ).scalar() or 0.0

    return {
        "total": total,
        "success": success,
        "stars": stars,
        "premium": premium,
        "revenue_gram": float(revenue_gram),
        "revenue_usdt": float(revenue_usdt),
        "success_rate": round(success / total * 100, 1) if total > 0 else 0.0,
    }


@router.get("/dashboard")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard statistikasi"""
    user_id = current_user.id

    # Umumiy (butun davr) statistika
    all_time_start = datetime(2000, 1, 1, tzinfo=timezone.utc)
    total = await _stats_for_period(
        db,
        user_id,
        all_time_start,
        datetime.now(timezone.utc) + timedelta(days=1),
    )

    # Oxirgi 30 kun vs oldingi 30 kun — trend taqqoslash
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=PERIOD_DAYS)
    previous_start = period_start - timedelta(days=PERIOD_DAYS)

    current = await _stats_for_period(db, user_id, period_start, now)
    previous = await _stats_for_period(db, user_id, previous_start, period_start)

    # Oxirgi 7 kunlik tranzaksiyalar
    week_ago = now - timedelta(days=7)
    weekly_transactions = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                and_(
                    Transaction.user_id == user_id,
                    Transaction.created_at >= week_ago,
                )
            )
        )
    ).scalar() or 0

    return {
        "total_transactions": total["total"],
        "successful_transactions": total["success"],
        "total_stars": total["stars"],
        "total_premium": total["premium"],
        "total_revenue_gram": round(total["revenue_gram"], 2),
        "total_revenue_usdt": round(total["revenue_usdt"], 2),
        "success_rate": total["success_rate"],
        "weekly_transactions": weekly_transactions,
        "wallet_balance_gram": current_user.balance_gram,
        "wallet_balance_usdt": current_user.balance_usdt,
        "changes": {
            "transactions": _pct_change(current["total"], previous["total"]),
            "stars": _pct_change(current["stars"], previous["stars"]),
            "premium": _pct_change(current["premium"], previous["premium"]),
            "success_rate": _pct_change(
                current["success_rate"], previous["success_rate"]
            ),
            "revenue_gram": _pct_change(
                current["revenue_gram"], previous["revenue_gram"]
            ),
            "revenue_usdt": _pct_change(
                current["revenue_usdt"], previous["revenue_usdt"]
            ),
        },
    }


@router.get("/chart")
async def get_chart_data(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Chart uchun ma'lumotlar (barcha kunlar 0 bilan to'ldiriladi)."""
    days = max(1, min(days, 90))
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=days - 1)

    stmt = select(
        func.date(Transaction.created_at).label("date"),
        func.count().label("count"),
        func.sum(Transaction.amount).label("revenue"),
    ).where(
        and_(
            Transaction.user_id == current_user.id,
            Transaction.status == TransactionStatus.COMPLETED,
            Transaction.created_at >= start_date,
        )
    ).group_by(func.date(Transaction.created_at)).order_by(func.date(Transaction.created_at))

    result = await db.execute(stmt)
    rows = result.all()

    by_date = {str(row.date): row for row in rows}

    labels = []
    transactions = []
    revenue = []
    for offset in range(days):
        day = start_date + timedelta(days=offset)
        label = str(day)
        row = by_date.get(label)
        labels.append(label)
        transactions.append(row.count if row else 0)
        revenue.append(float(row.revenue) if row else 0.0)

    return {
        "labels": labels,
        "transactions": transactions,
        "revenue": revenue,
    }
