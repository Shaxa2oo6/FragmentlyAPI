"""Tarif asosidagi rate limiting, xavfsizlik sarlavhalari (Security Headers),
Auth brute-force himoyasi va request logging middleware'lar.
"""

import logging
import time
from collections import defaultdict, deque

from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)

EXEMPT_PATHS = (
    "/webhook/",      # Webhook'lar (Stripe/tergov va Fragment)
    "/docs",          # Swagger UI
    "/redoc",
    "/openapi.json",
    "/health",
    "/api/tariff/buy",       # Obuna to'lovi rate limitga bog'lanmasligi kerak
    "/api/tariff/confirm",
)

# token (X-API-Key yoki JWT sub) -> (rpm, checked_at)
_RPM_CACHE: dict[str, tuple[int, float]] = {}
_RPM_CACHE_TTL = 60.0


def clear_rpm_cache(key: str | None = None) -> None:
    """Rate limit RAM keshini tozalaydi (Tarif o'zgarganda)."""
    global _RPM_CACHE
    if key:
        _RPM_CACHE.pop(key, None)
    else:
        _RPM_CACHE.clear()


async def _resolve_rpm(request: Request) -> int:
    """Token/API-kalit bo'yicha foydalanuvchi tarif limitini aniqlaydi."""
    now = time.time()

    token = request.headers.get("X-API-Key") or request.headers.get("X-API-Token")
    if token:
        cached = _RPM_CACHE.get(token)
        if cached and now - cached[1] < _RPM_CACHE_TTL:
            return cached[0]
        try:
            from app.database import async_session_maker
            from app.models import User
            from app.services.tariffs import DEFAULT_RPM, db_requests_per_minute

            async with async_session_maker() as db:
                res = await db.execute(select(User).where(User.api_token == token))
                user = res.scalar_one_or_none()
                if user:
                    from app.services.expiration_service import downgrade_expired_user, is_expired

                    if is_expired(user) and await downgrade_expired_user(db, user):
                        await db.commit()
                rpm = (
                    await db_requests_per_minute(db, user.tariff_type or "free")
                    if user
                    else DEFAULT_RPM
                )
            _RPM_CACHE[token] = (rpm, now)
            return rpm
        except Exception as exc:
            logger.warning("RPM resolve error, fallback %s: %s", DEFAULT_RPM, exc)
            return DEFAULT_RPM

    # JWT Bearer orqali
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        jwt_token = auth[7:].strip()
        if jwt_token:
            cached = _RPM_CACHE.get(jwt_token)
            if cached and now - cached[1] < _RPM_CACHE_TTL:
                return cached[0]
            try:
                from app.auth import decode_token
                from app.database import async_session_maker
                from app.models import User
                from app.services.tariffs import DEFAULT_RPM, db_requests_per_minute

                payload = decode_token(jwt_token)
                username = payload.get("sub") if payload else None
                if username:
                    async with async_session_maker() as db:
                        res = await db.execute(select(User).where(User.username == username))
                        user = res.scalar_one_or_none()
                        if user:
                            from app.services.expiration_service import downgrade_expired_user, is_expired

                            if is_expired(user) and await downgrade_expired_user(db, user):
                                await db.commit()
                        rpm = (
                            await db_requests_per_minute(db, user.tariff_type or "free")
                            if user
                            else DEFAULT_RPM
                        )
                    _RPM_CACHE[jwt_token] = (rpm, now)
                    return rpm
            except Exception as exc:
                logger.warning("JWT RPM resolve error: %s", exc)

    return 0  # anonymous -> pastki global limit ishlatiladi


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Xavfsizlik sarlavhalari (Security Headers) va hujumlardan himoya."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        headers = response.headers
        headers["X-Content-Type-Options"] = "nosniff"
        headers["X-Frame-Options"] = "SAMEORIGIN"
        headers["X-XSS-Protection"] = "1; mode=block"
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        headers["Server"] = "Fragmently-Secure-Gateway"
        if request.url.scheme == "https":
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        return response


class AuthBruteForceProtectionMiddleware(BaseHTTPMiddleware):
    """Auth (Login / Kod tekshirish) bo'yicha Brute-force hujumlaridan himoya (5 minutda max 10 ta so'rov)."""

    PROTECTED_ENDPOINTS = (
        "/auth/login",
        "/auth/verify-code",
        "/auth/send-verification-code",
    )

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and any(request.url.path.startswith(p) for p in self.PROTECTED_ENDPOINTS):
            ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
                request.client.host if request.client else "unknown"
            )
            redis_key = f"bruteforce:auth:{ip}"

            from app.services.cache import get_redis
            r = await get_redis()
            if r:
                try:
                    attempts = await r.incr(redis_key)
                    if attempts == 1:
                        await r.expire(redis_key, 300)  # 5 daqiqa kesh
                    if attempts > 10:
                        from app.utils.error_handler import error_payload

                        logger.warning("🚨 Brute-force blokirovka IP=%s path=%s", ip, request.url.path)
                        return JSONResponse(
                            status_code=429,
                            content=error_payload(
                                429,
                                "Juda ko'p login/kod urinishlari! Xavfsizlik yuzasidan 5 daqiqaga vaqtincha cheklandingiz.",
                                details={"ip": ip, "retry_after_seconds": 300},
                            ),
                        )
                except Exception as exc:
                    logger.warning("Brute force check error: %s", exc)

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Foydalanuvchi tarifiga (va IP) asoslangan Redis / RAM sliding-window limiter."""

    def __init__(self, app, requests_per_minute: int = 120, exempt_paths=EXEMPT_PATHS):
        super().__init__(app)
        self.global_rpm = requests_per_minute
        self.exempt_paths = exempt_paths
        self._history: dict[str, deque] = defaultdict(deque)
        self.enabled = bool(settings.RATE_LIMIT_ENABLED)

    def _is_exempt(self, path: str) -> bool:
        return any(path.startswith(p) for p in self.exempt_paths)

    def _identity_key(self, request: Request) -> str:
        """Limit hisobini alohida foydalanuvchi (token / IP) bo'yicha olib boradi."""
        token = request.headers.get("X-API-Key") or request.headers.get("X-API-Token")
        if token:
            return f"token:{token}"
        auth = request.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return f"jwt:{auth[7:].strip()}"
        ip = request.client.host if request.client else "unknown"
        return f"ip:{ip}"

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if self.enabled and not self._is_exempt(path):
            identity = self._identity_key(request)
            rpm = await _resolve_rpm(request)
            if rpm <= 0:
                rpm = self.global_rpm

            # 1. Redis bilan limitlash (Taqsimlangan / Multi-worker)
            from app.services.cache import get_redis
            r = await get_redis()
            if r:
                try:
                    redis_key = f"ratelimit:{identity}"
                    count = await r.incr(redis_key)
                    if count == 1:
                        await r.expire(redis_key, 60)
                    if count > rpm:
                        from app.utils.error_handler import error_payload

                        logger.warning("Rate limit oshdi (Redis): %s rpm=%s path=%s", identity, rpm, path)
                        return JSONResponse(
                            status_code=429,
                            content=error_payload(
                                429,
                                f"So'rovlar soni cheklangan (tarifingiz: {rpm}/daqiqa). Birozdan so'ng qayta urinib ko'ring.",
                                details={"rate_limit_per_minute": rpm},
                            ),
                        )
                except Exception as exc:
                    logger.warning("Redis rate limit error, fallback memory: %s", exc)
            else:
                # 2. Xotiradagi (RAM) fallback
                now = time.time()
                window_start = now - 60.0
                history = self._history[identity]
                while history and history[0] < window_start:
                    history.popleft()

                if len(history) >= rpm:
                    logger.warning("Rate limit oshdi (RAM): %s rpm=%s path=%s", identity, rpm, path)
                    from app.utils.error_handler import error_payload

                    return JSONResponse(
                        status_code=429,
                        content=error_payload(
                            429,
                            f"So'rovlar soni cheklangan (tarifingiz: {rpm}/daqiqa). Birozdan so'ng qayta urinib ko'ring.",
                            details={"rate_limit_per_minute": rpm},
                        ),
                    )
                history.append(now)

        response = await call_next(request)
        return response


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Har bir so'rovni log qiladi (metod, yo'l, status, davomiylik)."""

    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "%s %s -> %s (%d ms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
