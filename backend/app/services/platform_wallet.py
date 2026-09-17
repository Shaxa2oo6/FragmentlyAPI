# backend/app/services/platform_wallet.py
"""
Platforma hamyonining DB sozlamasidan manzil olish helper'lari.

To'lovlarni (obuna, komissiya) DB'dagi platform_wallet jadvalida sozlangan
manzilga yo'naltirish uchun ishlatiladi. Agar DB'da manzil bo'lmasa,
env'dagi PLATFORM_WALLET_ADDRESS ishlatiladi.

Double-wallet (TON + USDT Jetton):
  - TON/GRAM to'lovlari va komissiyasi  -> `wallet_address` (TON hamyoni)
  - USDT to'lovlari va komissiyasi      -> `usdt_wallet_address` (USDT Jetton hamyoni)
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import PlatformWallet, Transaction


async def get_platform_wallets(db: AsyncSession) -> "PlatformWallet | None":
    """DB'dagi platforma hamyon yozuvini qaytaradi (yoki None)."""
    res = await db.execute(select(PlatformWallet).limit(1))
    return res.scalar_one_or_none()


async def get_platform_wallet_address(db: AsyncSession) -> str:
    """DB'da sozlangan platforma TON hamyon manzilini qaytaradi (fallback: env)."""
    pw = await get_platform_wallets(db)
    if pw and pw.wallet_address and str(pw.wallet_address).strip():
        return str(pw.wallet_address).strip()
    return settings.PLATFORM_WALLET_ADDRESS


async def get_platform_usdt_wallet_address(db: AsyncSession) -> str:
    """DB'da sozlangan platforma USDT (Jetton) hamyon manzilini qaytaradi.

    USDT Jetton hamyoni o'rnatilmagan bo'lsa — TON hamyoni ishlatiladi
    (USDT Jettonlari egalik qiluvchi TON manziliga yuboriladi).
    """
    pw = await get_platform_wallets(db)
    if pw and pw.usdt_wallet_address and str(pw.usdt_wallet_address).strip():
        return str(pw.usdt_wallet_address).strip()
    return await get_platform_wallet_address(db)


async def get_platform_wallet_for_currency(db: AsyncSession, currency: str) -> str:
    """To'lov valyutasiga mos platforma hamyon manzilini qaytaradi.

    - 'USDT'  -> USDT (Jetton) hamyoni
    - boshqa  -> TON hamyoni (GRAM / TON)
    """
    cur = (currency or "").strip().upper()
    if cur == "USDT":
        return await get_platform_usdt_wallet_address(db)
    return await get_platform_wallet_address(db)


async def credit_platform_wallet(db: AsyncSession, tx: Transaction) -> None:
    """Muvaffaqiyatli to'lovda platforma hamyoni balansi va komissiyasini yangilaydi.

    To'lov summasi ham, komissiya summasi ham valyutaga mos platforma hamyoniga
    (platform_wallet jadvalida saqlangan manzil) tushadi.
    """
    p_wallet = await get_platform_wallets(db)
    if not p_wallet:
        return

    amount = tx.amount or 0.0
    commission = tx.commission_amount or 0.0

    if tx.currency == "USDT":
        p_wallet.balance_usdt = round((p_wallet.balance_usdt or 0.0) + amount, 6)
        p_wallet.total_commission_usdt = round((p_wallet.total_commission_usdt or 0.0) + commission, 6)
    else:
        p_wallet.balance_gram = round((p_wallet.balance_gram or 0.0) + amount, 6)
        p_wallet.total_commission_gram = round((p_wallet.total_commission_gram or 0.0) + commission, 6)
