from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    api_token: str
    wallet_address: Optional[str] = None
    balance_gram: float = 0.0
    balance_usdt: float = 0.0
    total_stars_purchased: int = 0
    total_premium_purchased: int = 0
    total_spent_gram: float = 0.0
    total_spent_usdt: float = 0.0
    is_verified: bool = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    telegram_username: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)


class ConnectWalletRequest(BaseModel):
    seed_phrase: str = Field(..., min_length=10)


class DepositRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: str = Field(..., pattern="^(gram|usdt)$")


class BuyStarsRequest(BaseModel):
    username: str = Field(..., description="Telegram username, masalan: @username")
    quantity: int = Field(..., ge=1, le=100000)
    payment_method: str = Field("gram", pattern="^(gram|usdt)$")


class BuyPremiumRequest(BaseModel):
    user_id: str = Field(..., description="Telegram user ID")
    username: Optional[str] = None
    duration_days: int = Field(30, ge=30, le=365)
    payment_method: str = Field("gram", pattern="^(gram|usdt)$")


class TransactionOut(BaseModel):
    id: int
    type: str
    status: str
    payment_method: str
    quantity: Optional[int] = None
    target_username: Optional[str] = None
    premium_duration: Optional[int] = None
    premium_user_id: Optional[str] = None
    premium_user_username: Optional[str] = None
    amount: float
    currency: str
    fragment_tx_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ApiResponse(BaseModel):
    success: bool = True
    message: str = ""
    data: Optional[dict] = None