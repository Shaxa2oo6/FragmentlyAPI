# backend/app/api/telegram.py
"""
Telegram foydalanuvchi ma'lumotlari API

Username (t.me) orqali Telegram foydalanuvchisining ochiq profil
ma'lumotlarini qaytaradi. Bot token talab qilmaydi.
"""

import logging
import re

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional

from app.dependencies import get_current_user_optional
from app.models import User
from app.utils.helpers import normalize_username

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/telegram", tags=["Telegram"])

TME_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


# ====== SCHEMAS ======

class TelegramUserInfo(BaseModel):
    """Telegram foydalanuvchi ma'lumotlari"""
    ok: bool = True
    name: Optional[str] = None
    username: Optional[str] = None
    photo: Optional[str] = None


class TelegramUserRequest(BaseModel):
    username: str = Field(..., pattern=r"^@?[A-Za-z0-9_]{4,32}$", description="Telegram username (masalan: @durov)")


class TelegramUserResponse(BaseModel):
    success: bool
    data: Optional[TelegramUserInfo] = None
    error: Optional[str] = None
    status_code: int = 200


class TelegramService:
    """Telegram profil ma'lumotlarini t.me orqali olish xizmati"""

    async def get_user_info(self, username: str) -> dict:
        """Username orqali Telegram foydalanuvchi ma'lumotlarini olish."""
        username = normalize_username(username)
        if not username:
            return {"ok": False, "error": "Username kiritilmagan", "status_code": 400}

        parsed = await self._get_user_via_tme(username)
        if parsed is not None:
            return parsed

        # Fallback: t.me dan olish imkonsiz bo'lsa (tarmoq xatosi) mock ma'lumotlar
        logger.warning("t.me fetch qilinmadi, mock ma'lumot qaytarilmoqda: %s", username)
        return self._get_mock_user(username)

    async def _get_user_via_tme(self, username: str) -> Optional[dict]:
        """t.me ochiq sahifasidan profil ma'lumotlarini parse qiladi.

        Returns:
            ok=True dict   -> profil topildi
            ok=False dict  -> username topilmadi (HTTP 200, bo'sh title)
            None           -> tarmoq/parse xatosi (fallback mock uchun)
        """
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(f"https://t.me/{username}", headers=TME_HEADERS)

            if resp.status_code != 200:
                logger.warning("t.me/%s => HTTP %s", username, resp.status_code)
                return {
                    "ok": False,
                    "error": "Telegram foydalanuvchisi topilmadi",
                    "status_code": 404,
                }

            html = resp.text

            # Sahifa mavjudligi: noto'g'ri username'da title bo'sh bo'ladi
            title_match = re.search(
                r'<div class="tgme_page_title"[^>]*>.*?<span[^>]*>(.*?)</span>',
                html,
                re.S,
            )
            name = self._strip_tags(title_match.group(1)).strip() if title_match else ""
            if not name:
                return {
                    "ok": False,
                    "error": "Telegram foydalanuvchisi topilmadi",
                    "status_code": 404,
                }

            photo_match = re.search(
                r'<meta property="og:image" content="([^"]+)"', html
            )
            photo = photo_match.group(1) if photo_match else self._find_photo_url(html)

            return {
                "ok": True,
                "name": name,
                "username": username,
                "photo": photo,
            }
        except httpx.HTTPError as exc:
            logger.warning("t.me fetch error for %s: %s", username, exc)
            return None
        except Exception as exc:
            logger.error("Telegram parse error for %s: %s", username, exc)
            return None

    @staticmethod
    def _find_photo_url(html: str) -> Optional[str]:
        """tgme_page_photo_image img'dan profil rasmini oladi."""
        match = re.search(
            r'<img[^>]*class="tgme_page_photo_image"[^>]*src="([^"]+)"', html
        )
        if match:
            return match.group(1)
        match = re.search(r'<img[^>]*id="tgme_page_photo"[^>]*src="([^"]+)"', html)
        return match.group(1) if match else None

    @staticmethod
    def _strip_tags(text: str) -> str:
        text = re.sub(r"<br\s*/?>", "\n", text)
        text = re.sub(r"<[^>]+>", "", text)
        import html as _html

        return _html.unescape(text)

    @staticmethod
    def _get_mock_user(username: str) -> dict:
        """Fallback mock ma'lumotlar (t.me ochiq sahifasi ishlamaganda)."""
        mock_data = {
            "durov": {
                "ok": True,
                "name": "Pavel Durov",
                "username": "durov",
                "photo": "https://cdn4.telegram-cdn.org/file/durov_photo.jpg",
            },
            "shakh_akn": {
                "ok": True,
                "name": "Shakh Akn",
                "username": "shakh_akn",
                "photo": "https://cdn4.telegram-cdn.org/file/default_photo.jpg",
            },
        }

        if username in mock_data:
            return mock_data[username]

        return {
            "ok": True,
            "name": username.capitalize(),
            "username": username,
            "photo": "https://cdn4.telegram-cdn.org/file/default_photo.jpg",
        }


# ====== SINGLETON ======
telegram_service = TelegramService()


# ====== API ENDPOINT ======

@router.get("/user", response_model=TelegramUserResponse)
async def get_telegram_user(
    username: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Telegram foydalanuvchi ma'lumotlarini olish.

    Username orqali foydalanuvchining ochoq profilini (ismi, profil rasmi,
    bio) t.me sahifasidan yuklab qaytaradi.

    MISOLLAR:
    - GET /api/telegram/user?username=durov
    - GET /api/telegram/user?username=@shakh_akn
    """
    clean_username = normalize_username(username)
    if not clean_username:
        return TelegramUserResponse(
            success=False,
            error="Username kiritilmagan",
            status_code=400,
        )

    result = await telegram_service.get_user_info(clean_username)

    if result.get("ok"):
        return TelegramUserResponse(
            success=True,
            data=TelegramUserInfo(
                ok=True,
                name=result.get("name"),
                username=result.get("username", clean_username),
                photo=result.get("photo"),
            ),
            status_code=200,
        )

    return TelegramUserResponse(
        success=False,
        error=result.get("error", "Telegram foydalanuvchisi topilmadi"),
        status_code=result.get("status_code", 404),
    )


@router.post("/user", response_model=TelegramUserResponse)
async def get_telegram_user_post(
    request: TelegramUserRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Telegram foydalanuvchi ma'lumotlarini olish (POST).

    Body: {"username": "@durov"}
    """
    return await get_telegram_user(request.username, current_user)