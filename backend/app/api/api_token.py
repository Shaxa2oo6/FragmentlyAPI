"""API Token endpoin'lari.

  POST /api-token/generate     -> token yo'q bo'lsa yaratadi, bor bo'lsa aylantiradi
  POST /api-token/regenerate   -> mavjud tokenni aylantiradi (yangi qiymat)

Ikkalasi ham faqat wallet ulanganda ruxsat etiladi (spec 1.A.3).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.api_token import set_api_token

router = APIRouter(prefix="/api-token", tags=["API Token"])

logger = logging.getLogger(__name__)


def _require_wallet(current_user: User) -> None:
    """Wallet ulanmagan bo'lsa 403 — API token himoyalangan funksiya."""
    if not current_user.wallet_connected or not current_user.wallet_address:
        raise HTTPException(
            status_code=403,
            detail="API Token yaratish uchun avval TON hamyoningizni ulang",
        )


@router.post("/generate")
@router.post("/api-key/generate")
async def generate_api_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """API Token yaratish (agar mavjud bo'lsa — aylantiradi).

    Qat'iy qoida: token faqat wallet ulangandan KEYIN yaratiladi.
    """
    _require_wallet(current_user)

    new_token = set_api_token(current_user, db)
    await db.commit()
    await db.refresh(current_user)

    logger.info("API token generated: user=%s regenerated=%s", current_user.username, bool(current_user.api_token))

    return {
        "success": True,
        "message": "Yangi API Token yaratildi",
        "api_token": new_token,
        "api_key": new_token,
    }


@router.post("/regenerate")
@router.post("/api-key/regenerate")
async def regenerate_api_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mavjud API Tokenni aylantirish (eski token darhol bekor bo'ladi).

    Faqat wallet ulangan va token mavjud bo'lgan holda ishlaydi.
    """
    _require_wallet(current_user)

    if not current_user.api_token:
        raise HTTPException(status_code=400, detail="Avval API Token yarating")

    new_token = set_api_token(current_user, db)
    await db.commit()
    await db.refresh(current_user)

    logger.info("API token regenerated: user=%s", current_user.username)

    return {
        "success": True,
        "message": "API Token muvaffaqiyatli yangilandi",
        "api_token": new_token,
        "api_key": new_token,
    }
