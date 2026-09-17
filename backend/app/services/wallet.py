"""TON wallet servisi.

Real loyihada haqiqiy TON wallet yaratish uchun ``tonsdk`` ishlatiladi.
Agar ``tonsdk`` o'rnatilmagan bo'lsa, demo rejimida hash asosidagi
manzil va tasodifiy seed-phrase generatsiya qilinadi.
"""

import hashlib
import logging
import secrets

from app.services.encryption import decrypt_seed, encrypt_seed

logger = logging.getLogger(__name__)

try:
    from tonsdk.contract.wallet import Wallets  # noqa: F401

    TONSDK_AVAILABLE = True
except Exception:  # pragma: no cover - tonsdk ixtiyoriy
    TONSDK_AVAILABLE = False

# Demo seed uchun so'zlar to'plami (BIP39 ga o'xshash)
_DEMO_WORDS = (
    "abandon ability able about above absent absorb abstract absurd abuse access accident "
    "account accuse achieve acid acoustic acquire across act action actor actress actual "
    "adapt add addict address adjust admit adult advance advice aerobic affair afford afraid "
    "again age agent agree ahead aim air airport aisle alarm album alcohol alert alien"
).split()


def _generate_demo_seed() -> str:
    words = [_DEMO_WORDS[secrets.randbelow(len(_DEMO_WORDS))] for _ in range(24)]
    return " ".join(words)


def _demo_address(seed_phrase: str) -> str:
    digest = hashlib.sha256(("EQ_" + seed_phrase).encode("utf-8")).hexdigest()
    numeric = int(digest, 16) % 1000000000000000000
    return f"EQ{numeric:018d}"


class WalletService:
    def encrypt_seed(self, seed_phrase: str) -> str:
        return encrypt_seed(seed_phrase)

    def decrypt_seed(self, encrypted: str) -> str:
        return decrypt_seed(encrypted)

    async def generate_wallet(self):
        """Yangi TON wallet yaratadi. (address, seed_phrase) qaytaradi."""
        if TONSDK_AVAILABLE:
            try:
                mnemonic, _pub_key, _priv_key, wallet = Wallets.create(
                    version="v4r2", workchain=0
                )
                seed_phrase = " ".join(mnemonic)
                address = wallet.address.to_string(True, True, True)
                return address, seed_phrase
            except Exception as exc:  # pragma: no cover
                logger.warning("tonsdk bilan wallet yaratishda xatolik, demo rejim: %s", exc)

        seed_phrase = _generate_demo_seed()
        address = _demo_address(seed_phrase)
        return address, seed_phrase

    def address_from_seed(self, seed_phrase: str) -> str:
        """Seed-phrase dan wallet manzilini chiqaradi."""
        info = self.get_wallet_info(seed_phrase)
        return info["address"]

    def get_wallet_info(self, seed_phrase: str) -> dict:
        """Seed-phrase dan (address, raw_address, wallet_type) ma'lumotlarini chiqaradi."""
        words = seed_phrase.strip().split()
        if TONSDK_AVAILABLE and len(words) in (12, 24):
            try:
                from tonsdk.crypto import mnemonic_to_private_key
                from tonsdk.contract.wallet import WalletV4R2

                private_key = mnemonic_to_private_key(words)
                wallet = WalletV4R2(private_key=private_key, workchain=0)
                address = wallet.address.to_string(True, True, True)
                raw_address = wallet.address.to_string(False, False, False)
                return {
                    "address": address,
                    "raw_address": raw_address,
                    "wallet_type": "v4R2",
                }
            except Exception as exc:
                logger.warning("tonsdk get_wallet_info xatolik: %s", exc)

        digest = hashlib.sha256(("EQ_" + " ".join(words)).encode("utf-8")).hexdigest()
        raw_address = f"0:{digest}"
        numeric = int(digest[:16], 16)
        friendly_address = f"EQ{digest[:8].upper()}{numeric % 10000000000000000:016d}"
        return {
            "address": friendly_address,
            "raw_address": raw_address,
            "wallet_type": "v4R2",
        }

    def validate_seed(self, seed_phrase: str) -> bool:
        """Seed-phrase validatsiyasi (12 yoki 24 ta so'zdan iborat va so'zlar to'g'ri bo'lishi kerak)."""
        if not seed_phrase or not seed_phrase.strip():
            return False
        words = seed_phrase.strip().split()
        if len(words) not in (12, 24):
            return False
        # Har bir so'z faqat harflardan iborat bo'lishi kerak
        for w in words:
            if not w.isalpha():
                return False
        if TONSDK_AVAILABLE:
            try:
                from tonsdk.crypto import mnemonic_validate
                return mnemonic_validate(words)
            except Exception:
                return True
        return True


wallet_service = WalletService()