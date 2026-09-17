"""
Admin panel xavfsizlik middleware (services.admin_middleware)

Ushbu modul admin panel endpointlarini himoya qilish uchun qo'shimcha
JWT + rol + IP tekshiruvi qatlamini ta'minlaydi. U `app.dependencies` dagi
asosiy `get_current_admin` bilan parallel ishlatiladi (defense-in-depth).
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_token
from app.config import settings
from app.database import get_db
from app.models import AdminUser, User, UserRole

logger = logging.getLogger(__name__)


class AdminMiddleware:
    """Admin panel xavfsizlik tekshiruvi (JWT + admin role + IP log)."""

    # Faqat admin ruxsat berilgan endpoint prefixlari
    ADMIN_ONLY_PREFIXES = ("/api/admin", "/api/v1/admin")

    @staticmethod
    def _client_ip(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
        return request.client.host if request.client else "127.0.0.1"

    @staticmethod
    async def verify_admin(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ) -> User:
        """Admin huquqini tekshirish va admin User obyektini qaytarish."""
        # 1. Token ni olish
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Authorization header missing")

        try:
            scheme, token = auth_header.split()
            if scheme.lower() != "bearer":
                raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        # 2. Token ni decode qilish
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        # 3. User ni aniqlash
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")

        from sqlalchemy import select

        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User is inactive")

        # 4. Admin huquqini tekshirish
        if user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUPPORT):
            logger.warning("Non-admin user %s attempted to access admin panel", user.username)
            raise HTTPException(status_code=403, detail="Admin access required")

        # 5. admin_users jadvalida ham mavjudligini tekshirish
        admin_check = await db.execute(select(AdminUser).where(AdminUser.email == user.email))
        admin_entry = admin_check.scalar_one_or_none()
        if not admin_entry and user.role not in (UserRole.SUPERADMIN, UserRole.ADMIN):
            raise HTTPException(
                status_code=403,
                detail=f"Ushbu email ({user.email}) admin_users ro'yxatida mavjud emas",
            )

        # 6. IP va vaqtni log qilish
        client_ip = AdminMiddleware._client_ip(request)
        logger.info("Admin access: %s from %s (%s)", user.username, client_ip, request.url.path)

        request.state.admin_user = user
        return user

    @staticmethod
    def is_admin_only_path(path: str) -> bool:
        """Path admin uchunmi tekshirish."""
        return any(path.startswith(p) for p in AdminMiddleware.ADMIN_ONLY_PREFIXES)


# FastAPI dependency uchun qulay alias
async def require_admin_middleware(
    user: User = Depends(AdminMiddleware.verify_admin),
) -> User:
    return user
