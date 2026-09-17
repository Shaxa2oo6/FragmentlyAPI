"""
Admin panel uchun Pydantic schemalar (javob modellari)
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TariffDistributionItem(BaseModel):
    name: str = Field("Free", description="Tarif nomi")
    value: int = Field(0, description="Foydalanuvchilar soni")
    percent: float = Field(0.0, description="Foiz ulushi")


class ChartDataItem(BaseModel):
    date: str = Field(..., description="Kun (DD.MM)")
    ton: float = Field(0.0, description="TON tushumi")
    usdt: float = Field(0.0, description="USDT tushumi")


class RecentActivityItem(BaseModel):
    type: str = Field("transaction", description="Faoliyat turi: user|transaction|wallet")
    message: str = Field("", description="Faoliyat tavsifi")
    time: str = Field("", description="Vaqt (HH:MM)")
    status: str = Field("success", description="Holat: success|pending|failed")


class AdminStatsResponse(BaseModel):
    total_users: int = 0
    new_users_this_week: int = 0
    user_growth: float = 0.0
    connected_wallets: int = 0
    total_transactions: int = 0
    transactions_this_week: int = 0
    transaction_growth: float = 0.0
    total_commission: float = 0.0
    total_commission_usdt: float = 0.0
    active_subscribers: int = 0
    tariff_distribution: List[TariffDistributionItem] = Field(default_factory=list)
    chart_data: List[ChartDataItem] = Field(default_factory=list)
    recent_activities: List[RecentActivityItem] = Field(default_factory=list)


class UserListItem(BaseModel):
    id: int
    username: str
    email: str
    role: str = "user"
    tariff_plan: str = "Free"
    is_active: bool = True
    wallet_address: Optional[str] = None
    balance_gram: float = 0.0
    balance_usdt: float = 0.0
    total_spent_gram: float = 0.0
    total_spent_usdt: float = 0.0
    created_at: Optional[str] = None


class UserListResponse(BaseModel):
    items: List[UserListItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 20
    total_pages: int = 0


class TransactionListItem(BaseModel):
    id: int
    user_id: int
    username: Optional[str] = None
    transaction_type: str = ""
    status: str = ""
    amount: float = 0.0
    commission_amount: float = 0.0
    currency: str = "TON"
    target_username: Optional[str] = None
    fragment_tx_id: Optional[str] = None
    is_flagged: bool = False
    refund_reason: Optional[str] = None
    created_at: Optional[str] = None


class TransactionListResponse(BaseModel):
    items: List[TransactionListItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 20
    total_pages: int = 0


class AdminActionRequest(BaseModel):
    action: str = Field(..., description="Harakat turi, masalan: USER_BAN, TARIFF_UPDATE")
    target_id: Optional[Any] = None
    target_type: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class AdminHealthResponse(BaseModel):
    status: str = "operational"
    uptime: str = "99.98%"
    errors_24h: int = 0
    services: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
