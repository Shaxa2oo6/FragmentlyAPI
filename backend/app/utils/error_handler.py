"""
Global error handler - to'liq avtomatik standart xatolik javobi.

Har qanday xatolik (HTTPException, RequestValidationError, kutilmagan
Exception) foydalanuvchiga doimo YAGONA standart JSON formatda qaytariladi:

    {
        "error": "BAD_REQUEST",          # xatolik kodi
        "status_code": 400,               # HTTP status
        "message": "Noto'g'ri parametrlar",  # inson o'qiydigan xabar
        "details": {...},                 # ixtiyoriy qo'shimcha ma'lumot
        "timestamp": "2026-08-12T10:00:00Z",
        "error_id": "a1b2c3d4"            # faqat 500 uchun (debug)
    }

Status kodlar bo'yicha standart xatolik kodlari:
    400 -> BAD_REQUEST
    401 -> UNAUTHORIZED
    402 -> INSUFFICIENT_BALANCE
    403 -> FORBIDDEN
    404 -> NOT_FOUND
    422 -> VALIDATION_ERROR
    429 -> RATE_LIMIT_EXCEEDED
    500 -> INTERNAL_SERVER_ERROR
"""

import logging
import traceback
import uuid
from datetime import datetime, timezone

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

# HTTP status -> standart xatolik kodi
ERROR_CODE_BY_STATUS = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    402: "INSUFFICIENT_BALANCE",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_SERVER_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def error_code_for(status_code: int) -> str:
    """Berilgan HTTP status uchun standart xatolik kodini qaytaradi."""
    return ERROR_CODE_BY_STATUS.get(status_code, f"HTTP_{status_code}")


def error_payload(
    status_code: int,
    message: str,
    *,
    details=None,
    error: str | None = None,
    error_id: str | None = None,
) -> dict:
    """Standart xatolik JSON tuzilmasini yig'adi."""
    payload = {
        "success": False,
        "error": error or error_code_for(status_code),
        "status_code": int(status_code),
        "message": message,
        "timestamp": _now_iso(),
    }
    if details is not None:
        payload["details"] = details
    if error_id:
        payload["error_id"] = error_id
    return payload


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """FastAPI/Starlette HTTPException'larni standart formatga o'zgartiradi.

    `detail` string yoki dict bo'lishi mumkin:
      - string -> message
      - dict   -> error + message (agar bor bo'lsa) + details (qolgan maydonlar)
    """
    status_code = exc.status_code
    detail = exc.detail

    message = detail
    details = None
    custom_error = None
    if isinstance(detail, dict):
        custom_error = detail.get("error")
        message = detail.get("message") or detail.get("detail") or "Xatolik yuz berdi"
        extra = {k: v for k, v in detail.items() if k not in ("message", "detail", "error")}
        if "details" in extra:
            details = extra.pop("details")
        if extra:
            details = {**(details or {}), **extra}

    headers = getattr(exc, "headers", None)
    return JSONResponse(
        status_code=status_code,
        content=error_payload(status_code, message, details=details, error=custom_error),
        headers=headers,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Pydantic/fastapi request validation xatoliklarini 422 standart formatda qaytaradi."""
    errors = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
        errors.append(
            {
                "field": ".".join(loc) or None,
                "message": err.get("msg"),
                "type": err.get("type"),
            }
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_payload(
            422,
            "So'rov parametrlari noto'g'ri yoki majburiy maydonlar etishmayapti",
            details={"errors": errors},
        ),
    )


async def global_exception_handler(request: Request, exc: Exception):
    """Kutilmagan xatolik - 500 Internal Server Error standart formatda."""
    error_id = uuid.uuid4().hex[:8]
    logger.error(
        "Unhandled error [%s] on %s: %s\n%s",
        error_id,
        request.url.path,
        exc,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_payload(
            500,
            "Tizim ichki xatoligi yuz berdi. Qayta urinib ko'ring.",
            error_id=error_id,
        ),
    )
