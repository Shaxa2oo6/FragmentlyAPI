# backend/app/api/premium.py
"""
REAL Fragment.com & TON Blockchain integratsiyasi bilan Premium API
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, async_session_maker
from app.dependencies import get_current_user, purchase_rate_limit
from app.models import PaymentMethod, Transaction, TransactionStatus, TransactionType, User
from app.services.analytics import record_transaction
from app.services.fragment_real import fragment_service
from app.services.platform_wallet import credit_platform_wallet, get_platform_wallet_address
from app.services.wallet_ton import ton_wallet_service
from app.tasks import process_premium_purchase
from app.utils.helpers import extract_error_message

router = APIRouter(prefix="/api/premium", tags=["Premium"])

logger = logging.getLogger(__name__)

PREMIUM_PRICES = {30: 300.0, 90: 600.0, 180: 1000.0, 365: 1500.0}  # eski fallback


class BuyPremiumRequest(BaseModel):
    username: str = Field(..., pattern=r"^@?[A-Za-z0-9_]{4,32}$")  # Telegram username (@durov yoki durov) — Majburiy
    months: Optional[int] = None  # Obuna muddati oylarda (3, 6, 12 oy) — Majburiy
    duration: Optional[int] = None  # Alias (3, 6, 12)
    duration_days: Optional[int] = None  # Alias (91, 182, 365)
    payment_method: str = PaymentMethod.GRAM.value  # TON | USDT




class ConfirmPremiumRequest(BaseModel):
    transaction_id: int
    tx_hash: str | None = None


async def process_premium_transaction_in_background(tx_id: int):
    """
    Fon rejimidagi task: TON tranzaksiyasini yuboradi va statusini yangilaydi
    """
    async with async_session_maker() as db:
        try:
            tx = await db.get(Transaction, tx_id)
            if not tx:
                return

            user = await db.get(User, tx.user_id)
            if not user or not user.wallet_seed_encrypted:
                tx.status = TransactionStatus.FAILED
                tx.error_message = "User mnemonic wallet not found"
                await db.commit()
                return

            # REAL: pyfragment yoki fragment-api-lib ulangan bo'lsa, bevosita Fragment.com ga buyurtma beramiz
            py_enabled = getattr(settings, "PYFRAGMENT_ENABLED", False)
            lib_enabled = getattr(settings, "FRAGMENT_API_LIB_ENABLED", False)
            if py_enabled or lib_enabled:
                from app.services.fragment_prices import fragment_prices
                duration_months = fragment_prices.months_from_days(tx.premium_duration or 91)
                from app.services.wallet_connect import get_user_wallet_type

                wallet_type = await get_user_wallet_type(db, tx.user_id)
                if py_enabled:
                    lib_result = await fragment_service.buy_premium_via_pyfragment(
                        username=tx.premium_user_username or tx.premium_user_id or "",
                        duration_months=duration_months,
                        seed=seed_phrase,
                        payment_method=tx.payment_method.value if tx.payment_method else None,
                    )
                else:
                    lib_result = await fragment_service.buy_premium_via_lib(
                        username=tx.premium_user_username or tx.premium_user_id or "",
                        duration_months=duration_months,
                        seed=seed_phrase,
                        wallet_type=wallet_type,
                        payment_method=tx.payment_method.value if tx.payment_method else None,
                    )
                tx.status = TransactionStatus.COMPLETED
                tx.fragment_tx_id = lib_result.get("tx_id", "")
                tx.completed_at = func.now()
                user.total_premium_purchased += 1

                if tx.payment_method == PaymentMethod.GRAM:
                    user.balance_gram = max(0.0, user.balance_gram - tx.amount)
                    user.total_spent_gram += tx.amount
                else:
                    user.balance_usdt = max(0.0, user.balance_usdt - tx.amount)
                    user.total_spent_usdt += tx.amount

                await db.commit()
                await record_transaction(db, tx)
                return

            # Fallback: Smart contract payload + TON blockchain transfer
            payload_info = await fragment_service.init_premium_buy_payload(
                user_id=tx.premium_user_id or "",
                duration_days=tx.premium_duration or 30,
                username=tx.premium_user_username,
            )
            dest_addr = payload_info.get("destination_address")
            comment = payload_info.get("comment", f"premium:{tx.premium_user_id}")

            # Blockchain transfer
            tx_hash = await ton_wallet_service.execute_ton_transfer(
                encrypted_seed=user.wallet_seed_encrypted,
                destination=dest_addr,
                amount_ton=tx.amount,
                comment=comment,
            )

            tx.status = TransactionStatus.COMPLETED
            tx.fragment_tx_id = tx_hash
            tx.completed_at = func.now()
            user.total_premium_purchased += 1

            if tx.payment_method == PaymentMethod.GRAM:
                user.balance_gram = max(0.0, user.balance_gram - tx.amount)
                user.total_spent_gram += tx.amount
            else:
                user.balance_usdt = max(0.0, user.balance_usdt - tx.amount)
                user.total_spent_usdt += tx.amount

            await db.commit()
            await record_transaction(db, tx)

        except Exception as e:
            logger.error("Background premium processing error: %s", e)
            try:
                tx = await db.get(Transaction, tx_id)
                if tx:
                    tx.status = TransactionStatus.FAILED
                    tx.error_message = str(e)
                    await db.commit()
            except Exception:
                pass


@router.post("/buy")
async def buy_premium(
    request: BuyPremiumRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(purchase_rate_limit),
):
    """
    Telegram Premium sotib olish — TO'LIQ AVTOMATIK.

    1. Wallet + seed tekshirish
    2. Real narxni olish (Fragment.com asosida)
    3. Tarif bo'yicha komissiyani hisoblash
    4. Balansni tekshirish
    5. Balansdan yechish + tranzaksiya yaratish
    6. Background task — Fragment orqali avtomatik yetkazish
    7. Har doim javob qaytarish (xatolikda ham JSONResponse)

    Xatolik bo'lsa task FAILED qiladi va summa balansga avtomatik qaytariladi.
    """
    from app.services.fragment_prices import fragment_prices
    from app.services.tariffs import compute_commission, db_commission_percent

    if not current_user.wallet_connected or not current_user.wallet_address:
        raise HTTPException(status_code=403, detail="Wallet not connected")
    if not current_user.wallet_seed_encrypted:
        raise HTTPException(
            status_code=400,
            detail="Wallet seed topilmadi. Iltimos, wallet qaytadan ulang.",
        )

    # 1. username validatsiyasi — Majburiy
    raw_username = (request.username or "").strip()
    if not raw_username:
        raise HTTPException(
            status_code=400,
            detail="Telegram username talab qilinadi (masalan: @durov yoki durov)",
        )
    target_username = raw_username if raw_username.startswith("@") else f"@{raw_username}"

    # 2. months validatsiyasi — Faqat 3, 6, 12 oy (Telegram API qat'iy talabi)
    m_val = request.months if request.months is not None else request.duration
    if m_val is None and request.duration_days:
        DAY_MAP = {90: 3, 91: 3, 180: 6, 182: 6, 365: 12}
        m_val = DAY_MAP.get(request.duration_days)

    if m_val not in (3, 6, 12):
        input_given = f"'{m_val}'" if m_val is not None else "kiritilmadi"
        raise HTTPException(
            status_code=400,
            detail=(
                f"Noto'g'ri obuna muddati ({input_given}). Telegram Premium sovg'a qilish API "
                f"uchun muddat faqat 3, 6 yoki 12 oy bo'lishi kerak. Boshqa oylar mos emas."
            ),
        )

    MONTHS_TO_DAYS = {3: 91, 6: 182, 12: 365}
    duration_days = MONTHS_TO_DAYS[m_val]



    # ========== 1. NARX (real) ==========
    pm_upper = (request.payment_method or "gram").strip().lower()
    if pm_upper in ("gram", "ton"):
        pm_enum = PaymentMethod.GRAM
        net_amount = await fragment_prices.get_premium_price_for_days(duration_days)
        cur_str = "TON"
    elif pm_upper == "usdt":
        pm_enum = PaymentMethod.USDT
        ton_usd = await fragment_prices.get_ton_usd_rate()
        net_amount = (await fragment_prices.get_premium_price_for_days(duration_days)) * (ton_usd or 2.5)
        cur_str = "USDT"
    else:
        raise HTTPException(status_code=400, detail="Noto'g'ri payment_method. 'gram' yoki 'usdt'")

    net_amount = round(float(net_amount), 6)

    # ========== 2. KOMISSIYA (admin tarifidan) ==========
    rate_pct = await db_commission_percent(db, current_user.tariff_type)
    rate = round(float(rate_pct) / 100.0, 4)
    split = compute_commission(net_amount, rate)
    total_amount = round(split["total_amount"], 6)
    commission_amount = split["commission_amount"]

    # ========== 3. BALANS TEKSHIRISH ==========
    balance = current_user.balance_gram if pm_enum == PaymentMethod.GRAM else current_user.balance_usdt
    balance = balance or 0.0
    if balance < total_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Mablag' yetarsiz: Balansingizda {round(balance, 4)} {cur_str} bor. Ushbu Premium obunasi ({m_val} oy) uchun {total_amount} {cur_str} zarur. Iltimos balansingizni to'ldiring!",
        )

    platform_wallet = await get_platform_wallet_address(db)

    # ========== 4. BALANSDAN YECHISH + TRANZAKSIYA ==========
    if pm_enum == PaymentMethod.GRAM:
        current_user.balance_gram = round(balance - total_amount, 6)
    else:
        current_user.balance_usdt = round(balance - total_amount, 6)

    transaction = Transaction(
        user_id=current_user.id,
        transaction_type=TransactionType.PREMIUM,
        status=TransactionStatus.PROCESSING,
        payment_method=pm_enum,
        premium_duration=duration_days,
        premium_user_id=target_username.replace("@", ""),
        premium_user_username=target_username,
        amount=total_amount,
        commission_amount=commission_amount,
        commission_rate=rate,
        currency=cur_str,
        destination_wallet=platform_wallet,
        transaction_metadata={
            "net_amount": split["net_amount"],
            "memo": f"premium:{target_username}:{m_val}m",
        },
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    # ========== 5. BACKGROUND: Fragment orqali yetkazish ==========
    background_tasks.add_task(process_premium_purchase, transaction.id)

    remaining = current_user.balance_gram if pm_enum == PaymentMethod.GRAM else current_user.balance_usdt

    return {
        "success": True,
        "message": f"Telegram Premium {m_val} oy {target_username} ga yuborish qabul qilindi.",
        "transaction_id": transaction.id,
        "username": target_username,
        "months": m_val,
        "duration_days": duration_days,
        "net_amount": split["net_amount"],
        "commission_rate": rate,
        "commission_amount": commission_amount,
        "amount_paid": total_amount,
        "currency": cur_str,
        "remaining_balance": round(remaining, 6),
        "status": "processing",
    }


@router.post("/confirm")
async def confirm_premium_payment(
    data: ConfirmPremiumRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Blockchain to'lovi tasdiqlangach Premium yetkazishni boshlaydi."""
    from app.config import settings
    from app.services.ton_verify import ton_verify_service

    if not current_user.wallet_connected or not current_user.wallet_address:
        raise HTTPException(status_code=403, detail="Wallet not connected")

    tx = await db.get(Transaction, data.transaction_id)
    if not tx or tx.user_id != current_user.id or tx.transaction_type != TransactionType.PREMIUM:
        raise HTTPException(status_code=404, detail="Tranzaksiya topilmadi")
    if tx.status == TransactionStatus.COMPLETED:
        return {"success": True, "message": "Premium allaqachon yetkazilmoqda/yetkazildi", "transaction_id": tx.id}

    if tx.payment_method == PaymentMethod.USDT:
        verification = await ton_verify_service.verify_tx_exists(data.tx_hash, current_user.wallet_address)
    else:
        platform_wallet = await get_platform_wallet_address(db)
        verification = {"verified": False, "reason": "tx_hash ko'rsatilmagan"}
        if data.tx_hash:
            verification = await ton_verify_service.verify_native_payment(
                tx_hash=data.tx_hash,
                recipient=platform_wallet,
                sender=current_user.wallet_address,
                expected_amount_ton=tx.amount,
            )
        if not verification.get("verified"):
            tx_hash_found = await ton_verify_service.find_native_payment(
                recipient=platform_wallet,
                sender=current_user.wallet_address,
                expected_amount_ton=tx.amount,
                comment=str((tx.transaction_metadata or {}).get("memo", "")),
                attempts=6,
                delay=2.0,
            )
            if tx_hash_found.get("verified"):
                verification = {
                    "verified": True,
                    "tx_hash": tx_hash_found.get("tx_hash"),
                    "amount_ton": tx_hash_found.get("amount_ton"),
                }

    if not verification.get("verified"):
        raise HTTPException(
            status_code=400,
            detail=f"To'lov tasdiqlanmadi: {verification.get('reason', '')}",
        )

    real_tx_hash = verification.get("tx_hash") or data.tx_hash or ""
    tx.status = TransactionStatus.PROCESSING
    tx.tx_hash = real_tx_hash
    tx.completed_at = func.now()
    current_user.total_transactions = (current_user.total_transactions or 0) + 1
    current_user.total_commission_paid = (current_user.total_commission_paid or 0.0) + (tx.commission_amount or 0.0)
    if tx.payment_method == PaymentMethod.GRAM:
        current_user.total_spent_gram += tx.amount
    else:
        current_user.total_spent_usdt += tx.amount
    current_user.total_premium_purchased += 1
    await db.commit()

    background_tasks.add_task(deliver_premium_with_platform_wallet, tx.id)

    return {
        "success": True,
        "transaction_id": tx.id,
        "status": "processing",
        "message": "To'lov tasdiqlandi. Premium yetkazish boshlandi.",
    }


async def deliver_premium_with_platform_wallet(tx_id: int):
    """
    To'lov oldindan platforma hamyoniga kelgan Premium buyurtmasini yetkazadi.
    Fragment sozlanmagan bo'lsa avtomatik refund yaratiladi.
    """
    from app.config import settings
    from app.services.refund_service import _resolve_platform_seed

    async with async_session_maker() as db:
        try:
            tx = await db.get(Transaction, tx_id)
            if not tx:
                return
            user = await db.get(User, tx.user_id)

            platform_seed = await _resolve_platform_seed(db)
            py_enabled = getattr(settings, "PYFRAGMENT_ENABLED", False)
            lib_enabled = getattr(settings, "FRAGMENT_API_LIB_ENABLED", False)
            delivered = False
            if (py_enabled or lib_enabled) and platform_seed:
                try:
                    from app.services.fragment_prices import fragment_prices
                    duration_months = fragment_prices.months_from_days(tx.premium_duration or 91)
                    wallet_type = getattr(settings, "PYFRAGMENT_WALLET_VERSION", "V5R1")
                    if py_enabled:
                        res = await fragment_service.buy_premium_via_pyfragment(
                            username=tx.premium_user_username or tx.premium_user_id or "",
                            duration_months=duration_months,
                            seed=platform_seed,
                            payment_method=tx.payment_method.value if tx.payment_method else None,
                        )
                    else:
                        res = await fragment_service.buy_premium_via_lib(
                            username=tx.premium_user_username or tx.premium_user_id or "",
                            duration_months=duration_months,
                            seed=platform_seed,
                            wallet_type=wallet_type,
                            payment_method=tx.payment_method.value if tx.payment_method else None,
                        )
                    tx.fragment_tx_id = res.get("tx_id", "")
                    delivered = True
                except Exception as exc:
                    logger.error("Premium delivery failed tx=%s: %s", tx_id, exc)
                    tx.error_message = str(exc)

            if not delivered:
                tx.status = TransactionStatus.FAILED
                if not tx.error_message:
                    tx.error_message = "Fragment levering sozlanmagan. To'lov qaytariladi."
                await db.commit()
                from app.services.refund_service import refund_transaction

                try:
                    await refund_transaction(db, user.id, tx.id)
                    tx.status = TransactionStatus.REFUNDED
                    await db.commit()
                except Exception as rexc:
                    logger.error("Auto-refund failed tx=%s: %s", tx_id, rexc)
                return

            # Split-payment: komissiya qismini Admin Hamyoniga o'tkazish.
            # Komissiya platforma o'z hamyonidan (PLATFORM_SEED_PHRASE) yuboriladi.
            if tx.commission_amount and tx.commission_amount > 0:
                try:
                    from app.services.commission_service import transfer_commission_to_admin
                    from app.services.wallet_ton import ton_wallet_service

                    await transfer_commission_to_admin(
                        db,
                        tx,
                        encrypted_seed=ton_wallet_service.encrypt_mnemonic(platform_seed),
                        expected_address=getattr(settings, "PLATFORM_WALLET_ADDRESS", None),
                    )
                except Exception as exc:
                    logger.error("Commission transfer failed tx=%s: %s", tx_id, exc)
                    tx.status = TransactionStatus.FAILED
                    tx.error_message = str(exc)
                    await db.commit()
                    from app.services.refund_service import refund_transaction

                    try:
                        await refund_transaction(db, user.id, tx.id)
                        tx.status = TransactionStatus.REFUNDED
                        await db.commit()
                    except Exception as rexc:
                        logger.error("Auto-refund after commission failure tx=%s: %s", tx_id, rexc)
                    return

            tx.status = TransactionStatus.COMPLETED
            tx.completed_at = func.now()
            await credit_platform_wallet(db, tx)
            await db.commit()
        except Exception as exc:
            logger.error("deliver_premium error tx=%s: %s", tx_id, exc)
            try:
                tx = await db.get(Transaction, tx_id)
                if tx:
                    tx.status = TransactionStatus.FAILED
                    tx.error_message = str(exc)
                    await db.commit()
            except Exception:
                pass


from app.services.cache import cache_response


@router.get("/price")
@router.post("/price")
@cache_response(ttl=60, prefix="premium_price")
async def get_premium_price(duration_days: int = 91):
    """Rasmiy Fragment.com Premium narxlari (USD anchor + jonli TON/USD kursi)."""
    from app.services.fragment_prices import fragment_prices

    prices = await fragment_prices.get_premium_prices()
    ton_usd = await fragment_prices.get_ton_usd_rate()
    months = fragment_prices.months_from_days(duration_days)
    current = prices.get(str(months), {})

    return {
        "currency": "GRAM",
        "ton_usd": ton_usd,
        "months": months,
        "price": current.get("gram", 0.0),           # so'ralgan muddat uchun GRAM
        "usd": current.get("usd", 0.0),
        "duration_days": duration_days,
        "prices": prices,                             # 3/6/12 oy uchun to'liq jadval
        "updated_at": datetime.now().isoformat(),
    }


@router.get("/status/{user_id}")
async def check_premium_status(
    user_id: str,
    current_user: User = Depends(get_current_user),
):
    """Foydalanuvchining Premium statusini tekshirish (Telegram orqali qo'lda tekshiriladi)"""
    # Real ishlash: user_id bo'yicha oxirgi muvaffaqiyatli tranzaksiyani qaytaramiz
    return {
        "user_id": user_id,
        "is_premium": False,
        "message": "Premium statusini tekshirish Telegram orqali amalga oshiriladi",
    }