# backend/app/services/fragment_prices.py
"""
Official Fragment.com narxlari asosida GRAM (ex TON) narxlarini hisoblash.

Telegram narxlarni USD da belgilaydi; Fragment.com da to'lov GRAM (TON) da
bo'ladi va summa jonli TON/USD kursi bilan hisoblanadi:

  - Stars:   1 dona ~ $0.015  (fragment.com, Apple/Google 30% komissiyasiz)
  - Premium: 3 oy $14.99, 6 oy $19.99, 12 oy $35.99  (fragment.com/premium)

Kurs manbai: TonAPI.io (/rates) - jonli TON/USD, PRICE_CACHE_TTL muddatga keshlanadi.
"""

import logging
import time
from typing import Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_TONAPI_URL = "https://tonapi.io/v2"

# Kun -> oy (fragment.com premium gifting faqat 3/6/12 oy taklif qiladi: 91, 182, 365 kun)
DAY_TO_MONTHS = {90: 3, 91: 3, 180: 6, 182: 6, 365: 12}


MONTHS = (3, 6, 12)

# fragment.com Stars paketlari (min 50, Telegram USD da belgilaydi)
STAR_PACKAGES = (50, 100, 500, 1000, 2500, 5000)


class FragmentPricesService:
    """Rasmiy Fragment.com narxlarini GRAM da hisoblaydi."""

    def __init__(self):
        self._ton_usd: Optional[float] = None
        self._ton_usd_ts: float = 0.0
        self._fallback_ton_usd: float = 2.5

    # ---------- Jonli TON/USD kursi ----------

    async def get_ton_usd_rate(self) -> float:
        """TonAPI.io dan jonli TON/USD kursi (Redis + RAM kesh)."""
        ttl = int(getattr(settings, "PRICE_CACHE_TTL", 60) or 60)
        
        # 1. RAM kesh (eng tezkor)
        if self._ton_usd is not None and (time.monotonic() - self._ton_usd_ts) < ttl:
            return self._ton_usd

        # 2. Redis kesh
        from app.services.cache import cache_get, cache_set
        cached_rate = await cache_get("rates:ton_usd")
        if cached_rate is not None:
            try:
                rate_val = float(cached_rate)
                self._ton_usd = rate_val
                self._ton_usd_ts = time.monotonic()
                return rate_val
            except Exception:
                pass

        # 3. TonAPI orqali jonli olish
        ton_usd = self._fallback_ton_usd
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    f"{_TONAPI_URL}/rates?tokens=ton&currencies=usd",
                    headers={"Accept": "application/json"},
                )
                res.raise_for_status()
                data = res.json()
                price = (data.get("rates") or {}).get("TON", {}).get("prices", {}).get("USD")
                if price:
                    ton_usd = float(price)
                    await cache_set("rates:ton_usd", ton_usd, ttl=ttl)
        except Exception as exc:
            logger.warning("TON/USD kurs olishda xatolik, fallback %.4f: %s", ton_usd, exc)

        self._ton_usd = ton_usd
        self._ton_usd_ts = time.monotonic()
        return ton_usd

    # ---------- Stars narxi ----------

    async def get_star_price_gram(self) -> float:
        """1 Star narxi GRAM da (rasmiy USD anchor + jonli kurs)."""
        star_usd = float(getattr(settings, "FRAGMENT_STARS_PRICE_USD", 0.015) or 0.015)
        ton_usd = await self.get_ton_usd_rate()
        return round(star_usd / ton_usd, 9)

    async def get_star_packages(self) -> list:
        """Fragment.com Stars paketlari narxlari (GRAM + USD) — min 50."""
        star_usd = float(getattr(settings, "FRAGMENT_STARS_PRICE_USD", 0.015) or 0.015)
        ton_usd = await self.get_ton_usd_rate()
        packages = []
        for stars in STAR_PACKAGES:
            usd = round(stars * star_usd, 2)
            packages.append({
                "stars": stars,
                "usd": usd,
                "gram": round(usd / ton_usd, 6),
            })
        return packages

    # ---------- Premium narxi ----------

    def _premium_usd(self, months: int) -> float:
        key = {3: "PREMIUM_3M_PRICE_USD", 6: "PREMIUM_6M_PRICE_USD", 12: "PREMIUM_12M_PRICE_USD"}
        default = {3: 14.99, 6: 19.99, 12: 35.99}
        return float(getattr(settings, key.get(months, "PREMIUM_3M_PRICE_USD"), default.get(months, 14.99)))

    async def get_premium_price_gram(self, months: int) -> float:
        """Premium narxi GRAM da (berilgan oylar uchun)."""
        ton_usd = await self.get_ton_usd_rate()
        return round(self._premium_usd(months) / ton_usd, 6)

    async def get_premium_prices(self) -> Dict[str, Dict]:
        """Barcha premium tayflar (3/6/12 oy) narxlari GRAM + USD da."""
        ton_usd = await self.get_ton_usd_rate()
        result: Dict[str, Dict] = {}
        for m in MONTHS:
            usd = self._premium_usd(m)
            result[str(m)] = {
                "months": m,
                "days": m * 30,
                "usd": round(usd, 2),
                "gram": round(usd / ton_usd, 6),
            }
        return result

    def months_from_days(self, duration_days: int) -> int:
        """Kunlarni Fragment oylariga moslaydi (30->3, 90->3, 180->6, 365->12)."""
        return DAY_TO_MONTHS.get(int(duration_days), 3)

    async def get_premium_price_for_days(self, duration_days: int) -> float:
        """Kun bo'yicha Premium narxi GRAM da."""
        months = self.months_from_days(duration_days)
        return await self.get_premium_price_gram(months)


fragment_prices = FragmentPricesService()
