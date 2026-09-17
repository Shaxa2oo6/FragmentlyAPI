# backend/app/api/tariff.py
"""
Tarif tizimi API:
  GET  /api/user/tariff          -> joriy tarif + komissiya + limit + hisob stats
  GET  /api/tariff/plans         -> tariflar katalogi
  POST /api/tariff/buy           -> REAL to'lov (platforma hamyoniga, mnemonic wallet orqali)
  POST /api/tariff/confirm       -> blockchain tasdiqlash + avtomatik faollashtirish
  GET  /api/admin/commissions    -> komissiya statistikasi (admin)
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from cryptography.fernet import InvalidToken

from app.database import get_db
from app.dependencies import get_current_admin, get_current_user
from app.models import (
    PaymentMethod,
    Tariff,
    Transaction,
    TransactionStatus,
    TransactionType,
    User,
)
from app.services.tariffs import (
    TARIFF_DAYS,
    TARIFFS,
    apply_tariff_to_user,
    db_requests_per_minute,
    ensure_default_tariffs,
    get_db_tariff,
    get_tariff,
    serialize_tariff,
)
from app.services.platform_wallet import (
    get_platform_wallet_address,
    get_platform_wallet_for_currency,
)
from app.services.ton_balance import ton_balance
from app.services.ton_verify import ton_verify_service
from app.services.wallet_ton import PYTONIQ_AVAILABLE, ton_wallet_service

router = APIRouter(tags=["Tariffs"])

logger = logging.getLogger(__name__)

WARNING_DAYS = 3  # muddat tugashiga 3 kun qolganda ogohlantirish

# Blockchain'da konfirmatsiyani kutish parametrlari
CONFIRM_ATTEMPTS = 6
CONFIRM_DELAY_SECONDS = 3


async def ensure_tariff_valid(user: User, db: AsyncSession) -> None:
    """Muddat tugagan tarifni avtomatik Free ga qaytaradi (Layer B)."""
    from app.services.expiration_service import downgrade_expired_user

    if await downgrade_expired_user(db, user):
        await db.commit()


async def _credit_platform_wallet(db: AsyncSession, tx: Transaction) -> None:
    """Muvaffaqiyatli to'lovda platforma hamyoni balansi va komissiyasini yangilaydi."""
    from app.services.platform_wallet import credit_platform_wallet

    await credit_platform_wallet(db, tx)


def tariff_payload(user: User, plan=None, plans: bool = False) -> dict:
    plan = plan or get_tariff(user.tariff_type)
    now = datetime.now(timezone.utc)
    exp = user.tariff_expires_at
    if exp is not None:
        exp = exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp
        expires_in_days = max(0, (exp - now).total_seconds() // 86400)
        expiring_soon = expires_in_days <= WARNING_DAYS
    else:
        expires_in_days = None
        expiring_soon = False

    return {
        "tariff_type": user.tariff_type,
        "tariff_name": plan.name,
        "tariff_expires_at": exp.isoformat() if exp else None,
        "expires_in_days": expires_in_days,
        "expiring_soon": bool(expiring_soon),
        "auto_renew": bool(user.auto_renew),
        "commission_percent": round((user.commission_rate or 0) * 100, 2),
        "requests_per_minute": plan.requests_per_minute,
        "wallet_connected": bool(user.wallet_connected),
        "wallet_address": user.wallet_address,
        "stats": {
            "total_transactions": user.total_transactions,
            "total_commission_paid": user.total_commission_paid,
            "total_stars": user.total_stars_purchased,
            "total_premium": user.total_premium_purchased,
        },
    }


class TariffBuyRequest(BaseModel):
    plan_id: str | None = None
    currency: str | None = None  # faqat ton | gram (USDT olib tashlangan)
    duration_months: int | None = None  # 1 | 3 | 6 | 12 (frontend chegirma)
    # Muqobil nomlar (frontend qulayligi uchun)
    tariff_type: str | None = None
    payment_method: str | None = None
    auto_renew: bool = False  # obuna muddati tugagach avtomatik yangilash (kelajakdagi funksiya)


class TariffConfirmRequest(BaseModel):
    transaction_id: int
    tx_hash: str | None = None  # buy da topilmasa bo'sh, confirm'da find_native_payment orqali qidiriladi


@router.get("/api/user/tariff")
async def get_user_tariff(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Joriy tarif, komissiya, limit va hisob statistikasi."""
    await ensure_tariff_valid(current_user, db)
    if current_user.tariff_type == "free":
        await db.commit()
    payload = tariff_payload(current_user)
    payload["requests_per_minute"] = await db_requests_per_minute(
        db, current_user.tariff_type or "free"
    )
    return payload


@router.get("/api/tariff/current")
async def get_current_tariff(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alias: joriy tarif (spec `/tariff/current`)."""
    return await get_user_tariff(current_user, db)


@router.get("/api/tariff/list")
async def get_tariff_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alias: tariflar katalogi (spec `/tariff/list`)."""
    return await get_tariff_plans(current_user, db)


from app.services.cache import cache_response


@router.get("/api/tariff/payment-info")
@cache_response(ttl=300, prefix="tariffs_pub")
async def get_public_payment_info(db: AsyncSession = Depends(get_db)):
    """PUBLIC: to'lov manzili (TON / GRAM platforma hamyoni).

    Foydalanuvchi UI'sida to'lov qaysi manzilga yuborilishini ko'rsatish uchun.
    USDT to'lovi butunlay olib tashlangan — faqat TON / GRAM qabul qilinadi.
    """
    ton_wallet = await get_platform_wallet_address(db)
    return {
        "ton_wallet_address": ton_wallet,
        "currencies": ["TON"],
    }


@router.get("/api/tariffs")
@cache_response(ttl=300, prefix="tariffs_pub")
async def get_public_tariffs(db: AsyncSession = Depends(get_db)):
    """PUBLIC: barcha aktiv tariflar va joriy sozlamalari.

    Admin panel (`/api/admin/tariffs` va `PUT /api/admin/tariffs/{id}`) orqali
    o'zgartirilgan narxlar (TON/USDT), komissiya va rate-limit qiymatlari shu
    endpoint orqali client-side narxlar sahifasiga real vaqtda uzatiladi.
    Autentifikatsiya talab qilinmaydi.
    """
    await ensure_default_tariffs(db)

    res = await db.execute(
        select(Tariff).where(Tariff.is_active.is_(True)).order_by(Tariff.price_gram.asc())
    )
    tariffs = res.scalars().all()

    return {
        "plans": [serialize_tariff(t) for t in tariffs],
        "currency": ["TON"],
        "duration_days": TARIFF_DAYS,
    }


@router.get("/api/v1/tariffs")
async def get_public_tariffs_v1(db: AsyncSession = Depends(get_db)):
    """PUBLIC: faol (is_active) tariflar ro'yxati — v1 katalog.

    Admin Panel (admin_backend: PostgreSQL) orqali kiritilgan o'zgarishlar
    shu endpoint orqali frontend Subscriptions sahifasiga dinamik uzatiladi.
    Arxivlangan (is_archived) tariflar ko'rsatilmaydi.
    """
    await ensure_default_tariffs(db)

    res = await db.execute(
        select(Tariff)
        .where(Tariff.is_active.is_(True), Tariff.is_archived.is_(False))
        .order_by(Tariff.price_gram.asc())
    )
    tariffs = res.scalars().all()

    return [serialize_tariff(t) for t in tariffs]


@router.get("/api/tariff/plans")
async def get_tariff_plans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tariflar katalogi (Free/Lite/Pro) + joriy reja.

    Tarif narxlari va limitlari DB'dan (admin panel sozlamalari) olinadi.
    """
    await ensure_tariff_valid(current_user, db)
    if current_user.tariff_type == "free":
        await db.commit()

    await ensure_default_tariffs(db)
    res = await db.execute(select(Tariff).order_by(Tariff.price_gram.asc()))
    tariffs = res.scalars().all()

    plans = [serialize_tariff(t) for t in tariffs if t.is_active]
    if not plans:
        plans = [serialize_tariff(t) for t in tariffs]

    return {
        "plans": plans,
        "current_plan": current_user.tariff_type,
        "user": tariff_payload(current_user),
    }


@router.get("/api/tariff/history")
async def get_tariff_history(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foydalanuvchi sotib olgan tariflar — "Obuna tarixi".

    Har bir yozuv TARIFF turidagi tranzaksiyadan hosil qilinadi (yangi xarid /
    muddat uzaytirish). Umumiy "Tranzaksiyalar" ro'yxatidan ajratilgan holda
    faqat obuna xaridlari tarixi qaytariladi:
      action     : "purchase" (yangi xarid) | "extend" (muddati uzaytirildi)
      starts_at / expires_at : obuna amal qilish davri (completed bo'lsa)
    """
    await ensure_tariff_valid(current_user, db)
    if current_user.tariff_type == "free":
        await db.commit()

    stmt = (
        select(Transaction)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == TransactionType.TARIFF,
        )
        .order_by(desc(Transaction.created_at))
    )
    result = await db.execute(stmt)
    txs = result.scalars().all()

    history = []
    prev_expiry = None  # oldingi (tarixdagi) xaridning tugash sanasi — "extend"ni aniqlash uchun
    for tx in reversed(txs):
        meta = tx.transaction_metadata or {}
        try:
            duration_days = int(meta.get("duration_days") or TARIFF_DAYS)
        except (TypeError, ValueError):
            duration_days = TARIFF_DAYS

        starts_at = tx.completed_at or tx.created_at
        expires_at = None
        if starts_at is not None:
            expires_at = starts_at + timedelta(days=duration_days)

        plan_id = meta.get("plan_id")
        plan = get_tariff(plan_id) if plan_id else None
        plan_name = meta.get("plan_name") or (plan.name if plan else "Standard")

        action = "purchase"
        if starts_at is not None and prev_expiry is not None:
            start_utc = starts_at.replace(tzinfo=timezone.utc) if starts_at.tzinfo is None else starts_at
            prev_utc = prev_expiry.replace(tzinfo=timezone.utc) if prev_expiry.tzinfo is None else prev_expiry
            if prev_utc > start_utc:
                action = "extend"
        if expires_at is not None:
            prev_expiry = expires_at

        history.append({
            "id": tx.id,
            "plan_id": plan_id,
            "plan_name": plan_name,
            "action": action,
            "amount": round(float(tx.amount or 0), 6),
            "currency": tx.currency or "GRAM",
            "status": tx.status.value,
            "duration_days": duration_days,
            "starts_at": starts_at.isoformat() if starts_at else None,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
        })

    # Yangi -> eski tartibda sahifalash (offset/limit)
    history.reverse()
    total = len(history)
    page = history[offset:offset + limit]

    return {
        "history": page,
        "total": total,
        "page_size": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


async def _activate_tariff(user: User, tx: Transaction, db: AsyncSession, tx_hash: str) -> None:
    """Blockchain to'lovi tasdiqlangach tarifni avtomatik faollashtiradi.

    Spec bo'yicha: tariff_expires_at = NOW() + 30 kun (sotib olingan vaqtdan
    roppa-rosa 30 kun), tariff_id esa yangi sotib olingan tarifning ID si qilib
    belgilanadi.
    """
    now = datetime.now(timezone.utc)

    plan = get_tariff(tx.transaction_metadata.get("plan_id") if tx.transaction_metadata else None)

    # Komissiya admin panel (DB) sozlamasidan olinadi, aks holda katalog qiymati
    commission = plan.commission_percent
    db_tariff = await get_db_tariff(db, plan.name)
    if db_tariff and db_tariff.is_active:
        commission = db_tariff.commission_percent

    # Obuna muddati (duration_months asosida) — tx.metadata dan, aks holda standart TARIFF_DAYS
    try:
        duration_days = int(tx.transaction_metadata.get("duration_days") or TARIFF_DAYS)
    except Exception:
        duration_days = TARIFF_DAYS

    user.tariff_type = plan.id
    user.tariff_plan = plan.name
    user.tariff_id = db_tariff.id if db_tariff else None
    user.commission_rate = round(commission / 100.0, 4)
    user.tariff_expires_at = now + timedelta(days=duration_days)
    user.total_transactions = (user.total_transactions or 0) + 1

    tx.status = TransactionStatus.COMPLETED
    tx.tx_hash = tx_hash
    tx.completed_at = func.now()
    logger.info("Tariff activated: user=%s plan=%s duration_days=%s tx_hash=%s", user.username, plan.id, duration_days, tx_hash)

    await _credit_platform_wallet(db, tx)


@router.post("/api/tariff/buy")
@router.post("/api/tariff/buy/")
async def buy_tariff(
    data: TariffBuyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tarif sotib olish — REAL TON tranzaksiyasi yuboradi va avtomatik faollashtiradi.

    To'lov foydalanuvchi mnemonic hamyonidan platforma hamyoniga (PLATFORM_WALLET_ADDRESS,
    .env orqali sozlanadi) yuboriladi.
    Blockchain'da kamida 1 konfirmatsiya kelgach tarif avtomatik yangilanadi.
    """
    if not current_user.wallet_connected or not current_user.wallet_address:
        raise HTTPException(status_code=400, detail="Hamyon ulanmagan")

    plan_id = (data.plan_id or data.tariff_type or "").strip().lower()
    if not plan_id:
        raise HTTPException(status_code=400, detail="plan_id / tariff_type talab qilinadi")

    plan = get_tariff(plan_id)
    if plan.id == "free":
        raise HTTPException(status_code=400, detail="Free tarifni xarid qilib bo'lmaydi")

    from app.services.expiration_service import is_expired

    if current_user.tariff_type != "free" and not is_expired(current_user):
        raise HTTPException(
            status_code=400,
            detail="Sizda allaqachon faol obuna mavjud. Yangi tarifni amaldagi obuna muddati tugagach xarid qilishingiz mumkin.",
        )

    current_user.auto_renew = data.auto_renew

    # Narx admin panel (DB Tariff jadvali) sozlamasidan olinadi, aks holda katalog qiymati
    db_tariff = await get_db_tariff(db, plan.name)
    price_gram = db_tariff.price_gram if db_tariff else plan.price_gram

    # Obuna muddati va chegirma (frontend Subscriptions.jsx bilan mos)
    duration_months = data.duration_months or 1
    if duration_months not in (1, 3, 6, 12):
        raise HTTPException(status_code=400, detail="duration_months 1, 3, 6 yoki 12 bo'lishi kerak")
    DISCOUNTS = {1: 0, 3: 10, 6: 20, 12: 30}
    discount_pct = DISCOUNTS.get(duration_months, 0)

    currency = (data.currency or data.payment_method or "ton").strip().lower()
    if currency in ("ton", "gram"):
        base = price_gram
        pm = PaymentMethod.GRAM
        cur_str = "TON"
    else:
        raise HTTPException(
            status_code=400,
            detail="Noto'g'ri currency. Faqat 'ton' (GRAM) to'lov usuli qo'llab-quvvatlanadi. USDT olib tashlangan.",
        )

    raw_total = round(base * duration_months, 6)
    amount = round(raw_total - (raw_total * discount_pct / 100), 6)
    duration_days = TARIFF_DAYS * duration_months

    if not current_user.wallet_seed_encrypted:
        raise HTTPException(
            status_code=400,
            detail="To'lov uchun hamyon mnemonic (seed-phrase) orqali ulangan bo'lishi shart",
        )

    # ========== BALANS TEKSHIRISH (Instant Error if Insufficient) ==========
    user_balance = current_user.balance_gram or 0.0

    if current_user.wallet_address and PYTONIQ_AVAILABLE:
        try:
            live_bal = await ton_balance.get_wallet_balance(current_user.wallet_address)
            user_balance = max(user_balance, float(live_bal.get("ton_balance", 0.0) or 0.0))
        except Exception:
            pass

    if user_balance < amount:
        raise HTTPException(
            status_code=400,
            detail=f"Mablag' yetarsiz: Balansingizda {round(user_balance, 4)} {cur_str} bor. Ushbu {plan.name} tarifi uchun {amount} {cur_str} zarur. Iltimos balansingizni to'ldiring!",
        )

    platform_wallet = await get_platform_wallet_for_currency(db, cur_str)

    tx = Transaction(
        user_id=current_user.id,
        transaction_type=TransactionType.TARIFF,
        status=TransactionStatus.PENDING,
        payment_method=pm,
        amount=amount,
        commission_amount=0.0,
        commission_rate=0.0,
        currency=cur_str,
        destination_wallet=platform_wallet,
        transaction_metadata={
            "plan_id": plan.id,
            "plan_name": plan.name,
            "duration_months": duration_months,
            "duration_days": duration_days,
            "memo": f"tariff:{plan.id}",
        },
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)

    memo = f"tariff:{plan.id}:{tx.id}"

    # ---- REAL TON transfer ----
    if not PYTONIQ_AVAILABLE:
        tx.status = TransactionStatus.FAILED
        tx.error_message = "pytoniq o'rnatilmagan"
        await db.commit()
        raise HTTPException(
            status_code=503,
            detail="To'lov tizimi hozircha mavjud emas (pytoniq sozlanmagan). Iltimos keyinroq urinib ko'ring.",
        )

    try:
        tx_hash = await ton_wallet_service.execute_ton_transfer(
            encrypted_seed=current_user.wallet_seed_encrypted,
            destination=platform_wallet,
            amount_ton=amount,
            comment=memo,
            expected_address=current_user.wallet_address,
        )
    except Exception as exc:
        logger.error("Tariff transfer error user=%s tx=%s: %s", current_user.username, tx.id, exc)
        tx.status = TransactionStatus.FAILED
        tx.error_message = str(exc)
        await db.commit()
        if isinstance(exc, InvalidToken) or "token" in str(type(exc)).lower():
            raise HTTPException(
                status_code=400,
                detail="To'lov bajarilmadi: saqlangan hamyon paroli ochilmadi. Iltimos hamyonni qaytadan ulang (mnemonic seed-phrase kiritib).",
            )
        raise HTTPException(
            status_code=400,
            detail=f"To'lov bajarilmadi: {exc}. Balansingiz yetarsiz yoki hamyon paroli noto'g'ri!",
        )

    # ---- Konfirmatsiyani kutish (kamida 1 konfirmatsiya) ----
    if tx_hash:
        tx.tx_hash = tx_hash
        await db.commit()

    verified = None
    if tx_hash:
        for _ in range(CONFIRM_ATTEMPTS):
            await asyncio.sleep(CONFIRM_DELAY_SECONDS)
            verified = await ton_verify_service.verify_native_payment(
                tx_hash=tx_hash,
                recipient=platform_wallet,
                sender=current_user.wallet_address,
                expected_amount_ton=amount,
            )
            if verified.get("verified"):
                break

    if verified and verified.get("verified"):
        await _activate_tariff(current_user, tx, db, tx_hash)
        await db.commit()
        return {
            "success": True,
            "status": "completed",
            "transaction_id": tx.id,
            "tx_hash": tx_hash,
            "plan_id": plan.id,
            "plan_name": plan.name,
            "amount": amount,
            "currency": cur_str,
            "message": f"{plan.name} tarifi muvaffaqiyatli faollashtirildi ({duration_days} kun). Komissiya {plan.commission_percent}% gacha yangilandi.",
            "tariff": tariff_payload(current_user),
        }

    # Tranzaksiya yuborildi lekin hali konfirmatsiya kelmadi — frontend /confirm orqali yakunlashi mumkin
    return {
        "success": True,
        "status": "pending",
        "transaction_id": tx.id,
        "tx_hash": tx_hash,
        "plan_id": plan.id,
        "plan_name": plan.name,
        "amount": amount,
        "currency": cur_str,
        "wallet_address": platform_wallet,
        "memo": memo,
        "message": "Tranzaksiya yuborildi, blockchain konfirmatsiyasi kutilmoqda. Bu bir necha soniya olishi mumkin.",
    }


@router.post("/api/tariff/confirm")
async def confirm_tariff(
    data: TariffConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """To'lov blockchain'da tasdiqlangach tarifni avtomatik faollashtiradi."""
    if not current_user.wallet_connected or not current_user.wallet_address:
        raise HTTPException(status_code=400, detail="Hamyon ulanmagan")

    tx = await db.get(Transaction, data.transaction_id)
    if not tx or tx.user_id != current_user.id or tx.transaction_type != TransactionType.TARIFF:
        raise HTTPException(status_code=404, detail="Tranzaksiya topilmadi")
    if tx.status == TransactionStatus.COMPLETED:
        return {"success": True, "message": "Tarif allaqachon faollashtirilgan", "tariff": tariff_payload(current_user)}
    if tx.status != TransactionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Tranzaksiya holati to'lovga tayyor emas")

    platform_wallet = await get_platform_wallet_address(db)
    # 1) Berilgan tx_hash bo'yicha tekshirish (agar buy real hash topgan bo'lsa)
    verification = {"verified": False, "reason": "tx_hash ko'rsatilmagan"}
    if data.tx_hash:
        verification = await ton_verify_service.verify_native_payment(
            tx_hash=data.tx_hash,
            recipient=platform_wallet,
            sender=current_user.wallet_address,
            expected_amount_ton=tx.amount,
        )
    # 2) tx_hash bo'lmasa yoki tasdiqlanmasa — blockchain'da sender+summa+memo orqali qidirish
    if not verification.get("verified"):
        tx_hash_found = await ton_verify_service.find_native_payment(
            recipient=platform_wallet,
            sender=current_user.wallet_address,
            expected_amount_ton=tx.amount,
            comment=str(tx.transaction_metadata.get("memo", "") if tx.transaction_metadata else ""),
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
        reason = verification.get("reason", "Tranzaksiya tasdiqlanmadi")
        raise HTTPException(
            status_code=400,
            detail=f"To'lov tasdiqlanmadi: {reason}. Tranzaksiya blockchain'da ko'rinmaguncha kutib turing.",
        )

    real_tx_hash = verification.get("tx_hash") or data.tx_hash or ""

    # Avtomatik faollashtirish (muddati: hozirgi muddatdan cho'ziladi)
    plan = get_tariff(tx.transaction_metadata.get("plan_id") if tx.transaction_metadata else None)
    tx.tx_hash = real_tx_hash
    await _activate_tariff(current_user, tx, db, real_tx_hash)

    await db.commit()

    try:
        conf_days = int((tx.transaction_metadata or {}).get("duration_days") or TARIFF_DAYS)
    except Exception:
        conf_days = TARIFF_DAYS

    return {
        "success": True,
        "message": f"{plan.name} tarifi muvaffaqiyatli faollashtirildi ({conf_days} kun). Komissiya {plan.commission_percent}% gacha yangilandi.",
        "tariff": tariff_payload(current_user),
    }


@router.get("/api/admin/commissions")
async def get_commissions(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: umumiy komissiya statistikasi va platforma hamyoni."""
    total_gram = (
        (
            await db.execute(
                select(func.coalesce(func.sum(Transaction.commission_amount), 0.0)).where(
                    Transaction.status == TransactionStatus.COMPLETED,
                    Transaction.currency == "TON",
                )
            )
        ).scalar()
        or 0.0
    )
    total_usdt = (
        (
            await db.execute(
                select(func.coalesce(func.sum(Transaction.commission_amount), 0.0)).where(
                    Transaction.status == TransactionStatus.COMPLETED,
                    Transaction.currency == "USDT",
                )
            )
        ).scalar()
        or 0.0
    )

    recent = (
        await db.execute(
            select(Transaction)
            .where(Transaction.commission_amount > 0)
            .order_by(desc(Transaction.created_at))
            .limit(50)
        )
    ).scalars().all()

    platform_wallet = await get_platform_wallet_address(db)

    return {
        "platform_wallet": platform_wallet,
        "total_commission_ton": round(float(total_gram), 6),
        "total_commission_usdt": round(float(total_usdt), 6),
        "recent": [
            {
                "id": t.id,
                "user_id": t.user_id,
                "type": t.transaction_type.value,
                "amount": t.amount,
                "currency": t.currency,
                "commission": t.commission_amount,
                "commission_rate": t.commission_rate,
                "status": t.status.value,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in recent
        ],
    }