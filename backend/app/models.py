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

from app.database import Base

import enum


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
    # Legacy / saqlanib qolgan turlar
    STARS = "stars"
    PREMIUM = "premium"
    TARIFF = "tariff"
    REFUND = "refund"
    COMMISSION = "commission"

    # Aniq semantik turlar:
    # PREMIUM_PURCHASE — Telegram Premium obunasi. `amount`=Summa (TON/USD), `premium_duration`=Muddat (kun).
    PREMIUM_PURCHASE = "premium_purchase"
    # ENERGY_REFILL / STARS — TON balansi bilan energiya/stars to'ldirish. `quantity`=Miqdor (⚡/Stars), `amount`=Summa (TON).
    ENERGY_REFILL = "energy_refill"
    # BALANCE_TOPUP — Hisobga pul kiritish. `amount`=Kiritilgan summa (TON), `quantity` mavjud emas.
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

    # Wallet
    wallet_address = Column(String(100), nullable=True)
    wallet_seed_encrypted = Column(Text, nullable=True)
    wallet_connected = Column(Boolean, default=False)

    # Balance (cache)
    balance_gram = Column(Float, default=0.0)
    balance_usdt = Column(Float, default=0.0)

    # API & 2FA
    # API token HECh qachon avtomatik yaratilmaydi — faqat wallet ulangach,
    # foydalanuvchi "Generate API Token" tugmasini bosganda `frag_...` formatida hosil qilinadi.
    api_token = Column(String(128), unique=True, index=True, nullable=True)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(100), nullable=True)

    # Settings
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    telegram_id = Column(String(50), nullable=True)
    telegram_username = Column(String(50), nullable=True)
    tariff_plan = Column(String(50), default="Free")

    # Tarif tizimi (free / lite / pro)
    tariff_type = Column(String(20), default='free')
    tariff_id = Column(Integer, ForeignKey("tariffs.id"), nullable=True)
    tariff_expires_at = Column(DateTime(timezone=True), nullable=True)
    auto_renew = Column(Boolean, default=False)
    commission_rate = Column(Float, default=0.05)

    # Stats
    total_stars_purchased = Column(Integer, default=0)
    total_premium_purchased = Column(Integer, default=0)
    total_spent_gram = Column(Float, default=0.0)
    total_spent_usdt = Column(Float, default=0.0)
    total_transactions = Column(Integer, default=0)
    total_commission_paid = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(50), nullable=True)

    # Relationships
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    mnemonics = relationship("Mnemonic", back_populates="user", cascade="all, delete-orphan")
    wallet_connections = relationship("WalletConnection", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="admin_user", cascade="all, delete-orphan")


class Mnemonic(Base):
    __tablename__ = "mnemonics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seed_phrase_encrypted = Column(Text, nullable=False)
    wallet_address = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="mnemonics")


class WalletConnection(Base):
    __tablename__ = "wallet_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    wallet_address = Column(String(100), nullable=False, index=True)
    raw_address = Column(String(100), nullable=True)
    wallet_type = Column(String(20), nullable=False, default="v4R2")
    is_active = Column(Boolean, default=True)
    balance_ton = Column(Float, default=0.0)
    balance_gram = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="wallet_connections")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    transaction_type = Column(Enum(TransactionType), nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING)
    payment_method = Column(Enum(PaymentMethod), nullable=False)

    # Stars
    quantity = Column(Integer, nullable=True)
    target_username = Column(String(100), nullable=True)

    # Premium
    premium_duration = Column(Integer, nullable=True)
    premium_user_id = Column(String(50), nullable=True)
    premium_user_username = Column(String(100), nullable=True)

    # Amount & Commission
    amount = Column(Float, nullable=False)
    commission_amount = Column(Float, default=0.0)
    commission_rate = Column(Float, nullable=True)
    currency = Column(String(10), default="GRAM")

    # Blockchain (TON Connect payment)
    tx_hash = Column(String(100), nullable=True)
    destination_wallet = Column(String(100), nullable=True)

    # Fragment
    fragment_tx_id = Column(String(100), nullable=True)
    fragment_order_id = Column(String(100), nullable=True)

    # Error & Refund
    error_message = Column(Text, nullable=True)
    refund_reason = Column(Text, nullable=True)
    is_refund = Column(Boolean, default=False)
    original_transaction_id = Column(Integer, nullable=True)

    # Flags
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String(255), nullable=True)

    # Metadata
    transaction_metadata = Column("metadata", JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="transactions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_username = Column(String(50), nullable=False)
    action_type = Column(String(100), nullable=False)  # e.g. TARIFF_CHANGE, REFUND_APPROVE, USER_BLOCK
    target_object = Column(String(100), nullable=True)  # e.g. USER, TRANSACTION, TARIFF
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
    name = Column(String(50), unique=True, nullable=False)  # Free, Lite, Pro
    description = Column(Text, nullable=True)
    price_gram = Column(Float, default=0.0)   # narx TON/GRAM
    price_usdt = Column(Float, default=0.0)   # narx USDT
    commission_percent = Column(Float, default=5.0)  # e.g. 5.0%
    rate_limit_per_min = Column(Integer, default=60)  # so'rovlar soni / daqiqa
    duration_days = Column(Integer, default=30)  # obuna muddati (kun)
    features = Column(Text, nullable=True)  # vergul/yangi qator bilan ajratilgan xususiyatlar
    badge = Column(String(30), nullable=True)  # standart / tezkor / vip
    is_active = Column(Boolean, default=True)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tariff_id = Column(Integer, ForeignKey("tariffs.id"), nullable=True)
    plan_code = Column(String(50), nullable=False, default="free")
    status = Column(String(20), default="active", index=True)
    starts_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    auto_renew = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AdminLoginLog(Base):
    __tablename__ = "admin_login_logs"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)  # SUCCESS, FAILED, 2FA_PENDING
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PlatformWallet(Base):
    __tablename__ = "platform_wallet"

    id = Column(Integer, primary_key=True, index=True)
    # Eski qo'lda kiritiladigan statik manzil logikasi o'chirildi:
    # manzil endi faqat 24 so'zli seed-phrase orqali derivatsiya qilinadi.
    wallet_address = Column(String(100), nullable=True)
    pending_wallet_address = Column(String(100), nullable=True)
    wallet_change_token = Column(String(100), nullable=True)
    wallet_change_expires_at = Column(DateTime(timezone=True), nullable=True)
    balance_gram = Column(Float, default=0.0)
    balance_usdt = Column(Float, default=0.0)
    total_commission_gram = Column(Float, default=0.0)
    total_commission_usdt = Column(Float, default=0.0)

    # Seed-phrase (24 so'z) orqali ulangan platforma hamyonlari (double-wallet: TON + USDT)
    # `wallet_seed_encrypted` — Fernet (AES) bilan shifrlangan platforma mnemonic iborasi.
    usdt_wallet_address = Column(String(100), nullable=True)
    wallet_seed_encrypted = Column(Text, nullable=True)
    seed_connected = Column(Boolean, default=False)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


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


class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), server_default=func.now())

    total_transactions = Column(Integer, default=0)
    total_stars_sold = Column(Integer, default=0)
    total_premium_sold = Column(Integer, default=0)
    total_revenue_gram = Column(Float, default=0.0)
    total_revenue_usdt = Column(Float, default=0.0)
    success_rate = Column(Float, default=0.0)

    # Daily stats
    daily_transactions = Column(Integer, default=0)
    daily_stars = Column(Integer, default=0)
    daily_premium = Column(Integer, default=0)
    daily_revenue = Column(Float, default=0.0)


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AllowedIP(Base):
    __tablename__ = "allowed_ips"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_by = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())