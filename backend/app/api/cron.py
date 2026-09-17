"""
Cron / internal tekshiruv endpointlari.

`POST /api/cron/expire-subscriptions` — obuna muddati tugagan foydalanuvchilarni
Free tarifga qaytaradi. `X-Cron-Secret` header orqali himoyalanadi
(backend/.env => EXPIRATION_CHECK_SECRET). Cron qurilma curl bilan uradi:
    curl -X POST "EXPIRATION_CHECK_URL" -H "X-Cron-Secret: <SECRET>"
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.expiration_service import check_expired_subscriptions

router = APIRouter(tags=["cron"])


@router.post("/api/cron/expire-subscriptions")
async def expire_subscriptions(
    x_cron_secret: str = Header(..., alias="X-Cron-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Muddati tugagan barcha obunachilarni Free tarifga qaytaradi."""
    if not settings.EXPIRATION_CHECK_SECRET:
        raise HTTPException(status_code=503, detail="EXPIRATION_CHECK_SECRET .env'da sozlanmagan")
    if x_cron_secret != settings.EXPIRATION_CHECK_SECRET:
        raise HTTPException(status_code=403, detail="Noto'g'ri X-Cron-Secret")

    count = await check_expired_subscriptions(db)
    return {"status": "ok", "downgraded": count}
