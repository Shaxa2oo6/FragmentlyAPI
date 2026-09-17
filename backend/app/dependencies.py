from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_token
from app.database import get_db
from app.models import User, UserRole

security = HTTPBearer(auto_error=False)


async def _ensure_active_subscription(user: User, db: AsyncSession) -> None:
    """Layer B: muddati o'tgan obunachini so'rov vaqtida Free ga qaytaradi."""
    from app.services.expiration_service import downgrade_expired_user, is_expired

    if is_expired(user) and await downgrade_expired_user(db, user):
        await db.commit()


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    # 1) API kalit orqali autentifikatsiya (X-API-Key / X-API-Token / x-api-key / Bearer frag_...)
    api_token = (
        request.headers.get("X-API-Key")
        or request.headers.get("X-API-Token")
        or request.headers.get("x-api-key")
    )
    auth = request.headers.get("Authorization") or ""
    if not api_token and auth.lower().startswith("bearer "):
        possible_token = auth[7:].strip()
        if possible_token.startswith("frag_"):
            api_token = possible_token

    if api_token:
        result = await db.execute(select(User).where(User.api_token == api_token.strip()))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "INVALID_API_KEY",
                    "message": "Kiritilgan API Kalit noto'g'ri yoki yaroqsiz.",
                },
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "USER_INACTIVE", "message": "Foydalanuvchi hisobi faol emas."},
            )
        await _ensure_active_subscription(user, db)
        return user

    # 2) Bearer JWT token orqali autentifikatsiya
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "API_KEY_MISSING",
                "message": "API Kalit kiritilmagan. Iltimos, Profil Sozlamalaridan API kalitingizni oling va Header'da yuboring.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "INVALID_API_KEY",
                "message": "Kiritilgan API Kalit yoki Token noto'g'ri va muddati o'tgan.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "INVALID_TOKEN_PAYLOAD", "message": "Token strukturasi noto'g'ri"},
        )

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "USER_NOT_FOUND", "message": "Foydalanuvchi topilmadi"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "USER_INACTIVE", "message": "Foydalanuvchi hisobi faol emas."},
        )

    await _ensure_active_subscription(user, db)
    return user


async def get_current_admin(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Admin, Superadmin yoki Support bo'lgan foydalanuvchilar + IP Whitelist Guard"""
    if user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUPPORT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin panelga kirish huquqiga ega emassiz (403 Forbidden)"
        )

    # Check admin_users table as well if present
    from app.models import AdminUser, AllowedIP
    admin_check = await db.execute(select(AdminUser).where(AdminUser.email == user.email))
    admin_entry = admin_check.scalar_one_or_none()
    if not admin_entry and user.role not in (UserRole.SUPERADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Ushbu email ({user.email}) admin_users ro'yxatida mavjud emas"
        )

    # IP Whitelist Validation
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "127.0.0.1")
    )

    stmt = select(AllowedIP)
    res = await db.execute(stmt)
    allowed_list = res.scalars().all()

    if allowed_list:
        allowed_ips = {ip.ip_address for ip in allowed_list}
        allowed_ips.update({"127.0.0.1", "::1", "localhost", "127.0.0.1:5174", "localhost:5174"})
        if client_ip not in allowed_ips:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sizning IP manzilingiz ({client_ip}) Admin Panel uchun ruxsat etilmagan (IP Whitelist Block)",
            )

    return user


def require_admin_or_superadmin(user: User = Depends(get_current_user)) -> User:
    """Faqat Admin yoki Superadmin (Support o'zgartirish qila olmaydi)"""
    if user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ushbu amalni bajarish uchun Admin huquqi talab etiladi"
        )
    return user


def require_superadmin(user: User = Depends(get_current_user)) -> User:
    """Faqat Superadmin"""
    if user.role != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ushbu o'zgartirish faqat Superadmin tomonidan bajarilishi mumkin"
        )
    return user


def get_current_reseller(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.RESELLER):
        raise HTTPException(status_code=403, detail="Reseller privileges required")
    return user


# Purchase (buy) endpointlari uchun foydalanuvchi tarifiga asoslangan
# sliding-window rate limiter (in-memory).
_PURCHASE_HISTORY: dict[int, list[float]] = {}


async def purchase_rate_limit(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Foydalanuvchining faol tarifidagi `rate_limit_per_min` asosida cheklaydi.

    Limit oshsa `429 Too Many Requests` qaytaradi. Endpoint'larga
    `_ = Depends(purchase_rate_limit)` sifatida qo'shiladi.
    """
    import time

    from app.services.tariffs import DEFAULT_RPM, db_requests_per_minute

    rpm = await db_requests_per_minute(db, current_user.tariff_type or "free")
    if rpm <= 0:
        rpm = DEFAULT_RPM

    now = time.time()
    history = _PURCHASE_HISTORY.setdefault(current_user.id, [])
    history[:] = [t for t in history if t >= now - 60.0]

    if len(history) >= rpm:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"So'rovlar soni cheklangan (tarifingiz: {rpm}/daqiqa). "
                "Birozdan so'ng qayta urinib ko'ring."
            ),
        )

    history.append(now)
    return current_user


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Foydalanuvchi autentifikatsiyalangan bo'lsa User qaytaradi, bo'lmasa None (xato tashlamaydi)."""
    try:
        return await get_current_user(request, credentials, db)
    except Exception:
        return None