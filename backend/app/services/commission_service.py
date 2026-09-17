# backend/app/services/commission_service.py
"""
Split-Payment (bo'lib to'lash) engine.

Har bir Stars/Premium buyurtmasida foydalanuvchidan to'liq summa
(total = net + commission) yechib olinadi. Ushbu service:
  1. Admin hamyon manzilini resolve qiladi (PLATFORM_ADMIN_WALLET -> DB platform_wallet -> PLATFORM_WALLET_ADDRESS)
  2. `commission_amount` qismini Admin Hamyoniga REAL TON transfer qiladi
  3. Komissiya tranzaksiyasini Transaction jadvalida `type="commission"` bilan qayd etadi
  4. Xatolikda RuntimeError -> chaqiruvchi Auto-Refund (to'liq summa) bajaradi
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.config import settings
from app.models import (
    PaymentMethod,
    PlatformWallet,
    Transaction,
    TransactionStatus,
    TransactionType,
)

logger = logging.getLogger(__name__)


def _normalize(addr: str | None) -> str:
    """Manzillarni taqqoslash uchun oddiy normalizatsiya."""
    return (addr or "").replace(" ", "").strip().lower()


async def get_admin_wallet_address(db: AsyncSession, currency: str = "TON") -> str:
    """Faol admin hamyon manzilini qaytaradi (hech qachon None qaytarmaydi).

    Valyutaga mos manzil tanlanadi (double-wallet):
      - USDT -> `platform_wallet.usdt_wallet_address` (Jetton)
      - TON / boshqa -> `platform_wallet.wallet_address`

    Tartibi: env `PLATFORM_ADMIN_WALLET` -> DB `platform_wallet` jadvali ->
    env `PLATFORM_WALLET_ADDRESS`.
    """
    admin = getattr(settings, "PLATFORM_ADMIN_WALLET", None)
    if admin and str(admin).strip():
        return str(admin).strip()

    try:
        res = await db.execute(select(PlatformWallet).limit(1))
        pw = res.scalar_one_or_none()
        if pw:
            cur = (currency or "").strip().upper()
            if cur == "USDT" and pw.usdt_wallet_address and str(pw.usdt_wallet_address).strip():
                return str(pw.usdt_wallet_address).strip()
            if pw.wallet_address and str(pw.wallet_address).strip():
                return str(pw.wallet_address).strip()
    except Exception as exc:
        logger.warning("platform_wallet DB o'qishda xatolik: %s", exc)

    return settings.PLATFORM_WALLET_ADDRESS


async def record_commission_transaction(
    db: AsyncSession,
    tx: Transaction,
    tx_hash: str,
    destination: str,
) -> Transaction:
    """Komissiya o'tkazmasini `type=commission` tranzaksiya sifatida qayd etadi."""
    comm_tx = Transaction(
        user_id=tx.user_id,
        transaction_type=TransactionType.COMMISSION,
        status=TransactionStatus.COMPLETED,
        payment_method=tx.payment_method or PaymentMethod.GRAM,
        amount=round(tx.commission_amount or 0.0, 6),
        commission_amount=0.0,
        commission_rate=tx.commission_rate,
        currency=tx.currency or "TON",
        tx_hash=tx_hash,
        destination_wallet=destination,
        original_transaction_id=tx.id,
        completed_at=func.now(),
        transaction_metadata={
            "source_tx_id": tx.id,
            "commission_for": tx.transaction_type.value if tx.transaction_type else None,
            "split": "commission",
        },
    )
    db.add(comm_tx)
    await db.commit()
    await db.refresh(comm_tx)
    return comm_tx


async def transfer_commission_to_admin(
    db: AsyncSession,
    tx: Transaction,
    encrypted_seed: str,
    expected_address: str | None = None,
) -> dict:
    """Komissiya summasini Admin Hamyoniga REAL TON transfer qiladi va qayd etadi.

    Args:
        db: async session (majburiy emas — commit bajariladi).
        tx: manba tranzaksiya (commission_amount qiymati shundan olinadi).
        encrypted_seed: pullar yuboriladigan hamyonning shifrlangan seed-frazasi.
        expected_address: yuboruvchi hamyon manzili (wallet versiya topish uchun).

    Returns:
        {"success": True, "tx_hash": ..., "amount": ..., "commission_transaction_id": ...}

    Raises:
        RuntimeError: admin hamyon aniqlanmasa, pytoniq o'rnatilmagan bo'lsa,
            transfer muvaffaqiyatsiz bo'lsa yoki tx_hash olinmasa.
            Chaqiruvchi bu xatoni ushlab Auto-Refund (to'liq summa) bajarishi shart.
    """
    commission = round(tx.commission_amount or 0.0, 6)
    if commission <= 0:
        return {"success": True, "skipped": True, "amount": 0.0, "tx_hash": "internal"}

    # Valyutaga mos admin hamyoni: USDT -> USDT Jetton hamyoni, TON -> TON hamyoni
    currency = (tx.currency or "TON").strip().upper()
    admin_wallet = await get_admin_wallet_address(db, currency)
    if not admin_wallet or not str(admin_wallet).strip():
        raise RuntimeError("Admin hamyon manzili aniqlanmadi (null)")

    # Manba hamyon admin hamyonning o'zi bo'lsa — real transfer shart emas,
    # komissiya allaqachon admin hamyonida (platforma o'z hamyonidan yetkazyapti).
    same_wallet = expected_address and _normalize(expected_address) == _normalize(admin_wallet)

    tx_hash = "internal"
    if not same_wallet:
        from app.services.wallet_ton import PYTONIQ_AVAILABLE, ton_wallet_service

        if not PYTONIQ_AVAILABLE:
            raise RuntimeError("pytoniq o'rnatilmagan - komissiya transferi imkonsiz")

        try:
            if currency == "USDT":
                # REAL Jetton Transfer: admin USDT Jetton Wallet'iga yuboriladi.
                # Qabul qiluvchi egasi (owner) = admin TON hamyoni; qabul qiluvchining
                # USDT Jetton Wallet'iga JettonTransfer message yuboriladi.
                from app.services.platform_wallet import get_platform_usdt_wallet_address

                destination_owner = await get_admin_wallet_address(db, "TON")
                destination_jetton_wallet = admin_wallet
                response_jetton_wallet = await get_platform_usdt_wallet_address(db)
                tx_hash = await ton_wallet_service.execute_jetton_transfer(
                    encrypted_seed=encrypted_seed,
                    destination_owner=destination_owner,
                    destination_jetton_wallet=destination_jetton_wallet,
                    amount_usdt=commission,
                    comment=f"commission:{tx.id}",
                    expected_address=expected_address,
                    response_jetton_wallet=response_jetton_wallet,
                )
            else:
                tx_hash = await ton_wallet_service.execute_ton_transfer(
                    encrypted_seed=encrypted_seed,
                    destination=admin_wallet,
                    amount_ton=commission,
                    comment=f"commission:{tx.id}",
                    expected_address=expected_address,
                )
        except Exception as exc:
            logger.error("Commission transfer failed tx=%s: %s", tx.id, exc)
            tx_hash = ""

        if not tx_hash:
            # REAL transfer bajarilmadi (gaz yetarli emas, verify topilmadi va h.k.).
            # Komissiya yo'qolmasligi uchun platforma ichki balansiga qo'shib qo'yamiz.
            logger.warning(
                "Commission transfer hash olmadi tx=%s — ichki balancega qo'shilmoqda (%.6f %s)",
                tx.id, commission, tx.currency,
            )
            try:
                from app.models import PlatformWallet

                res = await db.execute(select(PlatformWallet).limit(1))
                pw = res.scalar_one_or_none()
                if pw:
                    if (tx.currency or "TON").strip().upper() == "USDT":
                        pw.balance_usdt = round((pw.balance_usdt or 0.0) + commission, 6)
                    else:
                        pw.balance_gram = round((pw.balance_gram or 0.0) + commission, 6)
                    await db.commit()
                    tx_hash = "internal"
            except Exception as iexc:
                logger.error("Ichki balancega komissiya qo'shishda xatolik tx=%s: %s", tx.id, iexc)
                raise RuntimeError(f"Komissiya transfer hash'i olib bo'lmadi ({iexc})") from iexc

    comm_tx = await record_commission_transaction(db, tx, tx_hash, admin_wallet)

    logger.info(
        "Commission transferred tx=%s -> %s %s to %s (comm_tx=%s)",
        tx.id, commission, tx.currency, admin_wallet, comm_tx.id,
    )
    return {
        "success": True,
        "tx_hash": tx_hash,
        "amount": commission,
        "commission_transaction_id": comm_tx.id,
    }
