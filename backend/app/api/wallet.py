from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, WalletConnection
from app.services.payment import payment_service
from app.services.ton_balance import ton_balance
from app.services.ton_verify import ton_verify_service

router = APIRouter(prefix="/api/wallet", tags=["Wallet"])


class DepositRequest(BaseModel):
    amount: float
    method: str = "gram"  # gram | usdt


class TonConnectRequest(BaseModel):
    wallet_address: str
    wallet_type: str | None = None


class DisconnectRequest(BaseModel):
    pass


@router.get("/balance")
async def get_wallet_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Wallet balansini real vaqtda TON blockchain'dan olish va DB'da cache qilish."""
    if not current_user.wallet_address:
        return {
            "success": False,
            "message": "Wallet ulangan emas",
            "ton_balance": 0,
            "usdt_balance": 0,
            "stars_balance": 0,
            "balance_gram": current_user.balance_gram or 0,
            "balance_usdt": current_user.balance_usdt or 0,
        }

    try:
        # TON blockchain'dan real balans
        result = await ton_balance.get_wallet_balance(current_user.wallet_address)

        # DB cache ni yangilash (real balansni saqlaymiz)
        ton_bal = result.get("ton_balance", 0.0)
        usdt_bal = result.get("usdt_balance", 0.0)

        current_user.balance_gram = ton_bal
        current_user.balance_usdt = usdt_bal
        await db.commit()

        return {
            "success": True,
            "wallet_address": current_user.wallet_address,
            "wallet_type": result.get("wallet_type") or "Unknown",
            "ton_balance": ton_bal,
            "usdt_balance": usdt_bal,
            "stars_balance": result.get("stars_balance", 0),
            "balance_gram": ton_bal,
            "balance_usdt": usdt_bal,
            "source": result.get("source"),
            "error": result.get("error"),
            "updated_at": result.get("updated_at"),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "ton_balance": current_user.balance_gram or 0,
            "usdt_balance": current_user.balance_usdt or 0,
        }


@router.post("/refresh-balance")
async def refresh_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Balansni majburiy yangilash (force refresh)."""
    return await get_wallet_balance(current_user, db)


@router.post("/deposit")
async def deposit(
    data: DepositRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Balansni to'ldirish (demo integratsiya: haqiqiy to'lov provayderi bilan almashtiring).

    Real platformada bu nuqtada Stripe / TON transfer / Fiat to'lov
    tasdiqlanishi kutiladi.
    """
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    payment = await payment_service.create_payment(
        amount=data.amount,
        currency=data.method.upper(),
        user_id=current_user.id,
        description="Wallet deposit",
    )

    # Demo rejim: to'lov darhol tasdiqlanadi
    verification = await payment_service.verify_payment(payment["payment_id"])
    if verification and verification.get("status") == "confirmed":
        if data.method == "gram":
            current_user.balance_gram += data.amount
        else:
            current_user.balance_usdt += data.amount
        await db.commit()

        return {
            "success": True,
            "message": "Balans muvaffaqiyatli to'ldirildi",
            "payment_id": payment["payment_id"],
            "gram": current_user.balance_gram,
            "usdt": current_user.balance_usdt,
        }

    raise HTTPException(status_code=400, detail="Payment not verified")


@router.post("/connect")
async def connect_ton_wallet(
    data: TonConnectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """TON Connect protokoli orqali hamyonni ulash.

    Platforma HEch qachon foydalanuvchi kalitiga (seed) ega bo'lmaydi —
    TON Connect hamyon imzolarini foydalanuvchining o'zi beradi.
    """
    from sqlalchemy import select

    wallet_address = (data.wallet_address or "").strip()
    if not ton_verify_service.is_valid_address(wallet_address):
        raise HTTPException(status_code=400, detail="Noto'g'ri TON hamyon manzili")

    # DIQQAT: API token bu yerda YARATILMAYDI — spec 1.A qoidasi:
    # token faqat foydalanuvchi "Generate API Token" tugmasini bosganda hosil qilinadi.
    current_user.wallet_address = wallet_address
    current_user.wallet_connected = True
    current_user.is_verified = True

    # WalletConnection tarixini saqlash
    stmt = select(WalletConnection).where(
        WalletConnection.user_id == current_user.id,
        WalletConnection.wallet_address == wallet_address,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        existing.is_active = True
        existing.raw_address = data.wallet_type or existing.raw_address
    else:
        db.add(
            WalletConnection(
                user_id=current_user.id,
                wallet_address=wallet_address,
                raw_address=data.wallet_type or None,
                wallet_type=data.wallet_type or "ton-connect",
                is_active=True,
            )
        )

    await db.commit()

    # Real balansni yuklab cache qilish
    balance = await ton_balance.get_wallet_balance(wallet_address)
    current_user.balance_gram = balance.get("ton_balance", 0.0)
    current_user.balance_usdt = balance.get("usdt_balance", 0.0)
    await db.commit()

    return {
        "success": True,
        "message": "Hamyon muvaffaqiyatli ulandi",
        "wallet_address": wallet_address,
        "wallet_connected": True,
        "ton_balance": current_user.balance_gram,
        "usdt_balance": current_user.balance_usdt,
    }


@router.post("/disconnect")
async def disconnect_ton_wallet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hamyonni uzish — himoyalangan funksiyalar (API key, xarid) bloklanadi."""
    from sqlalchemy import update

    from app.models import WalletConnection as WC

    await db.execute(
        update(WC)
        .where(WC.user_id == current_user.id, WC.is_active.is_(True))
        .values(is_active=False)
    )
    current_user.wallet_address = None
    current_user.wallet_connected = False
    current_user.balance_gram = 0.0
    current_user.balance_usdt = 0.0
    await db.commit()

    return {
        "success": True,
        "message": "Hamyon uzildi. Himoyalangan funksiyalar bloklandi.",
        "wallet_connected": False,
    }