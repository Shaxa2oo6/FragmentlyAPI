from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.wallet_connect import WalletConnectError, wallet_connect_service

router = APIRouter(prefix="/api/v1/wallet", tags=["Wallet v1"])


class ConnectWalletRequest(BaseModel):
    mnemonic: str = Field(..., min_length=1, max_length=1000, description="12 yoki 24 so'zli seed-phrase")


@router.post("/connect/")
async def connect_wallet(
    data: ConnectWalletRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GRAM / TON hamyonini seed-phrase orqali ulash.

    Request: {"mnemonic": "24 ta so'z..."}
    Response: wallet_info (address, raw_address, wallet_type, is_active, balance_ton, balance_gram)
    """
    try:
        result = await wallet_connect_service.connect(
            db=db, user=current_user, raw_mnemonic=data.mnemonic
        )
    except WalletConnectError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ichki xatolik: {exc}")

    return result
