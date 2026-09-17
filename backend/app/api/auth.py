import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models import EmailVerificationCode, User
from app.services.email_service import send_verification_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class SendCodeRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    code: str
    full_name: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/send-verification-code")
async def send_verification_code(data: SendCodeRequest, db: AsyncSession = Depends(get_db)):
    """Emailga 6 xonali OTP tasdiqlash kodi yuborish"""
    # Check existing user
    stmt = select(User).where(User.email == data.email)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ushbu email ro'yxatdan o'tgan")

    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    # Deactivate old codes for this email
    old_stmt = select(EmailVerificationCode).where(EmailVerificationCode.email == data.email)
    old_codes = (await db.execute(old_stmt)).scalars().all()
    for c in old_codes:
        c.is_used = True

    verification_entry = EmailVerificationCode(
        email=data.email,
        code=otp_code,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(verification_entry)
    await db.commit()

    sent = await asyncio.to_thread(send_verification_email, data.email, otp_code)
    if not sent:
        logger.warning("Verification code NOT sent to %s (SMTP failed)", data.email)
        raise HTTPException(
            status_code=500,
            detail="Tasdiqlash kodini emailga yuborishda xatolik yuz berdi. Keyinroq qayta urinib ko'ring.",
        )

    logger.info("Verification code sent to %s", data.email)

    return {
        "success": True,
        "message": f"6 xonali tasdiqlash kodi {data.email} manziliga yuborildi",
    }


@router.post("/verify-code")
async def verify_code(data: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    """6 xonali OTP kodni tekshirish"""
    now = datetime.now(timezone.utc)
    stmt = (
        select(EmailVerificationCode)
        .where(
            EmailVerificationCode.email == data.email,
            EmailVerificationCode.code == data.code,
            EmailVerificationCode.is_used == False,
            EmailVerificationCode.expires_at >= now,
        )
        .order_by(EmailVerificationCode.id.desc())
    )
    res = await db.execute(stmt)
    valid_code = res.scalar_one_or_none()

    if not valid_code:
        raise HTTPException(status_code=400, detail="Tasdiqlash kodi noto'g'ri yoki muddati o'tgan")

    return {"success": True, "message": "Email tasdiqlandi"}


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Email OTP kodi bilan ro'yxatdan o'tish"""
    # 1) OTP Verification
    now = datetime.now(timezone.utc)
    stmt_code = (
        select(EmailVerificationCode)
        .where(
            EmailVerificationCode.email == data.email,
            EmailVerificationCode.code == data.code,
            EmailVerificationCode.is_used == False,
            EmailVerificationCode.expires_at >= now,
        )
        .order_by(EmailVerificationCode.id.desc())
    )
    res_code = await db.execute(stmt_code)
    valid_otp = res_code.scalar_one_or_none()

    if not valid_otp:
        raise HTTPException(status_code=400, detail="Email tasdiqlash kodi noto'g'ri yoki muddati o'tgan")

    # Mark OTP as used
    valid_otp.is_used = True

    # 2) Duplicate User check
    stmt = select(User).where((User.email == data.email) | (User.username == data.username))
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email yoki username allaqachon mavjud")

    user = User(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": user.username, "id": user.id})
    refresh_token = create_refresh_token({"sub": user.username, "id": user.id})

    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "api_token": user.api_token,
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Kirish"""
    stmt = select(User).where(User.username == data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Noto'g'ri username yoki parol")

    user.last_login = func.now()
    await db.commit()

    access_token = create_access_token({"sub": user.username, "id": user.id})
    refresh_token = create_refresh_token({"sub": user.username, "id": user.id})

    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "api_token": user.api_token,
            "wallet_address": user.wallet_address,
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh")
@router.post("/refresh/")
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Refresh token orqali yangi access token olish"""
    payload = decode_token(data.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    username = payload.get("sub")
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token({"sub": user.username, "id": user.id})

    return {"access_token": access_token, "token_type": "bearer"}


class GoogleLoginRequest(BaseModel):
    token: str | None = None
    email: str | None = None
    name: str | None = None
    google_id: str | None = None


@router.post("/google")
@router.post("/google/")
async def google_login(data: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    """Google OAuth orqali kirish va avto-registratsiya"""
    try:
        import secrets
        email = data.email.strip() if data.email else None

        if not email and data.token and "." in data.token:
            try:
                import base64, json
                payload_part = data.token.split(".")[1]
                padded = payload_part + "=" * (-len(payload_part) % 4)
                decoded = json.loads(base64.urlsafe_b64decode(padded))
                email = decoded.get("email")
                if not data.name:
                    data.name = decoded.get("name")
            except Exception as exc:
                logger.warning("Google JWT decode exception: %s", exc)

        if not email:
            raise HTTPException(status_code=400, detail="Google hisobingizdan email olinmadi")

        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            base_username = email.split("@")[0]
            username = base_username
            suffix = 1
            while True:
                existing = await db.execute(select(User).where(User.username == username))
                if not existing.scalar_one_or_none():
                    break
                username = f"{base_username}_{suffix}"
                suffix += 1

            random_pw = secrets.token_urlsafe(16)
            user = User(
                email=email,
                username=username,
                full_name=data.name or base_username,
                hashed_password=get_password_hash(random_pw),
                is_verified=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        user.last_login = func.now()
        await db.commit()

        access_token = create_access_token({"sub": user.username, "id": user.id})
        refresh_token = create_refresh_token({"sub": user.username, "id": user.id})

        return {
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "api_token": user.api_token,
                "wallet_address": user.wallet_address,
            },
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("google_login exception: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Google login error: {str(e)}")


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Chiqish (client tomonda token o'chiriladi)"""
    return {"success": True, "message": "Logged out successfully"}