import json
from typing import Dict, List, Optional, Set

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ============================== Server ==============================
    # Backend ishlaydigan port. run.py ham shu portni ishlatadi.
    PORT: int = 8001

    # Har bir IP uchun daqiqalik so'rovlar limiti (RateLimitMiddleware).
    RATE_LIMIT_PER_MINUTE: int = 120

    # ============================== Database ==============================
    # ASOSIY backend (backend/.env) bilan bir xil PostgreSQL bazasi.
    # Shunda admin paneldagi tarif/hamyon o'zgarishlari foydalanuvchilarga darhol ko'rinadi.
    # Qiymat faqat .env orqali beriladi (.env.example ga qarang).
    DATABASE_URL: str = ""

    # ============================== JWT Security ==============================
    # Kamida 60-70 belgidan iborat, kryptografik tasodifiy (secrets.token_urlsafe) maxfiy kalit.
    # Qiymat faqat .env orqali beriladi — kodga yozib qoldirilmaydi.
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ============================== Google OAuth ==============================
    # Google Cloud Console'dagi OAuth 2.0 Client ID (VITE -- .env orqali).
    GOOGLE_CLIENT_ID: str = ""

    # ============================== Admin ruxsatlar ==============================
    # Email-based automatic admin login: faqat shu ro'yxatdagi Google email
    # sign-in qilganda SUPERADMIN session/JWT oladi. Boshqalar 403 oladi.
    # Qiymat faqat .env orqali beriladi.
    ALLOWED_ADMIN_EMAILS: str = ""

    # IP Whitelist Guard: vergul bilan ajratilgan ruxsat etilgan IP manzillar.
    # Ruxsat etilmagan IP'dan barcha /api/admin/* so'rovlari rad etiladi.
    ALLOWED_ADMIN_IPS: str = "127.0.0.1,::1"

    # ============================== Login brute-force himoyasi ==============================
    # Belgilangan vaqt oynasida shuncha muvaffaqiyatsiz urinish bo'lsa IP vaqtincha bloklanadi.
    ADMIN_LOGIN_MAX_ATTEMPTS: int = 5
    ADMIN_LOGIN_ATTEMPT_WINDOW_SECONDS: int = 300

    # ============================== CORS ==============================
    # Ruxsat etilgan originlar (JSON massiv ko'rinishida).
    ALLOWED_ORIGINS: str = (
        '["http://localhost:5177", "http://127.0.0.1:5177", '
        '"http://localhost:5173", "http://127.0.0.1:5173", '
        '"http://localhost:5174", "http://127.0.0.1:5174"]'
    )

    # ============================== Seed ma'lumotlar (birinchi ishga tushirish) ==============================
    # AdminUser seed'lari. Format: email:username:full_name:role; ...  (role: superadmin|admin|support)
    # Qiymat faqat .env orqali beriladi.
    SEED_ADMIN_USERS: str = ""

    # Eslatma: Eski statik PLATFORM_WALLET_ADDRESS / DEFAULT_WALLET_BALANCE_*
    # o'zgaruvchilari olib tashlandi — platforma hamyoni endi faqat 24 so'zli
    # seed-phrase (mnemonic) orqali ulanadi va manzil/balanslar avtomatik
    # hisoblanadi (admin_backend/app/services/platform_wallet_service.py).

    # ============================== Telegram ogohlantirish ==============================
    # Ruxsatsiz kirish urinishlari bo'lganda adminlarga xabar yuboriladi.
    SECURITY_ALERT_TELEGRAM_BOT_TOKEN: str = ""
    SECURITY_ALERT_TELEGRAM_CHAT_ID: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    FERNET_KEY_SETTING: Optional[str] = None

    @property
    def FERNET_KEY(self) -> str:
        """Seed shifrlash kaliti. Belgilansa FERNET_KEY_SETTING, aks holda SECRET_KEY dan hosil qilinadi."""
        if self.FERNET_KEY_SETTING:
            return self.FERNET_KEY_SETTING
        import base64, hashlib

        digest = hashlib.sha256(self.SECRET_KEY.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest).decode("utf-8")

    @property
    def allowed_admin_emails_set(self) -> Set[str]:
        return {e.strip().lower() for e in (self.ALLOWED_ADMIN_EMAILS or "").split(",") if e.strip()}

    @property
    def allowed_admin_ips_set(self) -> Set[str]:
        return {ip.strip().lower() for ip in (self.ALLOWED_ADMIN_IPS or "").split(",") if ip.strip()}

    @property
    def localhost_ip_fallback(self) -> Set[str]:
        """Mahalliy server IP-lari — DB/IP ro'yxatiga qo'shimcha sifatida ham ruxsat beriladi."""
        return {"127.0.0.1", "::1", "localhost"}

    @property
    def cors_origins(self) -> list:
        try:
            origins = json.loads(self.ALLOWED_ORIGINS or "[]")
            return origins if isinstance(origins, list) else []
        except Exception:
            return [
                "http://localhost:5177",
                "http://127.0.0.1:5177",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
            ]

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


settings = Settings()
