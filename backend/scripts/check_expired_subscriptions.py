#!/usr/bin/env python3
"""
Obuna muddati tugagan foydalanuvchilarni avtomatik Free tarifga qaytaruvchi CLI skript.

Background worker (Layer A) server ichida har 60 soniyada ishlaydi — bu skript
kerak bo'lmasa ham qo'shimcha xavfsizlik qatlami sifatida cron orqali ishlatiladi.

Cron sozlamasi (har 5 daqiqada):
    */5 * * * * cd /root/stars/backend && /usr/bin/python3 scripts/check_expired_subscriptions.py >> /var/log/tariff-expire.log 2>&1

Skript DB'ga to'g'ridan-to'g'ri ulanadi (backend/.env dan DATABASE_URL o'qiladi),
server ishga tushgan bo'lishi shart emas.
"""

import asyncio
import os
import sys

# Backend ildizi sys.path ga qo'shiladi (cron cwd'ga bog'liq bo'lmasin)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime

from app.database import async_session_maker
from app.services.expiration_service import check_expired_subscriptions


async def main() -> int:
    async with async_session_maker() as db:
        count = await check_expired_subscriptions(db)
    print(f"[{datetime.now().isoformat(timespec='seconds')}] Expired subscriptions -> Free: {count}")
    return count


if __name__ == "__main__":
    if os.name == "nt":
        # Windows: psycopg async SelectorEventLoop talab qiladi (ProactorEventLoop emas).
        sys.exit(asyncio.run(main(), loop_factory=asyncio.SelectorEventLoop))
    sys.exit(asyncio.run(main()))
