"""Seed-phrase (mnemonic) shifrlash — Fernet (AES).

ASOSIY backend (`backend/app/services/encryption.py`) bilan BIR XIL kalitdan
foydalaniladi: ikkala backend bir xil `FERNET_KEY_SETTING` ni ishlatadi,
shunda admin_backend'da shifrlangan platforma seed'ini backend deshifrlay oladi.
"""

from cryptography.fernet import Fernet

from app.config import settings


def _get_key() -> bytes:
    """Fernet shifrlash kalitini qaytaradi (backend bilan bir xil).

    FERNET_KEY_SETTING belgilangan bo'lsa o'shasi ishlatiladi (backend bilan
    sinxronlash uchun), aks holda SECRET_KEY dan sha256 bilan hosil qilinadi.
    """
    key = settings.FERNET_KEY
    if isinstance(key, str):
        key = key.encode()
    return key


fernet = Fernet(_get_key())


def encrypt_seed(seed_phrase: str) -> str:
    """Seed-phrase ni shifrlaydi."""
    return fernet.encrypt(seed_phrase.encode("utf-8")).decode("utf-8")


def decrypt_seed(encrypted: str) -> str:
    """Shifrlangan seed-phrase ni deshifrlaydi."""
    return fernet.decrypt(encrypted.encode("utf-8")).decode("utf-8")
