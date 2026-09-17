import asyncio
import logging
import os
from sqlalchemy import select

from app.auth import get_password_hash
from app.database import async_session_maker, engine, Base
from app.models import User, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Barcha seed ma'lumotlar .env / environment orqali beriladi (kodga yozib qoldirilmaydi).
SEED_ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@example.com")
SEED_ADMIN_USERNAME = os.environ.get("SEED_ADMIN_USERNAME", "admin")
SEED_ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD")  # majburiy
SEED_DEMO_EMAIL = os.environ.get("SEED_DEMO_EMAIL", "demo@example.com")
SEED_DEMO_USERNAME = os.environ.get("SEED_DEMO_USERNAME", "demo")
SEED_DEMO_PASSWORD = os.environ.get("SEED_DEMO_PASSWORD")  # majburiy


async def seed_data():
    if not SEED_ADMIN_PASSWORD or not SEED_DEMO_PASSWORD:
        logger.error(
            "SEED_ADMIN_PASSWORD va SEED_DEMO_PASSWORD environment o'zgaruvchilarini "
            "o'rnatmasdan seed ishga tushirilmaydi."
        )
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as db:
        # Check if admin exists
        stmt = select(User).where(User.username == SEED_ADMIN_USERNAME)
        res = await db.execute(stmt)
        admin = res.scalar_one_or_none()

        if not admin:
            admin_user = User(
                email=SEED_ADMIN_EMAIL,
                username=SEED_ADMIN_USERNAME,
                full_name="System Administrator",
                hashed_password=get_password_hash(SEED_ADMIN_PASSWORD),
                role=UserRole.ADMIN,
                balance_gram=1000.0,
                balance_usdt=500.0,
                is_verified=True,
            )
            db.add(admin_user)
            logger.info(
                "Created default admin user: %s / %s",
                SEED_ADMIN_USERNAME,
                "*" * len(SEED_ADMIN_PASSWORD),
            )

        # Check demo user
        stmt_user = select(User).where(User.username == SEED_DEMO_USERNAME)
        res_user = await db.execute(stmt_user)
        demo = res_user.scalar_one_or_none()

        if not demo:
            demo_user = User(
                email=SEED_DEMO_EMAIL,
                username=SEED_DEMO_USERNAME,
                full_name="Demo User",
                hashed_password=get_password_hash(SEED_DEMO_PASSWORD),
                role=UserRole.USER,
                balance_gram=250.0,
                balance_usdt=100.0,
                is_verified=True,
            )
            db.add(demo_user)
            logger.info("Created default demo user: %s", SEED_DEMO_USERNAME)

        await db.commit()
        logger.info("Seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_data())