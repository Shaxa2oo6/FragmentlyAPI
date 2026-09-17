"""Seed-phrase (mnemonic) validatsiyasi.

GRAM / TON hamyonlarining maxfiy kalit iborasi quyidagi standartlarga
mosligini tekshiradi:

- 12 yoki 24 ta so'z
- Barcha so'zlar BIP39 English so'zlar ro'yxatida bo'lishi shart
- 12 so'zli ibora uchun: BIP39 checksum tekshiruvi
- 24 so'zli ibora uchun: BIP39 checksum YOKI TON "basic seed" tekshiruvi
  (pytoniq / Tonkeeper uslubidagi seed)
"""

import hashlib
import logging
import re
from typing import List, Optional

logger = logging.getLogger(__name__)

ALLOWED_WORD_COUNTS = (12, 24)
_WORD_PATTERN = re.compile(r"^[a-z]+$")

try:
    from pytoniq_core.crypto.keys import is_basic_seed, mnemonic_to_entropy, words as BIP39_WORDS
    BIP39_SET = set(BIP39_WORDS)
    PYTONIQ_KEYS_AVAILABLE = True
except Exception as exc:  # pragma: no cover - pytoniq ixtiyoriy
    PYTONIQ_KEYS_AVAILABLE = False
    BIP39_SET = set()
    logger.warning("pytoniq_core.crypto.keys import xatosi: %s", exc)


def normalize_mnemonic(raw: str) -> List[str]:
    """Kiritilgan matnni so'zlarga ajratadi (bo'sh joy, vergul, yangi qator)."""
    if not raw or not isinstance(raw, str):
        return []
    return re.split(r"[\s,;]+", raw.strip().lower())


def words_in_wordlist(words: List[str]) -> bool:
    return all(w in BIP39_SET for w in words)


def _bip39_checksum_valid(words: List[str]) -> bool:
    """BIP39 checksum tekshiruvi (12/15/18/21/24 so'z uchun umumiy)."""
    if not BIP39_SET:
        return False
    try:
        total_bits = len(words) * 11
        checksum_len = len(words) // 3
        entropy_bits = total_bits - checksum_len
        bitstring = "".join(f"{BIP39_WORDS.index(w):011b}" for w in words)
        entropy = int(bitstring[:entropy_bits], 2).to_bytes(entropy_bits // 8, "big")
        digest = hashlib.sha256(entropy).digest()
        expected = "".join(f"{b:08b}" for b in digest)[:checksum_len]
        return bitstring[entropy_bits:] == expected
    except Exception as exc:  # pragma: no cover
        logger.warning("BIP39 checksum tekshiruvida xatolik: %s", exc)
        return False


def _ton_basic_seed_valid(words: List[str]) -> bool:
    """TON 'basic seed' tekshiruvi (pytoniq uslubi, 24 so'z)."""
    if not PYTONIQ_KEYS_AVAILABLE or len(words) != 24:
        return False
    try:
        return is_basic_seed(mnemonic_to_entropy(words))
    except Exception as exc:  # pragma: no cover
        logger.warning("TON basic seed tekshiruvida xatolik: %s", exc)
        return False


def validate_mnemonic(raw: str) -> Optional[str]:
    """Seed-phrase ni tekshiradi.

    Returns:
        Xatolik matni (agar no'to'g'ri bo'lsa) yoki None (to'g'ri bo'lsa).
    """
    words = normalize_mnemonic(raw)

    if not words:
        return "Seed-phrase bo'sh bo'lmasligi kerak"

    if len(words) not in ALLOWED_WORD_COUNTS:
        return f"Seed-phrase 12 yoki 24 ta so'zdan iborat bo'lishi kerak (topildi: {len(words)})"

    if not all(_WORD_PATTERN.match(w) for w in words):
        return "So'zlar faqat kichik lotin harflaridan iborat bo'lishi kerak"

    if not words_in_wordlist(words):
        return "Iborada noto'g'ri so'zlar mavjud (BIP39 ro'yxatga mos kelmaydi)"

    if _bip39_checksum_valid(words) or _ton_basic_seed_valid(words):
        return None

    return "Seed-phrase checksum o'tmadi - ibora yaroqsiz"


def mnemonic_to_keypair(words: List[str]) -> "tuple[bytes, bytes]":
    """(public_key, private_key) juftligini hosil qiladi."""
    from pytoniq_core.crypto.keys import mnemonic_to_private_key, private_key_to_public_key

    public_key, private_key = mnemonic_to_private_key(words)
    return public_key, private_key
