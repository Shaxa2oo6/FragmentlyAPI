# backend/app/services/wallet_ton.py
"""
Mnemonic orqali blokcheynda tranzaksiyani real o'tkazish servisi.

Hamyon seed-phrase platformada Fernet (AES-256) bilan shifrlangan holda saqlanadi.
Tranzaksiya REAL TON blockchain'ga yuboriladi (LiteServer + pytoniq).
"""

import logging
from typing import Optional

from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger(__name__)

try:
    from pytoniq import LiteBalancer, WalletV3R1, WalletV3R2, WalletV4R2, WalletV5R1
    PYTONIQ_AVAILABLE = True
except Exception as e:
    PYTONIQ_AVAILABLE = False
    logger.warning("pytoniq import notice in wallet_ton.py: %s", e)

# TON USDT (USD₮) Jetton master kontrakti (mainnet, Tether rasmiy manzili)
USDT_JETTON_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
# USDT TON'da 6 decimals
USDT_DECIMALS = 6
_TONAPI_URL = "https://tonapi.io/v2"

# Wallet turlari va ularning pytoniq classlari
WALLET_CLASSES = {
    "v4R2": WalletV4R2,
    "v3R2": WalletV3R2,
    "v3R1": WalletV3R1,
    "v5R1": WalletV5R1,
}


def _normalize(addr: Optional[str]) -> str:
    """Manzilni taqqoslash uchun oddiy normalizatsiya."""
    return (addr or "").replace(" ", "").strip()


class TONWalletManager:
    def __init__(self):
        key = settings.FERNET_KEY
        if isinstance(key, str):
            key = key.encode()
        self.fernet = Fernet(key)

    def encrypt_mnemonic(self, seed_phrase: str) -> str:
        return self.fernet.encrypt(seed_phrase.encode()).decode()

    def decrypt_mnemonic(self, encrypted_seed: str) -> str:
        return self.fernet.decrypt(encrypted_seed.encode()).decode()

    async def _wallet_for(
        self, mnemonic_words, wallet_type: Optional[str], expected_address: Optional[str]
    ):
        """Seed va wallet turi bo'yicha to'g'ri pytoniq wallet obyektini yaratadi.

        Agar wallet turi noma'lum bo'lsa, expected_address ga mos keladigan
        birinchi wallet qaytariladi (v4R2 > v5R1 > v3R2 > v3R1 tartibida).
        """
        if not PYTONIQ_AVAILABLE:
            raise RuntimeError("pytoniq o'rnatilmagan - tranzaksiya yuborib bo'lmaydi")

        provider = LiteBalancer.from_mainnet_config(trust_level=2)
        await provider.start_up()
        try:
            expected = _normalize(expected_address)

            def _derived_address(wallet) -> str:
                try:
                    # wallet.address — pytoniq_core.Address; str() repr qaytaradi
                    return _normalize(wallet.address.to_str())
                except Exception:
                    return ""

            candidates = [wallet_type] if wallet_type else ["v4R2", "v5R1", "v3R2", "v3R1"]
            tried = []
            for wtype in candidates:
                cls = WALLET_CLASSES.get(wtype)
                if cls is None:
                    continue
                try:
                    if wtype == "v5R1":
                        # WalletV5R1 network_global_id (mainnet) talab qiladi
                        wallet = await cls.from_mnemonic(
                            provider, mnemonic_words, network_global_id=-239
                        )
                    else:
                        wallet = await cls.from_mnemonic(provider, mnemonic_words)
                except Exception as exc:
                    logger.warning("wallet %s derivation error: %s", wtype, exc)
                    continue

                derived = _derived_address(wallet)
                tried.append((wtype, derived))

                # Agar kutilgan manzil berilgan bo'lsa - mosini tanlaymiz
                if expected and derived and (derived == expected or expected in derived or derived in expected):
                    return provider, wallet
                if not expected:
                    return provider, wallet

            # Mos kelmadi - eng oxirgi urinilgan hamyon bilan davom etamiz
            if tried:
                last_type = tried[-1][0]
                if last_type == "v5R1":
                    wallet = await WALLET_CLASSES[last_type].from_mnemonic(
                        provider, mnemonic_words, network_global_id=-239
                    )
                else:
                    wallet = await WALLET_CLASSES[last_type].from_mnemonic(provider, mnemonic_words)
                logger.warning(
                    "wallet address mismatch: expected=%s tried=%s",
                    expected, tried,
                )
                return provider, wallet

            raise RuntimeError("Hech bir wallet versiyasi yaralmadi")
        except Exception:
            await provider.close_all()
            raise

    async def execute_ton_transfer(
        self,
        encrypted_seed: str,
        destination: str,
        amount_ton: float,
        comment: str,
        wallet_type: Optional[str] = None,
        expected_address: Optional[str] = None,
    ) -> str:
        """
        Baza foydalanuvchisining shifrlangan mnemonik kalitidan foydalanib
        TON blokcheynida tranzaksiya o'tkazadi (REAL).

        Returns: tranzaksiya hash'i (str). Yuborish imkonsiz bo'lsa RuntimeError.
        """
        if not PYTONIQ_AVAILABLE:
            raise RuntimeError("pytoniq o'rnatilmagan - real tranzaksiya yuborib bo'lmaydi")

        mnemonic_words = self.decrypt_mnemonic(encrypted_seed).split()
        provider, wallet = await self._wallet_for(mnemonic_words, wallet_type, expected_address)

        try:
            nanotons = int(round(amount_ton * 1e9))
            # Non-bounceable manzil: qabul qiluvchi kontrakt hali deploy qilinmagan
            # bo'lsa ham to'lov bounce bo'lmaydi (platforma hamyoni birinchi marta
            # to'ldirilayotganda). Kontrakt keyin deploy bo'lgach pul chiqariladi.
            from pytoniq_core import Address

            dest_addr = Address(destination)
            # `str(Address(...))` bu pytoniq_core versiyasida repr qaytaradi
            # ("Address<...>"), shuning uchun doim .to_str() ishlatiladi.
            dest = dest_addr.to_str(is_user_friendly=True, is_bounceable=False)

            sent = await wallet.transfer(
                destination=dest,
                amount=nanotons,
                body=comment,
            )
            if not sent:
                raise RuntimeError("TON transfer yuborilmadi")
        finally:
            await provider.close_all()

        # pytoniq faqat muvaffaqiyat belgisi (1) qaytaradi — real tx_hash
        # blockchain tranzaksiyalaridan topiladi.
        try:
            from app.services.ton_verify import ton_verify_service

            found = await ton_verify_service.find_native_payment(
                recipient=destination,
                sender=wallet.address.to_str(),
                expected_amount_ton=amount_ton,
                comment=str(comment),
                attempts=3,
                delay=1.5,
            )
            if found.get("verified") and found.get("tx_hash"):
                return str(found["tx_hash"])
        except Exception as exc:
            logger.warning("real tx_hash topishda xatolik: %s", exc)

        return ""

    async def resolve_usdt_jetton_wallet(self, owner_address: str) -> Optional[str]:
        """USDT (Jetton) hamyon manzilini TonAPI orqali resolve qiladi.

        USDT Jetton manzili = f(master, owner). TonAPI buni beradi:
        GET /v2/accounts/{owner}/jettons/{master} -> {"wallet_address": {...}}
        """
        import httpx

        url = f"{_TONAPI_URL}/accounts/{owner_address}/jettons/{USDT_JETTON_MASTER}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    w = data.get("wallet_address")
                    if isinstance(w, dict):
                        w = w.get("address")
                    if not w:
                        w = data.get("address")
                    if w:
                        return str(w)
        except Exception as exc:  # pragma: no cover
            logger.warning("TonAPI USDT jetton wallet resolve xatosi (%s): %s", owner_address, exc)
        return None

    async def execute_jetton_transfer(
        self,
        encrypted_seed: str,
        destination_owner: str,
        destination_jetton_wallet: str,
        amount_usdt: float,
        comment: str,
        wallet_type: Optional[str] = None,
        expected_address: Optional[str] = None,
        response_jetton_wallet: Optional[str] = None,
    ) -> str:
        """USDT (Jetton) REAL Jetton Transfer yuboradi.

        pytoniq 0.1.43'da tayyor JettonWallet sinfi yo'q — JettonTransfer
        (opcode 0xf8a7ea5) message'i qo'lda Cell bilan quriladi va yuboruvchi
        hamyon orqali USDT Jetton Wallet'ga internal transfer sifatida yuboriladi.

        Args:
            encrypted_seed: yuboruvchi (platforma) hamyonining shifrlangan seed'i.
            destination_owner: qabul qiluvchi TON hamyon manzili (Jetton egalik qiluvchi).
            destination_jetton_wallet: qabul qiluvchining USDT Jetton Wallet manzili.
            amount_usdt: yuboriladigan USDT miqdori.
            response_jetton_wallet: yuboruvchining USDT Jetton Wallet manzili (agar
                ma'lum bo'lsa, aks holda TonAPI orqali resolve qilinadi).

        Returns: tranzaksiya hash'i (str). Xatolikda RuntimeError.
        """
        if not PYTONIQ_AVAILABLE:
            raise RuntimeError("pytoniq o'rnatilmagan - real jetton transfer yuborib bo'lmaydi")

        from pytoniq_core import Address, begin_cell

        mnemonic_words = self.decrypt_mnemonic(encrypted_seed).split()
        provider, wallet = await self._wallet_for(mnemonic_words, wallet_type, expected_address)

        try:
            # Yuboruvchining USDT Jetton Wallet manzili
            sender_jetton_wallet = response_jetton_wallet
            if not sender_jetton_wallet:
                sender_jetton_wallet = await self.resolve_usdt_jetton_wallet(wallet.address.to_str())
            if not sender_jetton_wallet:
                raise RuntimeError("Yuboruvchining USDT Jetton Wallet manzili aniqlanmadi")

            # JettonTransfer body: opcode 0xf8a7ea5
            amount_nano = int(round(amount_usdt * (10 ** USDT_DECIMALS)))
            forward_ton = int(round(0.001 * 1e9))  # forward uchun ozgina TON
            body = (
                begin_cell()
                .store_uint(0xF8A7EA5, 32)  # transfer opcode
                .store_uint(0, 64)  # query_id
                .store_coins(amount_nano)  # jetton miqdori
                .store_address(Address(destination_owner))  # qabul qiluvchi egasi
                .store_address(Address(wallet.address.to_str()))  # response_destination
                .store_maybe_ref(None)  # custom_payload
                .store_coins(forward_ton)  # forward_ton_amount
                .store_maybe_ref(begin_cell().store_bytes(comment.encode()).end_cell())
                .end_cell()
            )

            # Yuboruvchining jetton wallet'iga internal transfer (gas ~0.3 TON)
            gas_ton = int(round(0.3 * 1e9))
            sent = await wallet.transfer(
                destination=Address(sender_jetton_wallet),
                amount=gas_ton,
                body=body,
            )
            if not sent:
                raise RuntimeError("Jetton transfer yuborilmadi")
        finally:
            await provider.close_all()

        # pytoniq faqat muvaffaqiyat belgisi (1) qaytaradi — real tx_hash
        # blockchain tranzaksiyalaridan qidiriladi.
        try:
            from app.services.ton_verify import ton_verify_service

            found = await ton_verify_service.find_jetton_payment(
                recipient_owner=destination_owner,
                expected_amount_usdt=amount_usdt,
                jetton_master=USDT_JETTON_MASTER,
                comment=str(comment),
                attempts=3,
                delay=1.5,
            )
            if found.get("verified") and found.get("tx_hash"):
                return str(found["tx_hash"])
        except Exception as exc:
            logger.warning("real jetton tx_hash topishda xatolik: %s", exc)

        return ""


ton_wallet_service = TONWalletManager()
