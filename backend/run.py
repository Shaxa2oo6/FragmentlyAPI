import os
import sys

import uvicorn
from dotenv import load_dotenv

# Windows'da psycopg async + SQLAlchemy uchun SelectorEventLoop kerak.
# Python 3.14+ da asyncio.run(..., loop_factory=...) ishlatiladi.
if sys.platform.startswith("win"):
    import asyncio

    if hasattr(asyncio, "WindowsSelectorEventLoopPolicy"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

load_dotenv()

if __name__ == "__main__":
    # StatReload faqat *.py o'zgarishlarida ishga tushadi; dinamik sozlamalar
    # (config.py, tariffs.py, .env) va venv/lar uchun exclude qilinadi.
    # .env orqali boshqarish mumkin: RELOAD_EXCLUDES="a,b" (vergul bilan ajratiladi).
    excludes_env = os.getenv("RELOAD_EXCLUDES", "").strip()
    reload_excludes = (
        [e.strip() for e in excludes_env.split(",") if e.strip()]
        if excludes_env
        else [
            "*.pyc",
            "__pycache__/*",
            "venv/*",
            ".env",
            "app/config.py",
            "app/services/tariffs.py",
        ]
    )

    uvicorn.run(
        "app.main:app",
        host="localhost",
        port=8000,
        reload=True,
        reload_includes=["*.py"],
        reload_excludes=reload_excludes,
    )
