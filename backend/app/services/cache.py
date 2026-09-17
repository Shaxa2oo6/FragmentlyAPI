# backend/app/services/cache.py
"""
REDIS CACHE MANAGER (FASTAPI & BACKEND)

Ushbu modul Redis keshini boshqaradi:
- Redis serveriga ulanish va ulanish o'zilganda avtomatik xavfsiz (fallback) rejimi
- `@cache_response(ttl=60)` dekatori orqali API javoblarini keshga saqlash
- Keshni tozalash (invalidation) funksiyalari (pattern bo'yicha ham)
- JSON serializatsiya / deserializatsiya
"""

import asyncio
import json
import logging
from functools import wraps
from typing import Any, Callable, Dict, Optional, Union

import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger(__name__)

# Global Redis mijoz obyekt
_redis_client: Optional[aioredis.Redis] = None
_redis_available: bool = True


async def get_redis() -> Optional[aioredis.Redis]:
    """Redis mijozini xavfsiz qaytaradi. Ulanish bo'lmasa None qaytaradi."""
    global _redis_client, _redis_available

    if _redis_client is not None:
        return _redis_client

    if not _redis_available:
        return None

    try:
        url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0") or "redis://localhost:6379/0"
        _redis_client = aioredis.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
        # Test connection
        await _redis_client.ping()
        logger.info("✅ Redis ulanishi muvaffaqiyatli o'rnatildi: %s", url)
        return _redis_client
    except Exception as exc:
        _redis_available = False
        _redis_client = None
        logger.warning("⚠️ Redis serveriga ulanib bo'lmadi (%s). Kesh fallback (to'g'ridan-to'g'ri DB) rejimida ishlaydi.", exc)
        return None


async def close_redis() -> None:
    """Redis ulanishini yopadi."""
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.close()
            logger.info("Redis ulanishi yopildi.")
        except Exception as exc:
            logger.error("Redis ulanishini yopishda xatolik: %s", exc)
        finally:
            _redis_client = None


async def cache_get(key: str) -> Optional[Any]:
    """Keshdan ma'lumotni kalit bo'yicha oladi."""
    client = await get_redis()
    if not client:
        return None
    try:
        data = await client.get(key)
        if data:
            return json.loads(data)
    except Exception as exc:
        logger.warning("Redis cache_get xatolik (key=%s): %s", key, exc)
    return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> bool:
    """Ma'lumotni keshga berilgan TTL (soniya) bilan saqlaydi."""
    client = await get_redis()
    if not client:
        return False
    try:
        serialized = json.dumps(value, ensure_ascii=False, default=str)
        await client.set(key, serialized, ex=ttl)
        return True
    except Exception as exc:
        logger.warning("Redis cache_set xatolik (key=%s): %s", key, exc)
        return False


async def cache_delete(key: str) -> bool:
    """Bir dona kalitni keshdan o'chiradi."""
    client = await get_redis()
    if not client:
        return False
    try:
        await client.delete(key)
        return True
    except Exception as exc:
        logger.warning("Redis cache_delete xatolik (key=%s): %s", key, exc)
        return False


async def cache_delete_pattern(pattern: str) -> int:
    """Berilgan glob pattern bo'yicha barcha kalitlarni o'chiradi (masalan: 'tariff:*')."""
    client = await get_redis()
    if not client:
        return 0
    try:
        keys = []
        async for key in client.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            deleted = await client.delete(*keys)
            logger.info("Pattern '%s' bo'yicha %d ta kesh kaliti o'chirildi.", pattern, deleted)
            return deleted
    except Exception as exc:
        logger.warning("Redis cache_delete_pattern xatolik (pattern=%s): %s", pattern, exc)
    return 0


def cache_response(ttl: int = 60, prefix: str = "fastapi"):
    """
    FastAPI async endpoint natijalarini keshlaydigan decorator.
    
    Ishlatilishi:
        @router.get("/api/tariffs")
        @cache_response(ttl=300, prefix="tariffs")
        async def get_tariffs(...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Request obyekti yoki argumentlaridan unikal kesh kalitini tuzamiz
            request = kwargs.get("request")
            if request and hasattr(request, "url"):
                cache_key = f"{prefix}:{request.url.path}:{request.query_params}"
            else:
                # Argumentlardan kalit tuzish
                args_str = ":".join([str(a) for a in args if not hasattr(a, "execute")])
                kwargs_str = ":".join([f"{k}={v}" for k, v in kwargs.items() if not hasattr(v, "execute") and k != "db"])
                cache_key = f"{prefix}:{func.__name__}:{args_str}:{kwargs_str}"

            # 1. Keshni tekshirish (HIT)
            cached_val = await cache_get(cache_key)
            if cached_val is not None:
                logger.debug("🎯 CACHE HIT: %s", cache_key)
                return cached_val

            # 2. Funktsiyani bajarish (MISS)
            logger.debug("⚡ CACHE MISS: %s", cache_key)
            result = await func(*args, **kwargs)

            # 3. Natijani keshga yozish
            if result is not None:
                # Pydantic model bo'lsa dict ga o'giramiz
                serializable_result = result
                if hasattr(result, "model_dump"):
                    serializable_result = result.model_dump()
                elif hasattr(result, "dict"):
                    serializable_result = result.dict()
                await cache_set(cache_key, serializable_result, ttl=ttl)

            return result

        return wrapper

    return decorator
