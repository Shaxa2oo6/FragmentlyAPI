# backend/app/services/tariffs.py
"""
Tarif tizimi va komissiya hisoblash servisi.

Tariflar:
  Free  -> 0 GRAM / 0 USDT / komissiya 5% / 100 so'rov-min / Standart
  Lite  -> 1.61 GRAM yoki 2.5 USDT / komissiya 2.5% / 30 so'rov-min / Standart
  Pro   -> 4.5 GRAM yoki 7 USDT / komissiya 0.5% / 100 so'rov-min / VIP 24/7 + Webhook

Tarif muddati 30 kun.
"""

from dataclasses import dataclass, field
from typing import Dict, List

TARIFF_DAYS = 30

FREE = "free"
LITE = "lite"
PRO = "pro"

# Komissiyalar (foiz: 0.05 = 5%)
DEFAULT_COMMISSION = 0.05
DEFAULT_RPM = 10


@dataclass
class TariffPlan:
    id: str
    name: str
    price_gram: float
    price_usdt: float
    commission_percent: float  # 5.0 % ko'rinishida
    requests_per_minute: int
    features: List[str]
    badge: str = ""


TARIFFS: Dict[str, TariffPlan] = {
    FREE: TariffPlan(
        id=FREE,
        name="Free",
        price_gram=0.0,
        price_usdt=0.0,
        commission_percent=5.0,
        requests_per_minute=10,
        features=["Daqiqasiga 10 ta so'rov", "Standart qo'llab-quvvatlash", "5% komissiya"],
        badge="standart",
    ),
    LITE: TariffPlan(
        id=LITE,
        name="Lite",
        price_gram=1.61,
        price_usdt=2.2,
        commission_percent=2.5,
        requests_per_minute=30,
        features=[
            "Daqiqasiga 30 ta so'rov",
            "Tez API javob",
            "2.5% komissiya",
            "30 kun faollik",
        ],
        badge="tezkor",
    ),
    PRO: TariffPlan(
        id=PRO,
        name="Pro",
        price_gram=2.5,
        price_usdt=3.3,
        commission_percent=0.5,
        requests_per_minute=100,
        features=[
            "Daqiqasiga 100 ta so'rov",
            "0.5% komissiya",
            "VIP 24/7 qo'llab-quvvatlash",
            "Shaxsiy Webhook xabarnomalari",
            "30 kun faollik",
        ],
        badge="vip",
    ),
}


def get_tariff(value: str) -> TariffPlan:
    """Tarif nomi bo'yicha plan qaytaradi (noto'g'ri bo'lsa Free)."""
    key = (value or FREE).lower()
    return TARIFFS.get(key, TARIFFS[FREE])


def commission_rate(tariff_name: str = FREE) -> float:
    """Tarif uchun komissiya stavkasi (0.015 kabi)."""
    return round(get_tariff(tariff_name).commission_percent / 100.0, 4)


def requests_per_minute(tariff_name: str = FREE) -> int:
    return get_tariff(tariff_name).requests_per_minute


def compute_commission(total_amount: float, rate: float) -> Dict[str, float]:
    """
    Komissiyani hisoblaydi:
      commission_amount = total_amount * rate
      net_amount        = total_amount - commission_amount
    """
    rate = round(float(rate or 0.0), 4)
    commission_amount = round(total_amount * rate, 6)
    net_amount = round(total_amount - commission_amount, 6)
    return {
        "total_amount": round(total_amount, 6),
        "commission_rate": rate,
        "commission_amount": commission_amount,
        "net_amount": net_amount,
    }


def apply_tariff_to_user(user, tariff_name: str, now=None) -> None:
    """Foydalanuvchiga tarifni qo'llaydi (30 kunlik faollik muddati)."""
    from datetime import datetime, timedelta, timezone

    plan = get_tariff(tariff_name)
    user.tariff_type = plan.id
    user.tariff_plan = plan.name
    user.commission_rate = round(plan.commission_percent / 100.0, 4)
    base = now or datetime.now(timezone.utc)
    user.tariff_expires_at = base + timedelta(days=TARIFF_DAYS)
    user.is_verified = True


async def apply_tariff_to_user_db(db, user, tariff_name: str, duration_days: int = TARIFF_DAYS) -> None:
    """Foydalanuvchiga tarifni DB Tariff obyekti, FK, type, plan, komissiya va expire muddati bilan atomar biriktiradi."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select, func
    from app.models import Tariff

    slug = (tariff_name or FREE).strip().lower()
    stmt = select(Tariff).where(func.lower(Tariff.name) == slug)
    res = await db.execute(stmt)
    tariff_obj = res.scalar_one_or_none()

    if tariff_obj:
        user.tariff_id = tariff_obj.id
        user.tariff_plan = tariff_obj.name
        user.tariff_type = slug
        user.commission_rate = round((tariff_obj.commission_percent or 0.0) / 100.0, 4)
    else:
        plan = get_tariff(slug)
        user.tariff_id = None
        user.tariff_plan = plan.name
        user.tariff_type = plan.id
        user.commission_rate = round(plan.commission_percent / 100.0, 4)

    now_utc = datetime.now(timezone.utc)
    if duration_days is None or duration_days <= 0:
        # Doimiy muddat — obuna tugamaydi
        user.tariff_expires_at = None
    else:
        user.tariff_expires_at = now_utc + timedelta(days=duration_days)
    user.is_verified = True



def serialize_tariff(t) -> dict:
    """DB Tariff modelini client-facing canonical formatga aylantiradi.

    Barcha qiymatlar (narx, komissiya, rate-limit, muddat, xususiyatlar, badge)
    to'g'ridan-to'g'ri DB Tariff jadvalidan olinadi. Hardcoded TARIFFS katalogi
    faqat features/badge DB'da to'ldirilmagan bo'lsa fallback sifatida ishlatiladi.
    """
    features = []
    if getattr(t, "features", None):
        raw = t.features
        if isinstance(raw, str):
            features = [f.strip() for f in raw.split("\n") if f.strip()]
        elif isinstance(raw, list):
            features = [str(f).strip() for f in raw if str(f).strip()]
    if not features:
        plan = TARIFFS.get((t.name or "").strip().lower())
        features = list(plan.features) if plan else []

    badge = getattr(t, "badge", None) or ""
    if not badge:
        plan = TARIFFS.get((t.name or "").strip().lower())
        badge = plan.badge if plan else ""

    duration = getattr(t, "duration_days", None)
    # 0 = doimiy (muddati tugamaydi); None = legacy default
    if duration is None:
        duration = TARIFF_DAYS

    return {
        "id": (t.name or "").strip().lower(),
        "name": t.name,
        "description": t.description,
        "price_ton": t.price_gram,
        # USDT to'lovi butunlay olib tashlangan — narx faqat TON/GRAM da
        "price_usdt": 0.0,
        "commission_fee": t.commission_percent,
        "rate_limit": t.rate_limit_per_min,
        "features": features,
        "badge": badge,
        "duration_days": duration,
        "is_active": bool(t.is_active),
        # Legacy aliaslar (eski frontend konsumatorlar bilan muvofiqlik)
        "price_gram": t.price_gram,
        "requests_per_minute": t.rate_limit_per_min,
        "rate_limit_per_min": t.rate_limit_per_min,
        "commission_percent": t.commission_percent,
    }


async def get_db_tariff(db, tariff_name: str):
    """Tarif nomi bo'yicha DB Tariff yozuvini qaytaradi (topilmasa None)."""
    from sqlalchemy import func, select

    from app.models import Tariff

    if not tariff_name:
        return None
    res = await db.execute(
        select(Tariff).where(func.lower(Tariff.name) == tariff_name.strip().lower())
    )
    return res.scalar_one_or_none()


async def db_requests_per_minute(db, tariff_name: str = FREE) -> int:
    """Rate-limit (req/min) — admin sozlamasidan, aks holda hardcoded katalogdan."""
    t = await get_db_tariff(db, tariff_name)
    if t and t.is_active:
        return int(t.rate_limit_per_min)
    return requests_per_minute(tariff_name)


async def db_commission_percent(db, tariff_name: str = FREE) -> float:
    """Komissiya foizi — admin sozlamasidan, aks holda hardcoded katalogdan."""
    t = await get_db_tariff(db, tariff_name)
    if t and t.is_active:
        return float(t.commission_percent)
    return get_tariff(tariff_name).commission_percent


async def ensure_default_tariffs(db) -> None:
    """Agar DB'da tariflar bo'lmasa, standart (Free/Lite/Pro) demo yozuvlarini yaratadi.

    Mavjud yozuvlarga tegmaydi — admin panelda kiritilgan o'zgarishlar saqlanadi.
    Yangi yozuvlar barcha maydonlar bilan to'liq yaratiladi:
    nomi, komissiya, muddat (duration_days), narx (TON/USDT), so'rovlar soni
    (rate_limit_per_min), xususiyatlar (features), badge.
    """
    from sqlalchemy import select

    from app.models import Tariff

    res = await db.execute(select(Tariff))
    if res.scalars().first():
        return

    descriptions = {
        FREE: "Boshlang'ich bepul tarif",
        LITE: "O'rta hajm resurslar, past komissiya",
        PRO: "Maksimallashtirilgan API limitlar, 0.5% komissiya",
    }
    for plan in TARIFFS.values():
        db.add(
            Tariff(
                name=plan.name,
                description=descriptions.get(plan.id),
                price_gram=plan.price_gram,
                price_usdt=plan.price_usdt,
                commission_percent=plan.commission_percent,
                rate_limit_per_min=plan.requests_per_minute,
                duration_days=TARIFF_DAYS,
                features="\n".join(plan.features),
                badge=plan.badge,
                is_active=True,
            )
        )
    await db.commit()