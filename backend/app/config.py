import json
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Dict, List, Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./fragmently.db"

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # HTTPS'da cookie'lar uchun secure flag (production'da true)
    COOKIE_SECURE: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Rate limiting (daqiqada so'rovlar soni)
    RATE_LIMIT_PER_MINUTE: int = 120
    # ENVIRONMENT: development | production | staging
    ENVIRONMENT: str = "development"
    # Rate limit faqat production'da ishlaydi; local dev uchun o'chirish mumkin.
    RATE_LIMIT_ENABLED: bool = True

    # Fragment
    FRAGMENT_API_URL: str = "https://api.fragment.com/v1"
    FRAGMENT_API_KEY: Optional[str] = None

    # TON
    TON_RPC_URL: str = "https://toncenter.com/api/v2/jsonRPC"
    TON_API_KEY: Optional[str] = None

    # Platforma (komissiya yig'uvchi saqlovchi) hamyoni va uning seed'i
    # Qiymatlar faqat .env orqali beriladi (PLATFORM_WALLET_ADDRESS / PLATFORM_SEED_PHRASE).
    PLATFORM_WALLET_ADDRESS: str = ""
    PLATFORM_SEED_PHRASE: Optional[str] = None  # refund uchun platforma o'z seed'i (mainnet)

    # Komissiya tushadigan ADMIN hamyoni. Agar ko'rsatilmagan bo'lsa,
    # PLATFORM_WALLET_ADDRESS (yoki DB platform_wallet manzili) ishlatiladi.
    PLATFORM_ADMIN_WALLET: Optional[str] = None

    # Real Fragment/TON tranzaksiya manzillari (env orqali to'ldiriladi)
    FRAGMENT_STARS_WALLET: str = ""
    FRAGMENT_PREMIUM_WALLET: str = ""
    FRAGMENT_STARS_PRICE_USD: float = 0.015  # 1 Star (fragment.com, Apple/Google 30% siz)
    # Rasmiy Fragment.com Premium narxlari (USD anchor, TON/USD kursi bilan GRAM ga o'tadi)
    PREMIUM_3M_PRICE_USD: float = 14.99
    PREMIUM_6M_PRICE_USD: float = 19.99
    PREMIUM_12M_PRICE_USD: float = 35.99
    PRICE_CACHE_TTL: int = 60  # sekund — narx/kurs keshi

    # fragment-api-lib (third-party Fragment aggregator)
    FRAGMENT_API_LIB_URL: str = "https://api.fragment-api.net"
    FRAGMENT_API_LIB_ENABLED: bool = False
    FRAGMENT_SEED_PHRASE: Optional[str] = None  # TON wallet 24-word seed phrase
    FRAGMENT_COOKIES: Optional[str] = None  # KYC rejim cookie-fayllari (stel_ssid=...)
    FRAGMENT_COOKIE_DT: Optional[str] = "-300"
    FRAGMENT_COOKIE_SSID: Optional[str] = None

    # fragment-stars-api (bbbuilt) — no-KYC TON va USDT (usdt_ton) qo'llab-quvvatlaydi
    FRAGMENT_STARS_API_URL: str = "https://api-fragment.duckdns.org"
    FRAGMENT_STARS_API_ENABLED: bool = False

    # pyfragment (bohd4nx/pyfragment) — Fragment.com direct async client
    PYFRAGMENT_ENABLED: bool = False
    PYFRAGMENT_WALLET_VERSION: str = "V5R1"  # V4R2 | V5R1 | HighloadV2 | HighloadV3R1
    PYFRAGMENT_API_PROVIDER: str = "tonapi"  # tonapi | toncenter
    PYFRAGMENT_TIMEOUT: float = 30.0
    FRAGMENT_COOKIE_TOKEN: Optional[str] = None  # stel_token
    FRAGMENT_COOKIE_TON_TOKEN: Optional[str] = None  # stel_ton_token

    @property
    def EFFECTIVE_FRAGMENT_COOKIES(self) -> Optional[str]:
        if self.FRAGMENT_COOKIES:
            return self.FRAGMENT_COOKIES
        if self.FRAGMENT_COOKIE_SSID:
            dt = self.FRAGMENT_COOKIE_DT or "-300"
            return f"stel_dt={dt}; stel_ssid={self.FRAGMENT_COOKIE_SSID}"
        return None

    @property
    def PYFRAGMENT_COOKIES(self) -> Optional[Dict[str, str]]:
        """pyfragment uchun talab qilinadigan cookie dict'i (stel_ssid, stel_dt, stel_token, stel_ton_token)."""
        cookies: Dict[str, str] = {}
        if self.FRAGMENT_COOKIES:
            parsed = parse_cookie_string(self.FRAGMENT_COOKIES)
            for k, v in parsed.items():
                if str(v).strip():
                    cookies[str(k).strip()] = str(v).strip()
        for env_key, cookie_key in (
            ("FRAGMENT_COOKIE_SSID", "stel_ssid"),
            ("FRAGMENT_COOKIE_DT", "stel_dt"),
            ("FRAGMENT_COOKIE_TOKEN", "stel_token"),
            ("FRAGMENT_COOKIE_TON_TOKEN", "stel_ton_token"),
        ):
            val = getattr(self, env_key, None)
            if val and str(val).strip():
                cookies[cookie_key] = str(val).strip()
        return {k: cookies[k] for k in ("stel_ssid", "stel_dt", "stel_token", "stel_ton_token") if cookies.get(k)} or None

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Obuna muddati o'tganlarni Free ga qaytarish (cron)
    EXPIRATION_CHECK_URL: str = ""
    EXPIRATION_CHECK_SECRET: str = ""

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = Field(
        default=None, validation_alias=AliasChoices("SMTP_PASSWORD", "SMTP_PASS")
    )

    # Fragment Browser & Security
    FRAGMENT_HEADLESS: bool = False
    FRAGMENT_TIMEOUT: int = 30000
    ENCRYPTION_KEY: Optional[str] = None
    FERNET_KEY_SETTING: Optional[str] = None

    # Admin foydalanuvchilar seed'i (format: email:username:full_name:role; ...)
    SEED_ADMIN_USERS: str = ""

    @property
    def seed_admin_users(self) -> List[Dict[str, str]]:
        """SEED_ADMIN_USERS ni dict ro'yxatiga aylantiradi."""
        result: List[Dict[str, str]] = []
        for item in (self.SEED_ADMIN_USERS or "").split(";"):
            item = item.strip()
            if not item:
                continue
            parts = [p.strip() for p in item.split(":")]
            if len(parts) < 2:
                continue
            email = parts[0].lower()
            username = parts[1].lower()
            full_name = parts[2] if len(parts) > 2 and parts[2] else username
            role = parts[3].lower() if len(parts) > 3 and parts[3] else "superadmin"
            result.append({"email": email, "username": username, "full_name": full_name, "role": role})
        return result

    @property
    def FERNET_KEY(self) -> str:
        if self.FERNET_KEY_SETTING:
            return self.FERNET_KEY_SETTING
        if self.ENCRYPTION_KEY and len(self.ENCRYPTION_KEY) == 44:
            return self.ENCRYPTION_KEY
        import base64, hashlib
        digest = hashlib.sha256(self.SECRET_KEY.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest).decode("utf-8")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


def parse_cookie_string(raw: str) -> Dict[str, str]:
    """'key=value; key=value' yoki JSON dict formatidagi cookie'larni parse qiladi."""
    raw = (raw or "").strip()
    if not raw:
        return {}
    if raw.startswith("{"):
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                return {str(k): str(v) for k, v in data.items() if v is not None}
        except Exception:
            pass
    result: Dict[str, str] = {}
    for part in raw.split(";"):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            if k.strip():
                result[k.strip()] = v.strip()
    return result


settings = Settings()