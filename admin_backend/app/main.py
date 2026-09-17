import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.api import admin
from app.config import settings
from app.database import Base, async_session, engine
from app.middleware import (
    BlockedIPGuardMiddleware,
    IPWhitelistMiddleware,
    RateLimitMiddleware,
    RequestLogMiddleware,
    SecurityHeadersMiddleware,
)
import app.models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("admin_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            def _ensure_schema(sync_conn):
                from sqlalchemy import inspect, text
                insp = inspect(sync_conn)

                if insp.has_table("admin_login_logs"):
                    try:
                        sync_conn.execute(text("ALTER TABLE admin_login_logs ALTER COLUMN status TYPE VARCHAR(50)"))
                        sync_conn.execute(text("ALTER TABLE admin_login_logs ALTER COLUMN username TYPE VARCHAR(100)"))
                    except Exception:
                        pass

                # UMUMIY jadval o'chirilmaydi — faqat xavfsiz, qo'shimcha migratsiyalar.
                if insp.has_table("transactions"):
                    tx_cols = {c["name"] for c in insp.get_columns("transactions")}
                    if "error_message" not in tx_cols:
                        logger.warning("transactions jadvaliga error_message ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE transactions ADD COLUMN error_message TEXT"))

                if insp.has_table("platform_wallet"):
                    pw_cols = {c["name"] for c in insp.get_columns("platform_wallet")}
                    if "pending_wallet_address" not in pw_cols:
                        logger.warning("platform_wallet jadvaliga pending_wallet_address ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN pending_wallet_address VARCHAR(100)"))
                    if "wallet_type" not in pw_cols:
                        logger.warning("platform_wallet jadvaliga wallet_type ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN wallet_type VARCHAR(20) DEFAULT 'v4R2'"))
                    # Double-wallet (seed-phrase orqali ulash) uchun ustunlar
                    if "usdt_wallet_address" not in pw_cols:
                        logger.warning("platform_wallet jadvaliga usdt_wallet_address ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN usdt_wallet_address VARCHAR(100)"))
                    if "wallet_seed_encrypted" not in pw_cols:
                        logger.warning("platform_wallet jadvaliga wallet_seed_encrypted ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN wallet_seed_encrypted TEXT"))
                    if "seed_connected" not in pw_cols:
                        logger.warning("platform_wallet jadvaliga seed_connected ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN seed_connected BOOLEAN DEFAULT FALSE"))

                if insp.has_table("tariffs"):
                    tf_cols = {c["name"] for c in insp.get_columns("tariffs")}
                    if "duration_days" not in tf_cols:
                        logger.warning("tariffs jadvaliga duration_days ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE tariffs ADD COLUMN duration_days INTEGER DEFAULT 30"))
                    if "features" not in tf_cols:
                        logger.warning("tariffs jadvaliga features ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE tariffs ADD COLUMN features TEXT"))
                    if "badge" not in tf_cols:
                        logger.warning("tariffs jadvaliga badge ustuni qo'shilmoqda")
                        sync_conn.execute(text("ALTER TABLE tariffs ADD COLUMN badge VARCHAR(30)"))

            await conn.run_sync(_ensure_schema)

            # Faqat admin_backend'ga xos jadvallarni yaratamiz. Umumiy jadvallarni
            # (users, transactions, tariffs, platform_wallet va h.k.) ASOSIY backend
            # yaratadi va boshqaradi — bu yerda qayta yaratish/yozib o'chirish XAVFLI.
            from app.models import BlockedAdminEmail, BlockedIP, Payout, AdminLoginLog
            await conn.run_sync(
                Base.metadata.create_all,
                tables=[BlockedIP.__table__, Payout.__table__, AdminLoginLog.__table__, BlockedAdminEmail.__table__],
            )

        from app.models import AdminUser, AllowedIP, PlatformWallet, Tariff, UserRole
        from sqlalchemy import select

        async with async_session() as session:
            admin_check = await session.execute(select(AdminUser))
            existing_admins = admin_check.scalars().all()
            if not existing_admins:
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
                for ip_addr in settings.allowed_admin_ips_set:
                    session.add(AllowedIP(
                        ip_address=ip_addr,
                        description="Admin kirish IP manzili (.env ALLOWED_ADMIN_IPS)",
                        created_by="system",
                    ))

            tariff_check = await session.execute(select(Tariff))
            if not tariff_check.scalars().all():
                session.add_all([
                    Tariff(name="Free", description="Boshlang'ich bepul tarif", price_gram=0.0, price_usdt=0.0, commission_percent=5.0, rate_limit_per_min=60),
                    Tariff(name="Lite", description="O'rta hajm resurslar", price_gram=10.0, price_usdt=25.0, commission_percent=2.5, rate_limit_per_min=120),
                    Tariff(name="Pro", description="Maksimallashtirilgan API limitlar", price_gram=30.0, price_usdt=75.0, commission_percent=0.5, rate_limit_per_min=300),
                ])

            # Platforma hamyoni endi SEED qilinmaydi: eski statik
            # PLATFORM_WALLET_ADDRESS logikasi o'chirilgan. Hamyon faqat
            # 24 so'zli seed-phrase orqali ulanganda yoziladi.

            await session.commit()

        logger.info("Admin Backend Database initialized successfully on port %d", settings.PORT)
    except Exception as e:
        logger.error("Failed to initialize admin_backend DB: %s", e, exc_info=True)
    yield
    await engine.dispose()
    logger.info("Admin Backend DB disconnected")


app = FastAPI(
    title="Fragmently Admin Backend API",
    description="Fragmently Admin Panel uchun xavfsiz va alohida backend xizmati",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLogMiddleware)
app.add_middleware(BlockedIPGuardMiddleware)
app.add_middleware(IPWhitelistMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=int(settings.RATE_LIMIT_PER_MINUTE or 120),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router, prefix="/api/admin")
app.include_router(admin.router, prefix="/api/v1/admin", include_in_schema=False)


@app.get("/")
async def root():
    return {
        "service": "Fragmently Admin Backend API",
        "status": "running",
        "port": settings.PORT,
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "admin_backend"}
