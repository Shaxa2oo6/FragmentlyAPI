"""Avtomatik IP bloklash xizmati.

Ruxsat etilmagan email bilan admin panelga kirish urinishi bo'lganda:
1) Urinish audit/login jurnaliga yoziladi
2) IP manzil blocked_ips jadvaliga qo'shiladi (birinchi urinishdayoq, Variant A)
3) Adminlarga Telegram orqali ogohlantirish yuboriladi
4) Umumiy xabar bilan 403 qaytariladi
"""

import logging

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import AdminLoginLog, BlockedIP

logger = logging.getLogger(__name__)


def get_client_ip(request: Request) -> str:
    """Proksi-royihalarni hisobga olgan holda mijoz IP manzilini aniqlaydi."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "127.0.0.1"


async def is_ip_blocked(db: AsyncSession, ip_address: str) -> bool:
    """IP manzil blocked_ips jadvalida (va muddati tugamagan) bo'lsa True qaytaradi."""
    from datetime import datetime, timezone

    if not ip_address:
        return False
    stmt = select(BlockedIP).where(BlockedIP.ip_address == ip_address)
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()
    if not entry:
        return False
    if entry.blocked_until and entry.blocked_until <= datetime.now(timezone.utc):
        return False
    return True


async def log_login_attempt(
    db: AsyncSession,
    email: str,
    ip_address: str,
    success: bool,
    reason: str,
    user_agent: str = "Unknown",
) -> None:
    """AdminLoginLog jadvaliga urinishni yozadi."""
    db.add(
        AdminLoginLog(
            username=email or "unknown",
            status=("SUCCESS" if success else reason),
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    await db.commit()


async def add_ip_to_blocklist(
    db: AsyncSession,
    ip_address: str,
    reason: str,
    triggered_by_email: str | None = None,
    blocked_until=None,
) -> BlockedIP | None:
    """IP manzilni blocked_ips jadvaliga qo'shadi (allaqachon bo'lsa o'tkazib yuboradi)."""
    if not ip_address or ip_address in ("127.0.0.1", "::1", "localhost"):
        logger.info("Localhost IP bloklanmaydi: %s", ip_address)
        return None

    stmt = select(BlockedIP).where(BlockedIP.ip_address == ip_address)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        return existing

    entry = BlockedIP(
        ip_address=ip_address,
        reason=reason,
        blocked_until=blocked_until,
        triggered_by_email=triggered_by_email,
    )
    db.add(entry)
    await db.commit()
    logger.warning("IP avtomatik bloklandi: %s (reason: %s)", ip_address, reason)
    return entry


async def notify_admins_security_alert(message: str) -> None:
    """Xavfsizlik ogohlantirishini Telegram bot orqali admin chatiga yuboradi."""
    bot_token = (settings.SECURITY_ALERT_TELEGRAM_BOT_TOKEN or "").strip()
    chat_id = (settings.SECURITY_ALERT_TELEGRAM_CHAT_ID or "").strip()
    if not bot_token or not chat_id:
        logger.info("Telegram ogohlantirish sozlanmagan (SECURITY_ALERT_TELEGRAM_*). Xabar: %s", message)
        return

    try:
        import httpx

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={"chat_id": chat_id, "text": message})
            if resp.status_code != 200:
                logger.warning("Telegram alert yuborilmadi: %s", resp.text)
    except Exception as exc:
        logger.warning("Telegram alert xatosi: %s", exc)


async def handle_unauthorized_admin_attempt(
    db: AsyncSession, email: str, ip: str, request: Request, reason: str = "email_not_whitelisted"
) -> None:
    """Ruxsat etilmagan admin kirish urinishida to'liq bloklash oqimini ishga tushiradi."""
    user_agent = request.headers.get("user-agent", "Unknown")

    await log_login_attempt(
        db,
        email=email,
        ip_address=ip,
        success=False,
        reason=reason,
        user_agent=user_agent,
    )

    await add_ip_to_blocklist(
        db,
        ip_address=ip,
        reason=f"Ruxsatsiz admin kirish urinishi. Email: {email}",
        triggered_by_email=email,
        blocked_until=None,
    )

    await notify_admins_security_alert(
        f"\u26a0\ufe0f Admin panelga ruxsatsiz kirish urinishi!\n"
        f"Email: {email}\nIP: {ip}\n"
        f"IP manzil avtomatik ravishda bloklandi."
    )
