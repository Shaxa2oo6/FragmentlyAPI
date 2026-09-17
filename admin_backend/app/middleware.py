import logging
import time
from collections import defaultdict, deque
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)

EXEMPT_PATHS = (
    "/docs",
    "/redoc",
    "/openapi.json",
    "/health",
    "/api/admin/auth/google",
    "/api/v1/admin/auth/google",
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Admin backend va Admin Panel uchun HTTP xavfsizlik sarlavhalarini (Security Headers) o'rnatadi.
    
    Qo'shiladigan sarlavhalar:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY (iframe ichida ochish taqiqlanadi)
    - X-XSS-Protection: 1; mode=block
    - Strict-Transport-Security: max-age=31536000; includeSubDomains (HSTS)
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: camera=(), microphone=(), geolocation=()
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response



class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 120, exempt_paths=EXEMPT_PATHS):
        super().__init__(app)
        self.rpm = requests_per_minute
        self.exempt_paths = exempt_paths
        self._history: dict[str, deque] = defaultdict(deque)

    def _is_exempt(self, path: str) -> bool:
        return any(path.startswith(p) for p in self.exempt_paths)

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        client_ip = request.client.host if request.client else "127.0.0.1"

        if not self._is_exempt(path):
            now = time.time()
            history = self._history[client_ip]
            window_start = now - 60.0

            while history and history[0] < window_start:
                history.popleft()

            if len(history) >= self.rpm:
                logger.warning("Admin Rate limit exceeded: IP=%s path=%s", client_ip, path)
                return JSONResponse(
                    status_code=429,
                    content={"detail": "So'rovlar soni cheklangan, birozdan so'ng qayta urinib ko'ring"},
                )

            history.append(now)

        response = await call_next(request)
        return response


class RequestLogMiddleware(BaseHTTPMiddleware):
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


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """`.env` faylidagi ALLOWED_ADMIN_IPS asosida Admin API'ga kirishni himoya qiladi.

    Mantiq:
    - Har bir `/api/admin/*` va `/api/v1/admin/*` so'rovida foydalanuvchi IP
      manzili `ALLOWED_ADMIN_IPS` ro'yxati bilan solishtiriladi.
    - IP ro'yxatda BO'LSA  -> so'rov normal davom etadi (sayt va login ochiladi).
    - IP ro'yxatda BO'LMASA -> ulanish 403 bilan rad etiladi (IP_NOT_ALLOWED).
      Frontend buni aniqlab, foydalanuvchini asosiy hostga (`/`) silent-redirect
      qiladi.

    `/auth/ip-check` endpointi bu guard'dan EXEMPT qilinadi, chunki frontend
    shu orqali "IP ruxsat etilganmi?" degan savolni qo'yadi va rad etilgan
    IP'ni asosiy hostga yo'naltirish imkoniga ega bo'ladi.
    """

    def __init__(self, app):
        super().__init__(app)
        self.admin_prefixes = ("/api/admin", "/api/v1/admin")
        self.exempt_paths = (
            "/api/admin/auth/ip-check",
            "/api/v1/admin/auth/ip-check",
        )

    @staticmethod
    def _client_ip(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
        return request.client.host if request.client else "127.0.0.1"

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if not any(path.startswith(p) for p in self.admin_prefixes):
            return await call_next(request)
        if any(path.startswith(p) for p in self.exempt_paths):
            return await call_next(request)

        client_ip = self._client_ip(request).lower()
        allowed_ips = settings.allowed_admin_ips_set

        if client_ip not in allowed_ips:
            logger.warning("IP Whitelist Guard: ruxsat etilmagan IP rad etildi: %s (path=%s)", client_ip, path)
            return JSONResponse(
                status_code=403,
                content={"detail": "IP_NOT_ALLOWED"},
                headers={
                    "X-Admin-IP-Allowed": "0",
                    "X-Admin-Client-IP": client_ip,
                },
            )

        response = await call_next(request)
        return response


class BlockedIPGuardMiddleware(BaseHTTPMiddleware):
    """Bloklangan IP-lardan kelgan barcha /api/admin/* so'rovlarini rad etadi.

    Bu middleware har bir admin so'rovida blocked_ips jadvalini tekshiradi —
    bloklangan IP login sahifasiga ham, boshqa hech qanday admin endpoint'ga
    ham kira olmaydi (defense-in-depth, whitelist tekshiruvidan tashqari).
    """

    def __init__(self, app):
        super().__init__(app)
        self.admin_prefixes = ("/api/admin", "/api/v1/admin")

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if not any(path.startswith(p) for p in self.admin_prefixes):
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip() or client_ip

        try:
            from app.database import async_session
            from app.services.ip_blocker import is_ip_blocked

            async with async_session() as db:
                blocked = await is_ip_blocked(db, client_ip)
            if blocked:
                logger.warning("Bloklangan IP'dan admin so'rov rad etildi: %s %s", client_ip, path)
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Access denied"},
                )
        except Exception as exc:
            logger.error("BlockedIP guard tekshiruvda xato: %s", exc)

        response = await call_next(request)
        return response
