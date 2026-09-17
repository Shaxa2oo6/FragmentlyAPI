from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_token
from app.config import settings
from app.database import get_db
from app.models import AdminUser, AllowedIP, User, UserRole

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

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
            detail="Admin panelga kirish huquqiga ega emassiz (403 Forbidden)",
        )

    # Check admin_users table
    admin_check = await db.execute(select(AdminUser).where(AdminUser.email == user.email))
    admin_entry = admin_check.scalar_one_or_none()
    if not admin_entry and user.role not in (UserRole.SUPERADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Ushbu email ({user.email}) admin_users ro'yxatida mavjud emas",
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
        allowed_ips.update(settings.localhost_ip_fallback)
        if client_ip not in allowed_ips:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sizning IP manzilingiz ({client_ip}) Admin Panel uchun ruxsat etilmagan (IP Whitelist Block)",
            )

    return user


def require_admin_or_superadmin(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ushbu amalni bajarish uchun Admin huquqi talab etiladi",
        )
    return user


def require_superadmin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ushbu o'zgartirish faqat Superadmin tomonidan bajarilishi mumkin",
        )
    return user
