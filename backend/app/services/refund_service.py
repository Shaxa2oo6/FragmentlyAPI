# backend/app/services/refund_service.py
"""
Qaytarish (Refund) tizimi.

Agar buyurtma (Stars/Premium yetkazish) texnik sabab bilan bajarilmasa,
asosiy summa + komissiya to'liq foydalanuvchi hamyoniga qaytariladi (platforma
o'z hamyonidan). Alohida `refund` tipidagi tranzaksiya yaratiladi.

Platforma seed'i admin panel orqali ulangan `platform_wallet` jadvalidagi
`wallet_seed_encrypted` (Fernet shifrlangan 24 so'zli mnemonic) dan olinadi.
Seed ulangan bo'lmasa, refund amalga oshirilmaydi va sabab qaytariladi — bu
to'g'ri (mainnet'da real pullar sariq).
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.models import (
    PaymentMethod,
    Transaction,
    TransactionStatus,
    TransactionType,
    User,
)
from app.services.platform_wallet import get_platform_wallets

logger = logging.getLogger(__name__)


async def _resolve_platform_seed(db: AsyncSession) -> "str | None":
    """Admin panel orqali ulangan platforma hamyon seed-frazasini ochadi."""
    p_wallet = await get_platform_wallets(db)
    if not p_wallet or not p_wallet.wallet_seed_encrypted or not p_wallet.seed_connected:
        return None
    try:
        from app.services.wallet_ton import ton_wallet_service

        return ton_wallet_service.decrypt_mnemonic(p_wallet.wallet_seed_encrypted)
    except Exception as exc:
        logger.error("Platforma seed ochishda xatolik: %s", exc)
        return None


async def refund_transaction(db: AsyncSession, user_id: int, transaction_id: int, reason: str = "") -> dict:
    """Buyurtmani to'liq qaytaradi (asosiy summa + komissiya)."""
    tx = await db.get(Transaction, transaction_id)
    if not tx or tx.user_id != user_id:
        raise ValueError("Tranzaksiya topilmadi")
    if tx.status == TransactionStatus.REFUNDED:
        return {"success": True, "message": "Allaqachon qaytarilgan"}

    user = await db.get(User, user_id)
    if not user or not user.wallet_address:
        raise ValueError("Foydalanuvchi hamyoni topilmadi")

    total_refundable = round((tx.amount or 0.0), 6)  # amount allaqachon komissiyani o'z ichiga olgan
    platform_seed = await _resolve_platform_seed(db)
    currency = tx.currency or "TON"

    reason = reason or tx.error_message or "Buyurtma bajarilmadi — texnik sabab"

    if not platform_seed:
        tx.status = TransactionStatus.FAILED
        tx.error_message = (
            f"Refund amalga oshirilmadi: platforma hamyoni (24 so'zli seed) ulanishmagan. Sabab: {reason}"
        )
        await db.commit()
        return {
            "success": False,
            "message": "Refund uchun platforma hamyoni (seed-phrase) ulanishmagan",
        }

    tx_hash = None
    try:
        from app.services.wallet_ton import ton_wallet_service

        encrypted_seed = ton_wallet_service.encrypt_mnemonic(platform_seed)

        if tx.payment_method == PaymentMethod.USDT:
            # USDT (Jetton) refund: platforma o'z USDT Jetton hamyonidan foydalanuvchiga qaytaradi.
            user_jetton_wallet = await ton_wallet_service.resolve_usdt_jetton_wallet(user.wallet_address)
            if not user_jetton_wallet:
                raise RuntimeError("Foydalanuvchining USDT Jetton hamyoni aniqlanmadi")
            tx_hash = await ton_wallet_service.execute_jetton_transfer(
                encrypted_seed=encrypted_seed,
                destination_owner=user.wallet_address,
                destination_jetton_wallet=user_jetton_wallet,
                amount_usdt=total_refundable,
                comment=f"refund:{transaction_id}",
            )
        else:
            # Native TON/GRAM refund: platforma o'z hamyonidan foydalanuvchiga qaytaradi
            tx_hash = await ton_wallet_service.execute_ton_transfer(
                encrypted_seed=encrypted_seed,
                destination=user.wallet_address,
                amount_ton=total_refundable,
                comment=f"refund:{transaction_id}",
            )
    except Exception as exc:
        logger.error("Refund transfer failed tx=%s: %s", transaction_id, exc)
        tx.status = TransactionStatus.FAILED
        tx.error_message = f"Refund transferda xatolik: {exc}"
        await db.commit()
        return {"success": False, "message": f"Refund transferda xatolik: {exc}"}

    # Asl tranzaksiyani REFUNDED qilish
    tx.status = TransactionStatus.REFUNDED
    tx.refund_reason = reason
    await db.commit()

    # Alohida refund tranzaksiyasi
    refund_tx = Transaction(
        user_id=user_id,
        transaction_type=TransactionType.REFUND,
        status=TransactionStatus.COMPLETED,
        payment_method=tx.payment_method,
        amount=total_refundable,
        commission_amount=0.0,
        commission_rate=0.0,
        currency=currency,
        tx_hash=tx_hash,
        is_refund=True,
        original_transaction_id=transaction_id,
        refund_reason=reason,
        completed_at=func.now(),
    )
    db.add(refund_tx)
    user.total_transactions = (user.total_transactions or 0) + 1
    await db.commit()
    await db.refresh(refund_tx)

    logger.info("Refund completed: tx=%s -> refund_tx=%s amount=%s %s", transaction_id, refund_tx.id, total_refundable, currency)
    return {
        "success": True,
        "message": f"To'liq qaytarildi: {total_refundable} {currency}",
        "refund_transaction_id": refund_tx.id,
        "tx_hash": tx_hash,
        "amount": total_refundable,
        "currency": currency,
    }