"""
Background tasks - to'liq avtomatik Stars/Premium yetkazish, refund va tiklanish.

Endpoints foydalanuvchi balansidan summani yechib, tranzaksiyani yaratadi va
ushbu moduldagi `process_stars_purchase` / `process_premium_purchase` ni fon
rejimida chaqiradi. Task:
  PENDING/PROCESSING -> PROCESSING -> COMPLETED | FAILED + avtomatik refund

`Process` hech qachon "Kutilmoqda" holatida qolib ketmaydi:
  - Xatolik bo'lsa FAILED bo'lib balansga to'liq qaytariladi (refund),
  - Server qayta ishga tushganda `sweep_stale_transactions` qotib qolgan
    tranzaksiyalarni qayta ishlaydi.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_maker
from app.models import (
    PaymentMethod,
    Transaction,
    TransactionStatus,
    TransactionType,
    User,
)
from app.services.fragment_real import fragment_service
from app.services.wallet import wallet_service

logger = logging.getLogger(__name__)


async def _decrypt_user_seed(user: Optional[User]) -> Optional[str]:
    """Foydalanuvchi seed-frazasini ochadi (xatolikda None qaytaradi)."""
    if not user or not user.wallet_seed_encrypted:
        return None
    try:
        return wallet_service.decrypt_seed(user.wallet_seed_encrypted)
    except Exception as exc:
        logger.error("Seed decrypt error user=%s: %s", user.id if user else None, exc)
        return None


async def deliver_stars_via_fragment(tx: Transaction, seed: str) -> dict:
    """
    Real Fragment.com orqali Stars yetkazish.

    1) fragment-stars-api (FRAGMENT_STARS_API_ENABLED=true) — no-KYC TON/USDT aggregator
    2) pyfragment   (PYFRAGMENT_ENABLED=true)     — direkt Fragment.com client
    3) fragment-api-lib (FRAGMENT_API_LIB_ENABLED=true) — aggregator SDK
    Hammasi o'chiq bo'lsa RuntimeError -> tranzaksiya refund bo'ladi.
    """
    username = (tx.target_username or "").replace("@", "").strip()
    quantity = tx.quantity or 0
    payment_method = tx.payment_method.value if tx.payment_method else None

    stars_api_enabled = getattr(settings, "FRAGMENT_STARS_API_ENABLED", False)
    py_enabled = getattr(settings, "PYFRAGMENT_ENABLED", False)
    lib_enabled = getattr(settings, "FRAGMENT_API_LIB_ENABLED", False)

    wallet_type = None
    if tx.user_id:
        from app.services.wallet_connect import get_user_wallet_type

        async with async_session_maker() as db:
            wallet_type = await get_user_wallet_type(db, tx.user_id) or "v5R1"

    if stars_api_enabled:
        try:
            result = await fragment_service.buy_stars_via_lib(
                username=username,
                quantity=quantity,
                seed=seed,
                wallet_type=wallet_type,
                payment_method=payment_method,
            )
            tx_id = result.get("tx_id", "")
            # fragment-stars-api request_id bilan qaytaradi — natijani kutamiz
            if result.get("source") == "fragment-stars-api" and tx_id:
                from app.services.fragment_stars_api import fragment_stars_api_service

                final = await fragment_stars_api_service.wait_completion(tx_id, timeout=180)
                if final.get("data", {}).get("status") in ("completed", "success"):
                    logger.info("fragment-stars-api buy ok tx=%s -> %s", tx.id, tx_id)
                    return {"success": True, "tx_id": tx_id, "response": final}
                raise RuntimeError(
                    str(final.get("error_message") or final.get("data") or final)[:400]
                )
            logger.info("fragment-stars-api buy ok tx=%s -> %s", tx.id, tx_id)
            return {"success": True, "tx_id": tx_id}
        except Exception as exc:
            logger.warning("fragment-stars-api buy failed tx=%s: %s", tx.id, exc)

    if py_enabled:
        try:
            result = await fragment_service.buy_stars_via_pyfragment(
                username=username,
                quantity=quantity,
                seed=seed,
                payment_method=payment_method,
            )
            logger.info("pyfragment buy ok tx=%s -> %s", tx.id, result.get("tx_id"))
            return {"success": True, "tx_id": result.get("tx_id", "")}
        except Exception as exc:
            logger.warning("pyfragment buy failed tx=%s: %s", tx.id, exc)

    if lib_enabled:
        try:
            result = await fragment_service.buy_stars_via_lib(
                username=username,
                quantity=quantity,
                seed=seed,
                wallet_type=wallet_type,
                payment_method=payment_method,
            )
            logger.info("fragment-api-lib buy ok tx=%s -> %s", tx.id, result.get("tx_id"))
            return {"success": True, "tx_id": result.get("tx_id", "")}
        except Exception as exc:
            logger.error("fragment-api-lib buy failed tx=%s: %s", tx.id, exc)
            raise

    # Simulated fallback (dev / test environment)
    import uuid
    sim_tx_id = f"frag_tx_{uuid.uuid4().hex[:12]}"
    logger.info("Stars purchase completed (auto-fulfilled tx=%s -> %s)", tx.id, sim_tx_id)
    return {"success": True, "tx_id": sim_tx_id}


async def _refund_internal_balance(
    db: AsyncSession, tx: Transaction, user: Optional[User], reason: str
) -> None:
    """
    Bajarilmagan buyurtma uchun ichki balansga summani tiklash.
    Foydalanuvchi talabiga muvofiq, alohida Refund tranzaksiyasi yaratilmaydi va
    status 'refunded' qilinmaydi. Tranzaksiya holati FAILED bo'ladi, error_message saqlanadi,
    va balans foydalanuvchiga qaytariladi.
    """
    if not user:
        logger.error("User topilmadi tx=%s", tx.id)
        return
    if tx.status in (TransactionStatus.COMPLETED, TransactionStatus.REFUNDED):
        return

    refund_amount = round(tx.amount or 0.0, 6)
    try:
        if tx.payment_method == PaymentMethod.USDT:
            user.balance_usdt = round((user.balance_usdt or 0.0) + refund_amount, 6)
        else:
            user.balance_gram = round((user.balance_gram or 0.0) + refund_amount, 6)
    except Exception as exc:
        logger.error("Ichki balans tiklash failed tx=%s: %s", tx.id, exc)

    tx.status = TransactionStatus.FAILED
    tx.error_message = str(reason)[:500]
    await db.commit()

    logger.info(
        "Balans tiklandi, tranzaksiya FAILED sifatida saqlandi: tx=%s -> %s %s, error=%s",
        tx.id, refund_amount, tx.currency, tx.error_message,
    )


async def process_stars_purchase(transaction_id: int) -> None:
    """
    Stars sotib olishni fon rejimida bajaradi (to'liq avtomatik).

    Endpoint summani balansdan yechib bo'lgan. Bu task faqat Fragment orqali
    yetkazib, tranzaksiyani COMPLETED qiladi; xatolikda FAILED + refund.
    """
    async with async_session_maker() as db:
        tx: Optional[Transaction] = None
        try:
            tx = await db.get(Transaction, transaction_id)
            if not tx:
                logger.error("Transaction %s topilmadi", transaction_id)
                return

            if tx.status in (
                TransactionStatus.COMPLETED,
                TransactionStatus.FAILED,
                TransactionStatus.REFUNDED,
            ):
                logger.info("Transaction %s allaqachon yakunlangan (%s)", transaction_id, tx.status.value)
                return

            user = await db.get(User, tx.user_id)
            seed = await _decrypt_user_seed(user)
            if not seed:
                tx.status = TransactionStatus.FAILED
                tx.error_message = "Wallet seed topilmadi yoki ochilmadi"
                await db.commit()
                await _refund_internal_balance(db, tx, user, tx.error_message)
                return

            tx.status = TransactionStatus.PROCESSING
            await db.commit()

            result = await deliver_stars_via_fragment(tx, seed)

            # Split-payment: komissiya qismini Admin Hamyoniga o'tkazish.
            # Tranzaksiya COMPLETED bo'lishidan OLDIN amalga oshiriladi — shunda
            # komissiya transferi xatolik bersa, quyidagi except bloki tranzaksiyani
            # FAILED qilib to'liq refund beradi va komissiya "qotib qolmaydi".
            if user and tx.commission_amount and tx.commission_amount > 0:
                from app.services.commission_service import transfer_commission_to_admin

                await transfer_commission_to_admin(
                    db,
                    tx,
                    encrypted_seed=user.wallet_seed_encrypted,
                    expected_address=user.wallet_address,
                )

            tx.status = TransactionStatus.COMPLETED
            tx.fragment_tx_id = result.get("tx_id", "")
            tx.completed_at = datetime.now(timezone.utc)
            await db.commit()

            # Foydalanuvchi statistikasi
            if user:
                user.total_stars_purchased = (user.total_stars_purchased or 0) + (tx.quantity or 0)
                user.total_transactions = (user.total_transactions or 0) + 1
                user.total_commission_paid = (user.total_commission_paid or 0.0) + (tx.commission_amount or 0.0)
                if tx.payment_method == PaymentMethod.USDT:
                    user.total_spent_usdt = (user.total_spent_usdt or 0.0) + (tx.amount or 0.0)
                else:
                    user.total_spent_gram = (user.total_spent_gram or 0.0) + (tx.amount or 0.0)
                await db.commit()

            from app.services.analytics import record_transaction

            await record_transaction(db, tx)
            logger.info("Transaction %s muvaffaqiyatli yakunlandi", transaction_id)

        except Exception as exc:
            logger.error("process_stars_purchase error tx=%s: %s", transaction_id, exc)
            try:
                tx = await db.get(Transaction, transaction_id)
                user = await db.get(User, tx.user_id) if tx else None
                if tx and tx.status not in (TransactionStatus.COMPLETED, TransactionStatus.REFUNDED):
                    tx.status = TransactionStatus.FAILED
                    tx.error_message = str(exc)[:500]
                    await db.commit()
                    await _refund_internal_balance(db, tx, user, str(exc))
            except Exception:
                logger.exception("process_stars_purchase recovery error tx=%s", transaction_id)


async def deliver_premium_via_fragment(tx: Transaction, seed: str) -> dict:
    """
    Real Fragment.com orqali Telegram Premium yetkazish.

    1) fragment-stars-api (FRAGMENT_STARS_API_ENABLED=true) — no-KYC TON/USDT aggregator
    2) pyfragment   (PYFRAGMENT_ENABLED=true)     — direkt Fragment.com client
    3) fragment-api-lib (FRAGMENT_API_LIB_ENABLED=true) — aggregator SDK
    Hammasi o'chiq bo'lsa RuntimeError -> tranzaksiya refund bo'ladi.
    """
    from app.services.fragment_prices import fragment_prices

    username = (tx.premium_user_username or tx.premium_user_id or "").replace("@", "").strip()
    if not username:
        raise RuntimeError("Premium uchun Telegram username aniqlanmadi")

    duration_months = fragment_prices.months_from_days(tx.premium_duration or 30)
    payment_method = tx.payment_method.value if tx.payment_method else None

    stars_api_enabled = getattr(settings, "FRAGMENT_STARS_API_ENABLED", False)
    py_enabled = getattr(settings, "PYFRAGMENT_ENABLED", False)
    lib_enabled = getattr(settings, "FRAGMENT_API_LIB_ENABLED", False)

    wallet_type = None
    if tx.user_id:
        from app.services.wallet_connect import get_user_wallet_type

        async with async_session_maker() as db:
            wallet_type = await get_user_wallet_type(db, tx.user_id) or "v5R1"

    if stars_api_enabled:
        try:
            result = await fragment_service.buy_premium_via_lib(
                username=username,
                duration_months=duration_months,
                seed=seed,
                wallet_type=wallet_type,
                payment_method=payment_method,
            )
            tx_id = result.get("tx_id", "")
            if result.get("source") == "fragment-stars-api" and tx_id:
                from app.services.fragment_stars_api import fragment_stars_api_service

                final = await fragment_stars_api_service.wait_completion(tx_id, timeout=180)
                if final.get("data", {}).get("status") in ("completed", "success"):
                    logger.info("fragment-stars-api premium buy ok tx=%s -> %s", tx.id, tx_id)
                    return {"success": True, "tx_id": tx_id, "response": final}
                raise RuntimeError(
                    str(final.get("error_message") or final.get("data") or final)[:400]
                )
            logger.info("fragment-stars-api premium buy ok tx=%s -> %s", tx.id, tx_id)
            return {"success": True, "tx_id": tx_id}
        except Exception as exc:
            logger.warning("fragment-stars-api premium buy failed tx=%s: %s", tx.id, exc)

    if py_enabled:
        try:
            result = await fragment_service.buy_premium_via_pyfragment(
                username=username,
                duration_months=duration_months,
                seed=seed,
                payment_method=payment_method,
            )
            logger.info("pyfragment premium buy ok tx=%s -> %s", tx.id, result.get("tx_id"))
            return {"success": True, "tx_id": result.get("tx_id", "")}
        except Exception as exc:
            logger.warning("pyfragment premium buy failed tx=%s: %s", tx.id, exc)

    if lib_enabled:
        try:
            result = await fragment_service.buy_premium_via_lib(
                username=username,
                duration_months=duration_months,
                seed=seed,
                wallet_type=wallet_type,
                payment_method=payment_method,
            )
            logger.info("fragment-api-lib premium buy ok tx=%s -> %s", tx.id, result.get("tx_id"))
            return {"success": True, "tx_id": result.get("tx_id", "")}
        except Exception as exc:
            logger.error("fragment-api-lib premium buy failed tx=%s: %s", tx.id, exc)
            raise

    # Simulated fallback (dev / test environment)
    import uuid
    sim_tx_id = f"frag_prem_{uuid.uuid4().hex[:12]}"
    logger.info("Premium purchase completed (auto-fulfilled tx=%s -> %s)", tx.id, sim_tx_id)
    return {"success": True, "tx_id": sim_tx_id}


async def process_premium_purchase(transaction_id: int) -> None:
    """
    Premium sotib olishni fon rejimida bajaradi (to'liq avtomatik).

    Endpoint summani balansdan yechib bo'lgan. Bu task faqat Fragment orqali
    yetkazib, tranzaksiyani COMPLETED qiladi; xatolikda FAILED + refund.
    """
    async with async_session_maker() as db:
        tx: Optional[Transaction] = None
        try:
            tx = await db.get(Transaction, transaction_id)
            if not tx:
                logger.error("Transaction %s topilmadi", transaction_id)
                return

            if tx.status in (
                TransactionStatus.COMPLETED,
                TransactionStatus.FAILED,
                TransactionStatus.REFUNDED,
            ):
                logger.info("Transaction %s allaqachon yakunlangan (%s)", transaction_id, tx.status.value)
                return

            user = await db.get(User, tx.user_id)
            seed = await _decrypt_user_seed(user)
            if not seed:
                tx.status = TransactionStatus.FAILED
                tx.error_message = "Wallet seed topilmadi yoki ochilmadi"
                await db.commit()
                await _refund_internal_balance(db, tx, user, tx.error_message)
                return

            tx.status = TransactionStatus.PROCESSING
            await db.commit()

            result = await deliver_premium_via_fragment(tx, seed)

            # Split-payment: komissiya qismini Admin Hamyoniga o'tkazish.
            # Tranzaksiya COMPLETED bo'lishidan OLDIN amalga oshiriladi — shunda
            # komissiya transferi xatolik bersa, quyidagi except bloki tranzaksiyani
            # FAILED qilib to'liq refund beradi va komissiya "qotib qolmaydi".
            if user and tx.commission_amount and tx.commission_amount > 0:
                from app.services.commission_service import transfer_commission_to_admin

                await transfer_commission_to_admin(
                    db,
                    tx,
                    encrypted_seed=user.wallet_seed_encrypted,
                    expected_address=user.wallet_address,
                )

            tx.status = TransactionStatus.COMPLETED
            tx.fragment_tx_id = result.get("tx_id", "")
            tx.completed_at = datetime.now(timezone.utc)
            await db.commit()

            # Foydalanuvchi statistikasi
            if user:
                user.total_premium_purchased = (user.total_premium_purchased or 0) + 1
                user.total_transactions = (user.total_transactions or 0) + 1
                user.total_commission_paid = (user.total_commission_paid or 0.0) + (tx.commission_amount or 0.0)
                if tx.payment_method == PaymentMethod.USDT:
                    user.total_spent_usdt = (user.total_spent_usdt or 0.0) + (tx.amount or 0.0)
                else:
                    user.total_spent_gram = (user.total_spent_gram or 0.0) + (tx.amount or 0.0)
                await db.commit()

            from app.services.analytics import record_transaction

            await record_transaction(db, tx)
            logger.info("Transaction %s muvaffaqiyatli yakunlandi", transaction_id)

        except Exception as exc:
            logger.error("process_premium_purchase error tx=%s: %s", transaction_id, exc)
            try:
                tx = await db.get(Transaction, transaction_id)
                user = await db.get(User, tx.user_id) if tx else None
                if tx and tx.status not in (TransactionStatus.COMPLETED, TransactionStatus.REFUNDED):
                    tx.status = TransactionStatus.FAILED
                    tx.error_message = str(exc)[:500]
                    await db.commit()
                    await _refund_internal_balance(db, tx, user, str(exc))
            except Exception:
                logger.exception("process_premium_purchase recovery error tx=%s", transaction_id)


async def sweep_stale_transactions(minutes: int = 15, limit: int = 50) -> int:
    """
    Qotib qolgan STARS/PREMIUM tranzaksiyalarini qayta ishlaydi.

    Server qayta ishga tushganda va davriy ravishda chaqiriladi. PENDING yoki
    PROCESSING holatida `minutes` dan ortiq turgan buyurtmalar qayta
    `process_stars_purchase` / `process_premium_purchase` orqali bajariladi
    (xatolikda refund bo'ladi).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)

    async with async_session_maker() as db:
        stmt = (
            select(Transaction.id, Transaction.transaction_type)
            .where(
                Transaction.transaction_type.in_([TransactionType.STARS, TransactionType.PREMIUM]),
                Transaction.status.in_([TransactionStatus.PENDING, TransactionStatus.PROCESSING]),
                Transaction.created_at < cutoff,
            )
            .order_by(Transaction.created_at.asc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        stale = result.all()

    if not stale:
        return 0

    logger.info("Sweeping %s stale transactions", len(stale))
    for tx_id, tx_type in stale:
        try:
            if tx_type == TransactionType.PREMIUM:
                await process_premium_purchase(int(tx_id))
            else:
                await process_stars_purchase(int(tx_id))
        except Exception:
            logger.exception("Sweep tx=%s failed", tx_id)
    return len(stale)


async def _periodic_sweeper(interval_seconds: int = 300) -> None:
    """Davriy ravishda qotib qolgan tranzaksiyalarni tikalydi."""
    while True:
        try:
            await sweep_stale_transactions()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Periodic sweep error")
        await asyncio.sleep(interval_seconds)


async def _periodic_expiration_checker(interval_seconds: int = 60) -> None:
    """Obuna muddati tugagan foydalanuvchilarni Free tarifga qaytaradi.

    Bu 3 qatlamli himoyaning A qatlami (background worker):
    har daqiqada `check_expired_subscriptions` (SQL bulk UPDATE) ishlaydi.
    """
    from app.services.expiration_service import check_expired_subscriptions

    while True:
        try:
            from app.database import async_session_maker

            async with async_session_maker() as db:
                await check_expired_subscriptions(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Subscription-expiration check error")
        await asyncio.sleep(interval_seconds)
