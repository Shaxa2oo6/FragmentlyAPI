from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid

from app.database import Base


class UserRole(str, enum.Enum):
    USER = "user"
    RESELLER = "reseller"
    SUPPORT = "support"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class TransactionType(str, enum.Enum):
    STARS = "stars"
    PREMIUM = "premium"
    TARIFF = "tariff"
    REFUND = "refund"
    COMMISSION = "commission"

    # Aniq semantik turlar
    PREMIUM_PURCHASE = "premium_purchase"
    ENERGY_REFILL = "energy_refill"
    BALANCE_TOPUP = "balance_topup"


class PaymentMethod(str, enum.Enum):
    GRAM = "gram"
    USDT = "usdt"
    CARD = "card"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100))
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER)

    wallet_address = Column(String(100), nullable=True)
    balance_gram = Column(Float, default=0.0)
    balance_usdt = Column(Float, default=0.0)

    api_token = Column(String(64), unique=True, index=True, default=lambda: uuid.uuid4().hex)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(100), nullable=True)

    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    tariff_plan = Column(String(50), default="Free")
    tariff_type = Column(String(20), default="free")
    tariff_id = Column(Integer, ForeignKey("tariffs.id"), nullable=True)
    tariff_expires_at = Column(DateTime(timezone=True), nullable=True)
    auto_renew = Column(Boolean, default=False)
    commission_rate = Column(Float, default=0.05)

    total_stars_purchased = Column(Integer, default=0)
    total_premium_purchased = Column(Integer, default=0)
    total_spent_gram = Column(Float, default=0.0)
    total_spent_usdt = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(50), nullable=True)

    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="admin_user", cascade="all, delete-orphan")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.ADMIN, nullable=False)
    is_active = Column(Boolean, default=True)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(100), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AllowedIP(Base):
    __tablename__ = "allowed_ips"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_by = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(45), unique=True, index=True, nullable=False)
    reason = Column(String(255), nullable=True)
    blocked_at = Column(DateTime(timezone=True), server_default=func.now())
    blocked_until = Column(DateTime(timezone=True), nullable=True)  # None = doimiy bloklash
    triggered_by_email = Column(String(100), nullable=True)


class AdminLoginLog(Base):
    __tablename__ = "admin_login_logs"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BlockedAdminEmail(Base):
    """Admin paneldan qo'lda bloklangan emaillar (ushbu email bilan kirish taqiqlanadi)."""

    __tablename__ = "blocked_admin_emails"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    reason = Column(String(255), nullable=True)
    blocked_by = Column(String(100), nullable=True)
    blocked_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_username = Column(String(50), nullable=False)
    action_type = Column(String(100), nullable=False)
    target_object = Column(String(100), nullable=True)
    target_id = Column(String(100), nullable=True)
    previous_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    admin_user = relationship("User", back_populates="audit_logs")


class Tariff(Base):
    __tablename__ = "tariffs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    price_gram = Column(Float, default=0.0)
    price_usdt = Column(Float, default=0.0)
    commission_percent = Column(Float, default=5.0)
    rate_limit_per_min = Column(Integer, default=60)
    duration_days = Column(Integer, default=30)  # obuna muddati (kun)
    features = Column(Text, nullable=True)  # yangi qator bilan ajratilgan xususiyatlar
    badge = Column(String(30), nullable=True)  # standart / tezkor / vip
    is_active = Column(Boolean, default=True)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PlatformWallet(Base):
    __tablename__ = "platform_wallet"

    id = Column(Integer, primary_key=True, index=True)
    # Eski qo'lda kiritiladigan statik manzil logikasi o'chirildi:
    # manzil endi faqat 24 so'zli seed-phrase orqali derivatsiya qilinadi.
    wallet_address = Column(String(100), nullable=True)
    wallet_type = Column(String(20), default="v4R2")
    pending_wallet_address = Column(String(100), nullable=True)
    wallet_change_token = Column(String(100), nullable=True)
    wallet_change_expires_at = Column(DateTime(timezone=True), nullable=True)
    balance_gram = Column(Float, default=0.0)
    balance_usdt = Column(Float, default=0.0)
    total_commission_gram = Column(Float, default=0.0)
    total_commission_usdt = Column(Float, default=0.0)

    # Double-wallet (seed-phrase orqali ulash): TON + USDT (Jetton)
    usdt_wallet_address = Column(String(100), nullable=True)
    wallet_seed_encrypted = Column(Text, nullable=True)
    seed_connected = Column(Boolean, default=False)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    transaction_type = Column(Enum(TransactionType), nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING)
    payment_method = Column(Enum(PaymentMethod), nullable=False)

    amount = Column(Float, nullable=False)
    commission_amount = Column(Float, default=0.0)
    currency = Column(String(10), default="GRAM")
    target_username = Column(String(100), nullable=True)
    fragment_tx_id = Column(String(100), nullable=True)
    refund_reason = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    is_flagged = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="transactions")


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False)
    destination_address = Column(String(100), nullable=False)
    admin_username = Column(String(50), nullable=False)
    status = Column(String(20), default="completed")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
