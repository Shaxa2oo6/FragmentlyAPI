import asyncio
import logging
import sys

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.database import Base, engine
import app.models  # Ensure all models are loaded

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("init_db")


async def init_db():
    logger.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized successfully!")
    logger.info("Tables: %s", list(Base.metadata.tables.keys()))


if __name__ == "__main__":
    asyncio.run(init_db())
