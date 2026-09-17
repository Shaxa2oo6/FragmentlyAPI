"""
Analytics API v1 - REAL tranzaksiya statistikasi (SQL aggregation).

Endpoints:
- GET /api/v1/analytics/dashboard (va /dashboard/)
- GET /api/v1/analytics/summary (va /summary/)
- GET /api/v1/analytics/chart (va /chart/)
- GET /api/v1/analytics/status-distribution (va /status-distribution/)

Barcha qiymatlar Transaction jadvalidan to'g'ridan-to'g'ri SQL aggregation orqali olinadi.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import PaymentMethod, Transaction, TransactionStatus, TransactionType, User

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics v1"])

logger = logging.getLogger(__name__)

CHART_DAYS = 30

# Foydalanuvchi analytics'i faqat Telegram Stars / Premium buyurtmalarini o'z ichiga oladi.
# Tarif xaridlari (TARIFF), komissiya (COMMISSION) va boshqa xizmat turlari qo'shilmaydi.
STARS_PREMIUM = Transaction.transaction_type.in_(
    [TransactionType.STARS, TransactionType.PREMIUM]
)


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
    """Berilgan vaqt oralig'idagi REAL statistika (SQL aggregation)."""
    period_filter = and_(
        Transaction.user_id == user_id,
        Transaction.created_at >= start,
        Transaction.created_at < end,
    )

    def _agg(extra=None):
        conds = [
            period_filter,
            STARS_PREMIUM,
            Transaction.status == TransactionStatus.COMPLETED,
        ]
        if extra is not None:
            conds.append(extra)
        return and_(*conds)

    total = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(period_filter, STARS_PREMIUM)
        )
    ).scalar() or 0

    success = (
        await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(_agg())
        )
    ).scalar() or 0

    stars = (
        await db.execute(
            select(func.sum(Transaction.amount)).where(
                _agg(Transaction.transaction_type == TransactionType.STARS)
            )
        )
    ).scalar() or 0.0

    # Sotilgan Stars SONI (quantity): 50, 100, 500 va h.k.
    stars_count = (
        await db.execute(
            select(func.sum(Transaction.quantity)).where(
                _agg(Transaction.transaction_type == TransactionType.STARS)
            )
        )
    ).scalar() or 0.0

    premium = (
        await db.execute(
            select(func.sum(Transaction.amount)).where(
                _agg(Transaction.transaction_type == TransactionType.PREMIUM)
            )
        )
    ).scalar() or 0.0

    gram_turnover = (
        await db.execute(
            select(func.sum(Transaction.amount)).where(
                _agg(Transaction.payment_method == PaymentMethod.GRAM)
            )
        )
    ).scalar() or 0.0

    usdt_turnover = (
        await db.execute(
            select(func.sum(Transaction.amount)).where(
                _agg(Transaction.payment_method == PaymentMethod.USDT)
            )
        )
    ).scalar() or 0.0

    return {
        "total": int(total),
        "success": int(success),
        "stars": float(stars),
        "stars_count": float(stars_count),
        "premium": float(premium),
        "gram_turnover": float(gram_turnover),
        "usdt_turnover": float(usdt_turnover),
        "success_rate": round(success / total * 100, 1) if total > 0 else 0.0,
    }


async def _build_dashboard_payload(user_id: int, db: AsyncSession) -> dict:
    """Dashboard / Summary uchun umumiy natija tayyorlaydi."""
    all_time_start = datetime(2000, 1, 1, tzinfo=timezone.utc)
    total = await _stats_for_period(
        db,
        user_id,
        all_time_start,
        datetime.now(timezone.utc) + timedelta(days=1),
    )

    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=CHART_DAYS)
    previous_start = period_start - timedelta(days=CHART_DAYS)

    current = await _stats_for_period(db, user_id, period_start, now)
    previous = await _stats_for_period(db, user_id, previous_start, period_start)

    today = now.date()
    start_date = today - timedelta(days=CHART_DAYS - 1)

    rows = (
        await db.execute(
            select(
                func.date(Transaction.created_at).label("date"),
                func.count().label("count"),
                func.sum(case(
                    (Transaction.transaction_type == TransactionType.STARS, Transaction.quantity),
                    else_=0.0,
                )).label("stars"),
                func.sum(case(
                    (Transaction.transaction_type == TransactionType.PREMIUM, Transaction.amount),
                    else_=0.0,
                )).label("premium"),
                func.sum(case(
                    (Transaction.payment_method == PaymentMethod.GRAM, Transaction.amount),
                    else_=0.0,
                )).label("gram"),
                func.sum(case(
                    (Transaction.payment_method == PaymentMethod.USDT, Transaction.amount),
                    else_=0.0,
                )).label("usdt"),
            )
            .where(
                Transaction.user_id == user_id,
                STARS_PREMIUM,
                Transaction.status == TransactionStatus.COMPLETED,
                Transaction.created_at >= start_date,
            )
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()

    by_date = {str(r.date): r for r in rows}

    labels: list = []
    transactions: list = []
    stars_series: list = []
    premium_series: list = []
    gram_series: list = []
    usdt_series: list = []
    for offset in range(CHART_DAYS):
        day = start_date + timedelta(days=offset)
        label = day.isoformat()
        row = by_date.get(label)
        labels.append(label)
        transactions.append(int(row.count) if row else 0)
        stars_series.append(round(float(row.stars), 2) if row else 0.0)
        premium_series.append(round(float(row.premium), 2) if row else 0.0)
        gram_series.append(round(float(row.gram), 2) if row else 0.0)
        usdt_series.append(round(float(row.usdt), 2) if row else 0.0)

    revenue_series = [
        round(gram_series[i] + usdt_series[i], 2) for i in range(CHART_DAYS)
    ]

    return {
        "success": True,
        "total": total["total"],
        "successful": total["success"],
        "success_rate": total["success_rate"],
        "total_stars": round(total["stars_count"], 2),
        "total_premium": round(total["premium"], 2),
        "gram_turnover": round(total["gram_turnover"], 2),
        "usdt_turnover": round(total["usdt_turnover"], 2),
        "weekly_transactions": current["total"],
        "changes": {
            "transactions": _pct_change(current["total"], previous["total"]),
            "stars": _pct_change(current["stars"], previous["stars"]),
            "premium": _pct_change(current["premium"], previous["premium"]),
            "success_rate": _pct_change(
                current["success_rate"], previous["success_rate"]
            ),
            "revenue_gram": _pct_change(
                current["gram_turnover"], previous["gram_turnover"]
            ),
            "revenue_usdt": _pct_change(
                current["usdt_turnover"], previous["usdt_turnover"]
            ),
        },
        "chart_30d": {
            "labels": labels,
            "transactions": transactions,
            "revenue": revenue_series,
            "stars": stars_series,
            "premium": premium_series,
            "gram_turnover": gram_series,
            "usdt_turnover": usdt_series,
        },
    }


@router.get("/dashboard")
@router.get("/dashboard/")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Joriy foydalanuvchi uchun REAL dashboard statistikasi."""
    return await _build_dashboard_payload(current_user.id, db)


@router.get("/summary")
@router.get("/summary/")
async def get_summary_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GET /api/v1/analytics/summary/ uchun backend endpoint handler."""
    return await _build_dashboard_payload(current_user.id, db)


@router.get("/chart")
@router.get("/chart/")
async def get_chart_data(
    period: str = Query("30d", description="Vaqt oralig'i (24h, 7d, 30d, yearly, all)"),
    metric: str = Query("volume", description="Metrika (volume, stars, premium, revenue)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GET /api/v1/analytics/chart/ endpoint — grafik ma'lumotlari."""
    now = datetime.now(timezone.utc)
    if period in ("24h", "1d"):
        start_date = now - timedelta(hours=24)
        group_days = 1
    elif period in ("7d", "week"):
        start_date = now - timedelta(days=7)
        group_days = 7
    elif period in ("yearly", "year", "365d"):
        start_date = now - timedelta(days=365)
        group_days = 365
    elif period == "all":
        start_date = datetime(2000, 1, 1, tzinfo=timezone.utc)
        group_days = 365
    else:  # 30d
        start_date = now - timedelta(days=30)
        group_days = 30

    rows = (
        await db.execute(
            select(
                func.date(Transaction.created_at).label("date"),
                func.count().label("count"),
                func.sum(case(
                    (Transaction.transaction_type == TransactionType.STARS, Transaction.amount),
                    else_=0.0,
                )).label("stars"),
                func.sum(case(
                    (Transaction.transaction_type == TransactionType.PREMIUM, Transaction.amount),
                    else_=0.0,
                )).label("premium"),
                func.sum(case(
                    (Transaction.payment_method == PaymentMethod.GRAM, Transaction.amount),
                    else_=0.0,
                )).label("gram"),
                func.sum(case(
                    (Transaction.payment_method == PaymentMethod.USDT, Transaction.amount),
                    else_=0.0,
                )).label("usdt"),
                func.sum(Transaction.amount).label("volume"),
            )
            .where(
                Transaction.user_id == current_user.id,
                STARS_PREMIUM,
                Transaction.status == TransactionStatus.COMPLETED,
                Transaction.created_at >= start_date,
            )
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()

    labels = [str(r.date) for r in rows]
    count_data = [int(r.count) for r in rows]
    stars_data = [round(float(r.stars), 2) for r in rows]
    premium_data = [round(float(r.premium), 2) for r in rows]
    volume_data = [round(float(r.volume), 2) for r in rows]
    gram_data = [round(float(r.gram), 2) for r in rows]
    usdt_data = [round(float(r.usdt), 2) for r in rows]

    return {
        "success": True,
        "period": period,
        "metric": metric,
        "labels": labels,
        "data": volume_data if metric == "volume" else (stars_data if metric == "stars" else premium_data),
        "datasets": {
            "volume": volume_data,
            "gram": gram_data,
            "usdt": usdt_data,
            "stars": stars_data,
            "premium": premium_data,
            "count": count_data,
        },
    }


@router.get("/status-distribution")
@router.get("/status-distribution/")
async def get_status_distribution(
    period: str = Query("30d", description="Vaqt oralig'i (24h, 7d, 30d, yearly, all)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GET /api/v1/analytics/status-distribution/ endpoint."""
    now = datetime.now(timezone.utc)
    if period in ("24h", "1d"):
        start_date = now - timedelta(hours=24)
    elif period in ("7d", "week"):
        start_date = now - timedelta(days=7)
    elif period in ("yearly", "year", "365d"):
        start_date = now - timedelta(days=365)
    elif period == "all":
        start_date = datetime(2000, 1, 1, tzinfo=timezone.utc)
    else:
        start_date = now - timedelta(days=30)

    rows = (
        await db.execute(
            select(Transaction.status, func.count().label("cnt"))
            .where(
                Transaction.user_id == current_user.id,
                STARS_PREMIUM,
                Transaction.created_at >= start_date,
            )
            .group_by(Transaction.status)
        )
    ).all()

    counts = {r.status.value if hasattr(r.status, "value") else str(r.status): int(r.cnt) for r in rows}

    completed = counts.get("completed", 0)
    pending = counts.get("pending", 0)
    failed = counts.get("failed", 0)
    cancelled = counts.get("cancelled", 0)
    total = completed + pending + failed + cancelled

    return {
        "success": True,
        "period": period,
        "total": total,
        "completed": completed,
        "pending": pending,
        "failed": failed,
        "cancelled": cancelled,
        "distribution": [
            {"name": "Muvaffaqiyatli", "status": "completed", "value": completed, "color": "#2ED9A0"},
            {"name": "Kutilmoqda", "status": "pending", "value": pending, "color": "#F59E0B"},
            {"name": "Xatolik", "status": "failed", "value": failed, "color": "#EF4444"},
            {"name": "Bekor qilingan", "status": "cancelled", "value": cancelled, "color": "#6B7280"},
        ],
    }
