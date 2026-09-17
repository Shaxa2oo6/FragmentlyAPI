import hashlib
import re
import uuid
from datetime import datetime

SECRET_KEY_HINT = "pk"  # hash qilishda token yo'qolib qolmasligi uchun

# Telegram username ruxsat etilgan belgilar: harflar, raqamlar, underscore
VALID_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{4,32}$")


def generate_order_id() -> str:
    """Unikal buyurtma raqamini yaratadi."""
    return f"ORD-{uuid.uuid4().hex[:12].upper()}"


def generate_payment_id() -> str:
    return f"PAY-{uuid.uuid4().hex[:12].upper()}"


def truncate_address(addr: str, head: int = 6, tail: int = 6) -> str:
    """Wallet manzilini qisqartirib ko'rsatadi."""
    if not addr:
        return ""
    if len(addr) <= head + tail:
        return addr
    return f"{addr[:head]}...{addr[-tail:]}"


def sha256_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def extract_error_message(exc: Exception) -> str:
    """O'ralgan (tenacity.RetryError kabi) xatolarni oddiy matnga aylantiradi."""
    last = exc
    seen = set()
    while hasattr(last, "__cause__") and last.__cause__ is not None:
        last = last.__cause__
        if id(last) in seen:
            break
        seen.add(id(last))
    message = str(last).strip()
    return message if message else str(exc)


def sanitize_input(value: str) -> str:
    """XSS hujumlaridan himoya — xavfli HTML belgilarini neytrallashtiradi."""
    if value is None:
        return ""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#x27;")
    )


def normalize_username(username: str) -> str:
    """Telegram username ni normallashtiradi (@ belgisini tahlil qiladi).

    Faqat xavfsiz belgilarga ruxsat beradi (harflar, raqamlar, underscore).
    Yaroqsiz bo'lsa bo'sh qator qaytaradi.
    """
    username = (username or "").strip().lower()
    if username.startswith("@"):
        username = username[1:]
    if not VALID_USERNAME_RE.match(username):
        return ""
    return username