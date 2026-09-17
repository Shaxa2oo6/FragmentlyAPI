from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_password_hash, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.ton_balance import ton_balance
from app.services.ton_wallet import get_real_ton_balance
from app.services.wallet import wallet_service
from app.services.tariffs import db_requests_per_minute, get_tariff

router = APIRouter(prefix="/api/users", tags=["Users"])


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    telegram_username: str | None = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ConnectWalletRequest(BaseModel):
    mnemonic: str | None = None
    seed_phrase: str | None = None


@router.post("/api-key/generate")
@router.post("/api-key/regenerate")
@router.post("/api-token/generate")
async def generate_user_api_key(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Milli-second fast API key generator."""
    from app.services.api_token import set_api_token

    new_token = set_api_token(current_user, db)
    await db.commit()
    await db.refresh(current_user)

    return {
        "success": True,
        "message": "API Token muvaffaqiyatli yangilandi",
        "api_token": new_token,
        "api_key": new_token,
    }


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Joriy foydalanuvchi ma'lumotlari"""
    wallet_type = None
    if current_user.wallet_address:
        try:
            real_balance = await get_real_ton_balance(current_user.wallet_address)
            if real_balance is not None:
                current_user.balance_gram = real_balance
                await db.commit()
        except Exception:
            pass
        try:
            wallet_type = await ton_balance.get_wallet_type(current_user.wallet_address)
        except Exception:
            wallet_type = None

    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value if current_user.role else "user",
        "api_token": current_user.api_token,
        "wallet_address": current_user.wallet_address,
        "wallet_connected": bool(current_user.wallet_connected),
        "wallet_type": wallet_type,
        "balance_gram": current_user.balance_gram,
        "balance_usdt": current_user.balance_usdt,
        "tariff_type": current_user.tariff_type,
        "tariff_plan": get_tariff(current_user.tariff_type or "free").name,
        "tariff_expires_at": current_user.tariff_expires_at.isoformat()
        if current_user.tariff_expires_at
        else None,
        "requests_per_minute": await db_requests_per_minute(db, current_user.tariff_type or "free"),
        "commission_rate": current_user.commission_rate,
        "total_transactions": current_user.total_transactions,
        "total_commission_paid": current_user.total_commission_paid,
        "total_stars_purchased": current_user.total_stars_purchased,
        "total_premium_purchased": current_user.total_premium_purchased,
        "total_spent_gram": current_user.total_spent_gram,
        "total_spent_usdt": current_user.total_spent_usdt,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.put("/profile")
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Profilni yangilash"""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.telegram_username is not None:
        current_user.telegram_username = data.telegram_username

    await db.commit()
    await db.refresh(current_user)

    return {"success": True, "message": "Profile updated"}


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Parolni o'zgartirish"""
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    current_user.hashed_password = get_password_hash(data.new_password)
    await db.commit()

    return {"success": True, "message": "Password changed successfully"}


@router.post("/connect-wallet")
async def connect_wallet(
    data: ConnectWalletRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Wallet ulash (12/24 so'zli mnemonic seed-phrase orqali — legacy).

    Yangi foydalanuvchilar uchun `/api/wallet/connect` (TON Connect) tavsiya etiladi.
    """
    from app.services.wallet_connect import WalletConnectError, wallet_connect_service

    mnemonic = data.mnemonic or data.seed_phrase
    if not mnemonic:
        raise HTTPException(status_code=400, detail="Seed phrase talab qilinadi")
    try:
        result = await wallet_connect_service.connect(
            db=db, user=current_user, raw_mnemonic=mnemonic
        )
    except WalletConnectError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ichki xatolik: {exc}")

    current_user.wallet_connected = True
    await db.commit()
    result["success"] = True
    result["wallet_connected"] = True
    result["wallet_address"] = current_user.wallet_address
    return result


@router.post("/generate-wallet")
async def generate_wallet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Yangi TON wallet yaratish"""
    address, seed_phrase = await wallet_service.generate_wallet()

    current_user.wallet_address = address
    current_user.wallet_seed_encrypted = wallet_service.encrypt_seed(seed_phrase)
    current_user.is_verified = True

    await db.commit()

    return {
        "success": True,
        "message": "New wallet generated",
        "wallet_address": address,
        "seed_phrase": seed_phrase,  # Faqat bir marta!
    }


@router.post("/regen-api-token")
async def regenerate_api_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foydalanuvchi API Tokenini yangilash (legacy endpoint).

    Himoyalangan funksiya: hamyon ulanmagan bo'lsa 403 "Wallet not connected".
    Yangi token `frag_<token_urlsafe(32)>_<user_id>` formatida yaratiladi.
    Kanonik endpoin'lar: POST /api-token/generate va POST /api-token/regenerate.
    """
    from app.services.api_token import set_api_token

    if not current_user.wallet_connected:
        raise HTTPException(status_code=403, detail="Wallet not connected")

    new_token = set_api_token(current_user, db)
    await db.commit()
    await db.refresh(current_user)

    return {
        "success": True,
        "message": "Yangi API token yaratildi",
        "api_token": new_token,
        "api_key": new_token,
    }