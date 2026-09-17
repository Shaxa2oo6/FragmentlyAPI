import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

# Windows'da psycopg async + SQLAlchemy SelectorEventLoop talab qiladi.
# Policy loop yaratilishidan OLDIN (import vaqtida) o'rnatilishi shart.
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass
from app.api import (
    analytics,
    api_token,
    auth,
    cron,
    premium,
    stars,
    subscriptions,
    tariff,
    telegram,
    transactions,
    users,
    wallet,
    webhooks,
)
from app.api.v1 import wallet as wallet_v1, stars as stars_v1, admin as admin_v1, orders as orders_v1, analytics as analytics_v1
from app.config import settings
from app.database import Base, engine
from app.middleware import (
    AuthBruteForceProtectionMiddleware,
    RateLimitMiddleware,
    RequestLogMiddleware,
    SecurityHeadersMiddleware,
)
from app.tasks import _periodic_expiration_checker, _periodic_sweeper, sweep_stale_transactions
from app.utils.error_handler import (
    global_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
import app.models  # Ensures all SQLAlchemy models are registered in Base.metadata

# Logging
logging.basicConfig(level=logging.INFO)
# pytoniq LiteClient har blokda getMasterchainInfo/getAllShardsInfo so'rovini
# INFO darajasida log qiladi — bu shovqinni kamaytiramiz.
logging.getLogger("LiteClient").setLevel(logging.WARNING)
logging.getLogger("pytoniq.liteclient").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

_sweeper_task: asyncio.Task | None = None
_expiration_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        # Windows'da psycopg async uchun SelectorEventLoop'ni kafolatlash.
        # Ba'zi modullar (masalan Playwright) Proactor'ni qayta o'rnatishi mumkin.
        if sys.platform == "win32":
            loop = asyncio.get_running_loop()
            if isinstance(loop, asyncio.ProactorEventLoop):
                asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        from app.services.cache import close_redis, get_redis
        await get_redis()
        async with engine.begin() as conn:
            # 1. Base.metadata.create_all har doim BIRINChI bajariladi:
            # Yangi yaratilgan ma'lumotlar bazasida barcha jadvallar va ENUM turlari avtomatik hosil bo'ladi.
            await conn.run_sync(Base.metadata.create_all)

            # 2. Mavjud sxemada yangi ustunlar/enum qiymatlari bo'lsa sinxronlanadi
            def _ensure_schema(sync_conn):
                from sqlalchemy import inspect, text

                insp = inspect(sync_conn)

                # PostgreSQL ENUM turidagi yangi qiymatlarni sinxronlash
                def _sync_enum(type_name: str, enum_cls) -> None:
                    rows = sync_conn.execute(text(
                        "SELECT enumlabel FROM pg_type t "
                        "JOIN pg_enum e ON e.enumtypid = t.oid "
                        "WHERE t.typname = :n"
                    ), {"n": type_name}).fetchall()
                    if not rows:
                        return  # ENUM holati allaqachon create_all bilan yaratilgan
                    existing = {row[0] for row in rows}
                    for member in enum_cls:
                        label = member.name
                        if label not in existing:
                            try:
                                sync_conn.execute(
                                    text(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{label}'")
                                )
                                logger.warning(
                                    "enum '%s' ga '%s' qiymati qo'shildi", type_name, label
                                )
                            except Exception as exc:
                                logger.error(
                                    "enum '%s' ga '%s' qo'shishda xatolik: %s",
                                    type_name, label, exc,
                                )

                from app.models import PaymentMethod, TransactionType, UserRole

                _sync_enum("transactiontype", TransactionType)
                _sync_enum("paymentmethod", PaymentMethod)
                _sync_enum("userrole", UserRole)

                # DIQQAT: Umumiy (production) jadval HECH QACHON DROP qilinmaydi.
                # Eski sxema bo'lsa — faqat qo'shimcha (additive) ALTER bajariladi.
                if insp.has_table("wallet_connections"):
                    cols = {c["name"] for c in insp.get_columns("wallet_connections")}
                    if "wallet_address" not in cols:
                        logger.warning("wallet_connections jadvaliga wallet_address ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE wallet_connections ADD COLUMN wallet_address VARCHAR(100)"))

                if insp.has_table("tariffs"):
                    cols = {c["name"] for c in insp.get_columns("tariffs")}
                    if "duration_days" not in cols:
                        logger.warning("tariffs jadvaliga duration_days ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE tariffs ADD COLUMN duration_days INTEGER DEFAULT 30"))
                    if "features" not in cols:
                        logger.warning("tariffs jadvaliga features ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE tariffs ADD COLUMN features TEXT"))
                    if "badge" not in cols:
                        logger.warning("tariffs jadvaliga badge ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE tariffs ADD COLUMN badge VARCHAR(30)"))

                if insp.has_table("platform_wallet"):
                    cols = {c["name"] for c in insp.get_columns("platform_wallet")}
                    if "pending_wallet_address" not in cols:
                        logger.warning("platform_wallet jadvaliga pending_wallet_address ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN pending_wallet_address VARCHAR(100)"))
                    if "wallet_type" not in cols:
                        logger.warning("platform_wallet jadvaliga wallet_type ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN wallet_type VARCHAR(20) DEFAULT 'v4R2'"))
                    if "usdt_wallet_address" not in cols:
                        logger.warning("platform_wallet jadvaliga usdt_wallet_address ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN usdt_wallet_address VARCHAR(100)"))
                    if "wallet_seed_encrypted" not in cols:
                        logger.warning("platform_wallet jadvaliga wallet_seed_encrypted ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN wallet_seed_encrypted TEXT"))
                    if "seed_connected" not in cols:
                        logger.warning("platform_wallet jadvaliga seed_connected ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN seed_connected BOOLEAN DEFAULT FALSE"))

                if insp.has_table("users"):
                    cols = {c["name"] for c in insp.get_columns("users")}
                    if "tariff_id" not in cols:
                        logger.warning("users jadvaliga tariff_id ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE users ADD COLUMN tariff_id INTEGER"))
                    if "auto_renew" not in cols:
                        logger.warning("users jadvaliga auto_renew ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE users ADD COLUMN auto_renew BOOLEAN DEFAULT FALSE"))

            await conn.run_sync(_ensure_schema)

        # Seed initial DB defaults for admin panel
        from app.database import async_session
        from app.models import AdminUser, AllowedIP, PlatformWallet, Tariff, UserRole
        from sqlalchemy import select

        async with async_session() as session:
            admin_check = await session.execute(select(AdminUser))
            if not admin_check.scalars().all():
                for seed in settings.seed_admin_users:
                    role_str = seed["role"]
                    if role_str not in (UserRole.SUPERADMIN.value, UserRole.ADMIN.value, UserRole.SUPPORT.value):
                        role_str = UserRole.SUPERADMIN.value
                    session.add(AdminUser(
                        email=seed["email"],
                        username=seed["username"],
                        full_name=seed["full_name"],
                        role=UserRole(role_str),
                        is_active=True,
                    ))

            ip_check = await session.execute(select(AllowedIP))
            if not ip_check.scalars().all():
                session.add_all([
                    AllowedIP(ip_address="127.0.0.1", description="Localhost IPv4", created_by="system"),
                    AllowedIP(ip_address="::1", description="Localhost IPv6", created_by="system"),
                ])

            tariff_check = await session.execute(select(Tariff))
            existing = {t.name: t for t in tariff_check.scalars().all()}
            spec_tariffs = {
                "Free": dict(description="Boshlang'ich bepul tarif", price_gram=0.0, price_usdt=0.0, commission_percent=5.0, rate_limit_per_min=100, duration_days=30, features="Daqiqasiga 10 ta so'rov\nStandart qo'llab-quvvatlash\n5% komissiya", badge="standart"),
                "Lite": dict(description="O'rta hajm resurslar", price_gram=1.61, price_usdt=0.0, commission_percent=2.5, rate_limit_per_min=30, duration_days=30, features="Daqiqasiga 30 ta so'rov\nTez API javob\n2.5% komissiya\n30 kun faollik", badge="tezkor"),
                "Pro": dict(description="Maksimallashtirilgan API limitlar", price_gram=4.50, price_usdt=0.0, commission_percent=0.5, rate_limit_per_min=100, duration_days=30, features="Daqiqasiga 100 ta so'rov\n0.5% komissiya\nVIP 24/7 qo'llab-quvvatlash\nShaxsiy Webhook xabarnomalari\n30 kun faollik", badge="vip"),
            }
            # Faqat mavjud bo'lmagan tariflarni yaratamiz.
            # Mavjud yozuvlarga TEGMAYMIZ — aks holda admin panelda kiritilgan
            # narx/komissiya/rate-limit o'zgarishlari server qayta ishga tushganda o'chib ketardi.
            for name, kwargs in spec_tariffs.items():
                if name not in existing:
                    session.add(Tariff(name=name, **kwargs))

            # Platforma hamyoni endi SEED qilinmaydi: eski statik
            # PLATFORM_WALLET_ADDRESS logikasi o'chirilgan. Hamyon faqat
            # 24 so'zli seed-phrase orqali admin panelidan ulanganda yoziladi.

            await session.commit()

        logger.info("Database initialized successfully. Tables: %s", list(Base.metadata.tables.keys()))
    except Exception as e:
        logger.error("Failed to initialize database tables: %s", e, exc_info=True)

    # Qotib qolgan (PENDING/PROCESSING) Stars tranzaksiyalarini qayta ishlash
    global _sweeper_task
    try:
        asyncio.create_task(sweep_stale_transactions())
        _sweeper_task = asyncio.create_task(_periodic_sweeper(interval_seconds=300))
        logger.info("Stale-transaction sweeper started")
    except Exception as e:
        logger.error("Failed to start stale-transaction sweeper: %s", e)

    # Obuna muddati tugagan foydalanuvchilarni Free ga qaytarish
    # (Himoya A qatlami: server ishga tushganda 1-marta + har daqiqada background worker)
    global _expiration_task
    try:
        from app.database import async_session_maker
        from app.services.expiration_service import check_expired_subscriptions

        async with async_session_maker() as db:
            await check_expired_subscriptions(db)
        _expiration_task = asyncio.create_task(_periodic_expiration_checker(interval_seconds=60))
        logger.info("Subscription-expiration checker started")
    except Exception as e:
        logger.error("Failed to start subscription-expiration checker: %s", e)

    yield
    # Shutdown
    if _sweeper_task:
        _sweeper_task.cancel()
    if _expiration_task:
        _expiration_task.cancel()
    await close_redis()
    await engine.dispose()
    logger.info("Database disconnected")


app = FastAPI(
    title="FRAGMENTLY-API",
    description="Telegram Stars va Premium sotib olish uchun avtomatlashtirilgan API",
    version="3.0.0",
    lifespan=lifespan,
)

# Global error handlers - barcha xatoliklar yagona standart JSON formatda
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# Middleware (Starlette: oxirgi qo'shilgan eng tashqarida bajariladi)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuthBruteForceProtectionMiddleware)
app.add_middleware(RequestLogMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=int(settings.RATE_LIMIT_PER_MINUTE or 120),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://fragmently.uz",
        # ngrok / ishlab chiqish tunnellari (kerak bo'lsa qo'shing)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Cron-Secret", "Accept", "Origin"],
    expose_headers=["Content-Type"],
)

# Routes
app.include_router(auth.router)
app.include_router(auth.router, prefix="/api", include_in_schema=False)
app.include_router(users.router)
app.include_router(users.router, prefix="/users", include_in_schema=False)
app.include_router(wallet.router)
app.include_router(wallet.router, prefix="/wallet", include_in_schema=False)
app.include_router(stars.router)
app.include_router(premium.router)
app.include_router(transactions.router)
app.include_router(telegram.router)
app.include_router(subscriptions.router)
app.include_router(analytics.router)
app.include_router(analytics.router, prefix="/analytics", include_in_schema=False)
app.include_router(wallet_v1.router)
app.include_router(stars_v1.router)
app.include_router(orders_v1.router)
app.include_router(analytics_v1.router)
app.include_router(tariff.router)
app.include_router(api_token.router)
app.include_router(api_token.router, prefix="/api", include_in_schema=False)
app.include_router(api_token.router, prefix="/api/users", include_in_schema=False)
app.include_router(admin_v1.router, prefix="/api/v1/admin")
app.include_router(admin_v1.router, prefix="/api/admin", include_in_schema=False)
app.include_router(webhooks.router)
app.include_router(cron.router)


def custom_openapi():
    """OpenAPI sxemasiga X-API-Key security scheme qo'shadi.

    Shunda Swagger UI (/docs) da "Authorize" tugmasi paydo bo'ladi va
    `X-API-Key` header'ini API Token bilan to'ldirish mumkin bo'ladi (spec 1.A.4).
    """
    if app.openapi_schema:
        return app.openapi_schema
    from fastapi.openapi.utils import get_openapi

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {})
    schema["components"]["securitySchemes"]["X-API-Key"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "Profile sahifasida yaratilgan shaxsiy API Token (frag_...)",
    }
    schema["security"] = [{"X-API-Key": []}, {"bearerAuth": []}]
    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get("/")
async def root():
    return {
        "name": "FRAGMENTLY-API",
        "version": "3.0.0",
        "description": "Telegram Stars va Premium sotib olish uchun API",
        "docs": "/docs",
        "endpoints": {
            "auth": ["/auth/register", "/auth/login", "/auth/refresh"],
            "api_token": ["/api-token/generate", "/api-token/regenerate"],
            "stars": ["/api/stars/buy", "/api/stars/confirm", "/api/stars/price"],
            "premium": ["/api/premium/buy", "/api/premium/confirm", "/api/premium/price"],
            "wallet": ["/api/wallet/connect", "/api/wallet/disconnect", "/api/wallet/balance"],
            "tariff": ["/api/user/tariff", "/api/tariff/plans", "/api/tariff/buy", "/api/tariff/confirm"],
            "telegram": ["/api/telegram/user", "/api/telegram/user"],
            "transactions": ["/api/transactions", "/api/transactions/{id}/refund"],
            "admin": ["/api/admin/commissions"],
            "users": ["/api/users/me", "/api/users/regen-api-token"],
        },
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}