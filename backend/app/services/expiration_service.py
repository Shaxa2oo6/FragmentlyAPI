"""
Obuna muddati tugagan foydalanuvchilarni avtomatik Free tarifga qaytaruvchi xizmat.

3 ta himoya qatlami:
  A. Background worker — `check_expired_subscriptions` (SQL bulk UPDATE,
     davriy + server ishga tushganda bir marta ishlaydi).
  B. So'rov vaqtidagi tekshiruv — `downgrade_expired_user`
     (get_current_user dependency'sida har bir autentifikatsiyalangan so'rovda).
  C. Rate-limit rezolyutsiyasi — `_resolve_rpm` (middleware) muddati o'tgan
     foydalanuvchini Free limitlar bilan hisoblaydi.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Tariff, User

logger = logging.getLogger(__name__)

# Free tarif komissiyasi — DB'da Free tarifi mavjud bo'lmasa fallback
FREE_COMMISSION_RATE = 0.05


def _as_utc(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def is_expired(user: User) -> bool:
    """Obuna muddati o'tganmi? Free tarifda bo'lgan yoki muddatsiz obunachilar emas."""
    if not user or not user.tariff_type or user.tariff_type == "free":
        return False
    exp = _as_utc(user.tariff_expires_at)
    if exp is None:
        return False
    return exp <= datetime.now(timezone.utc)


async def _free_tariff(db: AsyncSession):
    """DB'da Free tarif yozuvini qidiradi (topilmasa None)."""
    return (await db.execute(
        select(Tariff).where(func.lower(Tariff.name) == "free").limit(1)
    )).scalar_one_or_none()


async def downgrade_expired_user(db: AsyncSession, user: User) -> bool:
    """Bitta foydalanuvchini Free tarifga qaytaradi (Layer B, so'rov vaqtida).

    Qaytish: o'zgarish bo'lsa True. Commit chaqiruvchi tomonidan amalga oshiriladi.
    """
    if not is_expired(user):
        return False

    free = await _free_tariff(db)
    user.tariff_type = "free"
    user.tariff_plan = "Free"
    user.tariff_id = free.id if free else None
    user.commission_rate = FREE_COMMISSION_RATE
    user.tariff_expires_at = None
    user.auto_renew = False
    return True


async def check_expired_subscriptions(db: AsyncSession) -> int:
    """Muddati tugagan barcha obunachilarni Free ga o'tkazadi (Layer A).

    Spec'dagi SQL bilan ekvivalent (schema mapping: user.tariff_type = tarif
    kaliti, user.tariff_id = tariffs.id):
      UPDATE users
      SET tariff_id = (SELECT id FROM tariffs WHERE name = 'Free' LIMIT 1),
          tariff_expires_at = NULL
      WHERE tariff_expires_at IS NOT NULL
        AND tariff_expires_at <= NOW()
        AND tariff_id != (SELECT id FROM tariffs WHERE name = 'Free' LIMIT 1);
    Bunga tariff_type/tariff_plan/commission_rate ham sinxron qilinadi —
    aks holda muddati o'tgan foydalanuvchi tariff_type'da paid bo'lib qoladi.

    Qaytish: o'zgartirilgan foydalanuvchilar soni.
    """
    now = datetime.now(timezone.utc)
    free = await _free_tariff(db)
    free_id = free.id if free else None

    stmt = text("""
        UPDATE users
        SET tariff_type = 'free',
            tariff_plan = 'Free',
            tariff_id = :free_id,
            commission_rate = :rate,
            auto_renew = FALSE,
            tariff_expires_at = NULL
        WHERE tariff_expires_at IS NOT NULL
          AND tariff_expires_at <= :now
          AND tariff_type != 'free'
    """)
    count = (await db.execute(stmt, {
        "free_id": free_id, "rate": FREE_COMMISSION_RATE, "now": now,
    })).rowcount or 0

    await db.commit()
    if count:
        logger.info("Expired subscriptions downgraded to Free: %s", count)
    return count
