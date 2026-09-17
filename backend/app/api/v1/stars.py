import logging
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, purchase_rate_limit
from app.models import PaymentMethod, Transaction, TransactionStatus, TransactionType, User
from app.services.analytics import record_transaction
from app.services.fragment_prices import fragment_prices
from app.services.fragment_real import fragment_service
from app.tasks import process_stars_purchase
from app.utils.helpers import normalize_username

router = APIRouter(prefix="/api/v1/stars", tags=["Stars v1"])

logger = logging.getLogger(__name__)


class BuyStarsRequestV1(BaseModel):
    username: str = Field(
        ...,
        pattern=r"^@?[A-Za-z0-9_]{4,32}$",
        description="Qabul qiluvchining Telegram username (masalan: @durov yoki durov)",
        example="@durov",
    )
    quantity: int = Field(
        ...,
        ge=1,
        le=100000,
        description="Sotib olinadigan Telegram Stars miqdori (1 - 100,000)",
        example=100,
    )
    payment_method: str = Field(
        "TON",
        pattern=r"^(TON|GRAM|USDT|USDT_TON)$",
        description="To'lov valyutasi: TON yoki USDT",
        example="TON",
    )


class BuyStarsResponseV1(BaseModel):
    success: bool
    message: str
    transaction_id: int
    quantity: int
    target_username: str
    amount_paid: float
    currency: str
    remaining_balance: float
    status: str


@router.post(
    "/buy/",
    response_model=BuyStarsResponseV1,
    summary="Telegram Stars sotib olish",
    description="Shaxsiy API Key yoki Bearer token orqali Telegram Stars sotib olish va username'ga avtomatik yuborish",
)
async def buy_stars_v1(
    req: BuyStarsRequestV1,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(purchase_rate_limit),
):
    target_username = normalize_username(req.username)
    if not target_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram username noto'g'ri yoki ko'rsatilmadi",
        )

    # 1. Narxni hisoblash
    pm_upper = req.payment_method.strip().upper()
    if pm_upper in ["TON", "GRAM"]:
        pm_enum = PaymentMethod.GRAM
        star_unit_price = await fragment_prices.get_star_price_gram()
        currency_str = "TON"
    elif pm_upper in ["USDT", "USDT_TON"]:
        pm_enum = PaymentMethod.USDT
        # TON/USD kursi orqali USDT dagi narx
        ton_usd = await fragment_prices.get_ton_usd_rate()
        star_price_ton = await fragment_prices.get_star_price_gram()
        star_unit_price = star_price_ton * (ton_usd or 2.5)
        currency_str = "USDT"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Noto'g'ri payment_method. Qo'llab-quvvatlanadi: 'TON' va 'USDT'",
        )

    total_amount = round(req.quantity * star_unit_price, 6)

    # 1.1. Komissiya (admin tarifidan): commission = total x rate, net = total - commission
    from app.services.tariffs import compute_commission, db_commission_percent

    rate_pct = await db_commission_percent(db, current_user.tariff_type)
    rate = round(float(rate_pct) / 100.0, 4)
    split = compute_commission(total_amount, rate)
    commission_amount = split["commission_amount"]

    # Foydalanuvchidan yechiladigan to'liq summa = asosiy narx + komissiya
    charge_amount = round(total_amount + commission_amount, 6)

    # 2. Foydalanuvchi balansini tekshirish
    current_balance = (
        current_user.balance_gram if pm_enum == PaymentMethod.GRAM else current_user.balance_usdt
    )
    current_balance = current_balance or 0.0

    if current_balance < charge_amount:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "message": (
                    f"Balans yetarli emas. Talab qilinadi: {charge_amount} {currency_str} "
                    f"(narx {total_amount} + komissiya {commission_amount}), "
                    f"Mavjud balans: {round(current_balance, 4)} {currency_str}"
                ),
                "details": {
                    "required_amount": round(charge_amount, 6),
                    "available_amount": round(current_balance, 6),
                    "currency": currency_str,
                },
            },
        )

    # 3. Balansdan yechish va Tranzaksiya yaratish
    if pm_enum == PaymentMethod.GRAM:
        current_user.balance_gram = round(current_balance - charge_amount, 6)
    else:
        current_user.balance_usdt = round(current_balance - charge_amount, 6)

    tx = Transaction(
        user_id=current_user.id,
        transaction_type=TransactionType.STARS,
        status=TransactionStatus.PROCESSING,
        payment_method=pm_enum,
        quantity=req.quantity,
        target_username=target_username,
        amount=charge_amount,
        commission_amount=commission_amount,
        commission_rate=rate,
        currency=currency_str,
        transaction_metadata={
            "net_amount": charge_amount,
            "unit_price": round(star_unit_price, 8),
            "memo": f"stars:{target_username}:{req.quantity}",
        },
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    await db.refresh(current_user)

    # 4. Asinxron fon rejimida Fragment/Telegram buyurtmasini yetkazish
    background_tasks.add_task(process_stars_purchase, tx.id)

    remaining = (
        current_user.balance_gram if pm_enum == PaymentMethod.GRAM else current_user.balance_usdt
    )

    return BuyStarsResponseV1(
        success=True,
        message=f"{req.quantity} Stars @{target_username} ga yuborish uchun qabul qilindi.",
        transaction_id=tx.id,
        quantity=req.quantity,
        target_username=target_username,
        amount_paid=charge_amount,
        currency=currency_str,
        remaining_balance=round(remaining, 6),
        status="processing",
    )
