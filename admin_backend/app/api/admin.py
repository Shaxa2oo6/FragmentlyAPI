import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password
from app.config import settings
from app.database import get_db
from app.dependencies import (
    get_current_admin,
    require_admin_or_superadmin,
    require_superadmin,
)
from app.services.admin_middleware import AdminMiddleware

_TARIFF_DISPLAY = {"free": "Free", "lite": "Lite", "pro": "Pro"}


def _canonical_plan(tariff_type) -> str:
    """tariff_type (slug) kanonik manba — ko'rsatiladigan plan nomini qaytaradi.

    tariff_plan ustuni eskirgan bo'lishi mumkin, lekin tariff_type hamma joyda
    (rate limit, komissiya, obuna statusi) yagona manba hisoblanadi.
    """
    return _TARIFF_DISPLAY.get((tariff_type or "free").strip().lower(), "Free")
from app.schemas.admin import (
    AdminActionRequest,
    AdminStatsResponse,
    TransactionListResponse,
    UserListResponse,
)
from app.models import (
    AdminLoginLog,
    AdminUser,
    AllowedIP,
    AuditLog,
    BlockedAdminEmail,
    BlockedIP,
    PaymentMethod,
    Payout,
    PlatformWallet,
    Tariff,
    Transaction,
    TransactionStatus,
    TransactionType,
    User,
    UserRole,
)
from app.services.platform_wallet_service import (
    PlatformWalletConnectError,
    connect_platform_wallet_from_seed,
    disconnect_platform_wallet,
    get_platform_wallet_live_balances,
)
from app.services.ip_blocker import (
    get_client_ip,
    handle_unauthorized_admin_attempt,
    notify_admins_security_alert,
)

router = APIRouter(tags=["Admin API"])

logger = logging.getLogger(__name__)

# Rate limiter tracking in memory for admin login brute-force protection
# Limitlar .env'dagi ADMIN_LOGIN_MAX_ATTEMPTS / ADMIN_LOGIN_ATTEMPT_WINDOW_SECONDS dan keladi.
login_attempts_tracker: Dict[str, List[float]] = {}
ADMIN_LOGIN_MAX_ATTEMPTS = settings.ADMIN_LOGIN_MAX_ATTEMPTS
ADMIN_LOGIN_WINDOW_SECONDS = settings.ADMIN_LOGIN_ATTEMPT_WINDOW_SECONDS


# Helper for Audit Logging
async def log_admin_action(
    db: AsyncSession,
    admin: User,
    action_type: str,
    target_object: str,
    target_id: Any,
    previous_val: Any = None,
    new_val: Any = None,
    request: Optional[Request] = None,
):
    ip_addr = "127.0.0.1"
    if request:
        ip_addr = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "127.0.0.1"
        )
    ua = request.headers.get("user-agent", "Unknown") if request else "Unknown"

    audit_entry = AuditLog(
        admin_id=admin.id,
        admin_username=admin.username,
        action_type=action_type,
        target_object=target_object,
        target_id=str(target_id),
        previous_value=previous_val,
        new_value=new_val,
        ip_address=ip_addr,
        user_agent=ua,
    )
    db.add(audit_entry)
    await db.commit()


from google.oauth2 import id_token
from google.auth.transport import requests as google_requests


# Auth Schemas & Endpoints
class AdminGoogleLoginRequest(BaseModel):
    id_token: Optional[str] = None
    token: Optional[str] = None
    email: Optional[str] = None


@router.post("/auth/google")
async def admin_google_login(
    req: AdminGoogleLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "127.0.0.1")
    )
    ua = request.headers.get("user-agent", "Unknown")

    now_ts = datetime.now(timezone.utc).timestamp()
    attempts = login_attempts_tracker.get(client_ip, [])
    recent_attempts = [t for t in attempts if now_ts - t < ADMIN_LOGIN_WINDOW_SECONDS]
    login_attempts_tracker[client_ip] = recent_attempts

    if len(recent_attempts) >= ADMIN_LOGIN_MAX_ATTEMPTS:
        from app.services.ip_blocker import add_ip_to_blocklist
        await add_ip_to_blocklist(
            db,
            ip_address=client_ip,
            reason=f"Juda ko'p ({ADMIN_LOGIN_MAX_ATTEMPTS} tadan oshiq) muvaffaqiyatsiz login urinishlari (Brute-force)",
            triggered_by_email=req.email,
        )
        db.add(AdminLoginLog(username=req.email or "unknown", status="RATE_LIMITED_BLOCKED", ip_address=client_ip, user_agent=ua))
        await db.commit()
        logger.warning("Brute force attack suspected from IP: %s", client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Juda ko'p muvaffaqiyatsiz kirish urinishlari! IP manzilingiz vaqtincha/avtomatik ({ADMIN_LOGIN_WINDOW_SECONDS // 60} daqiqaga) bloklandi.",
        )

    raw_id_token = req.id_token or req.token
    if not raw_id_token:
        recent_attempts.append(now_ts)
        login_attempts_tracker[client_ip] = recent_attempts
        raise HTTPException(status_code=400, detail="Google id_token taqdim etilmadi")

    try:
        id_info = id_token.verify_oauth2_token(
            raw_id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except Exception as exc:
        recent_attempts.append(now_ts)
        login_attempts_tracker[client_ip] = recent_attempts
        if len(recent_attempts) >= ADMIN_LOGIN_MAX_ATTEMPTS:
            from app.services.ip_blocker import add_ip_to_blocklist
            await add_ip_to_blocklist(
                db,
                ip_address=client_ip,
                reason="Google token signatura xatolari (Brute-force token bot)",
            )
        logger.warning("Google id_token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Google token yaroqsiz yoki imzosi tasdiqlanmadi")

    email = id_info.get("email", "").lower().strip()
    email_verified = id_info.get("email_verified", False)

    if not email:
        raise HTTPException(status_code=400, detail="Google hisobingizdan email manzil olinmadi")

    if not email_verified:
        raise HTTPException(status_code=401, detail="Google email tasdiqlanmadi")

    # Admin panelidan qo'lda bloklangan emaillar — ular bilan kirish doim rad etiladi
    blocked_email_stmt = select(BlockedAdminEmail).where(
        func.lower(BlockedAdminEmail.email) == email
    )
    blocked_email_entry = (await db.execute(blocked_email_stmt)).scalar_one_or_none()
    if blocked_email_entry:
        db.add(AdminLoginLog(username=email, status="FORBIDDEN_EMAIL_BLOCKED", ip_address=client_ip, user_agent=ua))
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu email Admin Panel uchun bloklangan. Kirish taqiqlangan.",
        )

    # Check ALLOWED_ADMIN_EMAILS fail-safe whitelist (email-based automatic admin login)
    allowed_emails_set = settings.allowed_admin_emails_set

    if not allowed_emails_set:
        db.add(AdminLoginLog(username=email, status="FORBIDDEN_NO_ALLOWED_EMAILS", ip_address=client_ip, user_agent=ua))
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tizimda ALLOWED_ADMIN_EMAILS sozlangan emas. Kirish xavfsizlik yuzasidan bloklangan.",
        )

    if email not in allowed_emails_set:
        recent_attempts.append(now_ts)
        login_attempts_tracker[client_ip] = recent_attempts
        await handle_unauthorized_admin_attempt(
            db=db, email=email, ip=client_ip, request=request, reason="FORBIDDEN_NOT_WHITELISTED"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kirish rad etildi",
        )

    admin_user_stmt = select(AdminUser).where(func.lower(AdminUser.email) == email)
    admin_user_entry = (await db.execute(admin_user_stmt)).scalar_one_or_none()

    user_stmt = select(User).where(func.lower(User.email) == email)
    user = (await db.execute(user_stmt)).scalar_one_or_none()

    # Email-based automatic admin login:
    # ALLOWED_ADMIN_EMAILS ro'yxatidagi email -> avtomatik SUPERADMIN session/JWT.
    # Agar foydalanuvchi DB'da mavjud bo'lmasa, avtomatik yaratiladi.
    role = admin_user_entry.role if admin_user_entry else UserRole.SUPERADMIN

    if not admin_user_entry:
        admin_user_entry = AdminUser(
            email=email,
            username=email.split("@")[0],
            full_name=id_info.get("name") or email,
            role=role,
            is_active=True,
        )
        db.add(admin_user_entry)

    if not user:
        user = User(
            email=email,
            username=admin_user_entry.username,
            full_name=admin_user_entry.full_name or email,
            hashed_password=get_password_hash(uuid.uuid4().hex),
            role=role,
            is_active=True,
        )
        db.add(user)
    else:
        user.role = role
        user.is_active = True

    await db.commit()
    await db.refresh(user)
    await db.refresh(admin_user_entry)

    if not user.is_active or (admin_user_entry and not admin_user_entry.is_active):
        raise HTTPException(status_code=403, detail="Admin hisobi muzlatilgan")

    res_ip = await db.execute(select(AllowedIP))
    allowed_list = res_ip.scalars().all()
    if allowed_list:
        allowed_ips = {ip.ip_address for ip in allowed_list}
        allowed_ips.update(settings.localhost_ip_fallback)
        if client_ip not in allowed_ips:
            recent_attempts.append(now_ts)
            login_attempts_tracker[client_ip] = recent_attempts
            db.add(AdminLoginLog(username=email, status="FORBIDDEN_IP", ip_address=client_ip, user_agent=ua))
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sizning IP manzilingiz ({client_ip}) Admin Panel uchun ruxsat etilmagan (IP Whitelist Block)",
            )

    if client_ip in login_attempts_tracker:
        login_attempts_tracker[client_ip] = []

    user.last_login = datetime.now(timezone.utc)
    user.last_login_ip = client_ip
    if admin_user_entry:
        admin_user_entry.last_login = datetime.now(timezone.utc)
        admin_user_entry.last_login_ip = client_ip

    db.add(AdminLoginLog(username=user.username, status="SUCCESS_GOOGLE", ip_address=client_ip, user_agent=ua))
    await db.commit()

    access_token = create_access_token(
        data={"sub": user.username, "email": user.email, "role": user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(data={"sub": user.username, "email": user.email})

    response.set_cookie(
        key="admin_refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600,
    )

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role.value,
        "username": user.username,
        "email": user.email,
        "redirect": "/admin/dashboard",
    }


@router.post("/auth/refresh")
async def refresh_admin_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("admin_refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token topilmadi")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token yaroqsiz yoki muddati o'tgan")

    username = payload.get("sub")
    user_res = await db.execute(select(User).where(User.username == username))
    user = user_res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Admin topilmadi yoki faol emas")

    access_token = create_access_token(
        data={"sub": user.username, "email": user.email, "role": user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {"access_token": access_token, "token_type": "bearer"}


class AdminLoginRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None


@router.post("/auth/login")
async def admin_login(req: AdminLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "Unknown")
    now_ts = datetime.now(timezone.utc).timestamp()
    attempts = login_attempts_tracker.get(client_ip, [])
    recent_attempts = [t for t in attempts if now_ts - t < ADMIN_LOGIN_WINDOW_SECONDS]
    recent_attempts.append(now_ts)
    login_attempts_tracker[client_ip] = recent_attempts

    if len(recent_attempts) >= ADMIN_LOGIN_MAX_ATTEMPTS:
        from app.services.ip_blocker import add_ip_to_blocklist
        await add_ip_to_blocklist(
            db,
            ip_address=client_ip,
            reason="Parol tanlash boti (Password brute-force attempt)",
            triggered_by_email=req.username,
        )
        db.add(AdminLoginLog(username=req.username or "unknown", status="PASSWORD_BRUTE_FORCE_BLOCKED", ip_address=client_ip, user_agent=ua))
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p noto'g'ri urinishlar! IP manzilingiz avtomatik bloklandi.",
        )

    db.add(AdminLoginLog(username=req.username or "unknown", status="PASSWORD_LOGIN_REJECTED", ip_address=client_ip, user_agent=ua))
    await db.commit()
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Xavfsizlik yuzasidan Parol orqali kirish taqiqlangan! Admin panelga faqat Google OAuth ('Sign in with Google') orqali kiriladi.",
    )


class Admin2FAVerifyRequest(BaseModel):
    code: str
    secret: Optional[str] = None


@router.post("/auth/2fa/verify")
async def verify_admin_2fa(
    req: Admin2FAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin 2FA (TOTP) kodini tekshirish. 5 daqiqada 5 tadan oshiq noto'g'ri urinish bo'lsa IP avtomatik bloklanadi."""
    client_ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "Unknown")
    now_ts = datetime.now(timezone.utc).timestamp()
    attempts = login_attempts_tracker.get(client_ip, [])
    recent_attempts = [t for t in attempts if now_ts - t < ADMIN_LOGIN_WINDOW_SECONDS]
    login_attempts_tracker[client_ip] = recent_attempts

    if len(recent_attempts) >= ADMIN_LOGIN_MAX_ATTEMPTS:
        from app.services.ip_blocker import add_ip_to_blocklist
        await add_ip_to_blocklist(
            db,
            ip_address=client_ip,
            reason="5 muvaffaqiyatsiz 2FA/TOTP urinish (Brute-force)",
            triggered_by_email=current_admin.email,
        )
        db.add(AdminLoginLog(username=current_admin.username, status="2FA_BRUTE_FORCE_BLOCKED", ip_address=client_ip, user_agent=ua))
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Juda ko'p muvaffaqiyatsiz 2FA urinishlari! IP manzilingiz avtomatik bloklandi.",
        )

    from app.utils.totp import verify_totp
    secret = req.secret or current_admin.two_factor_secret
    if not secret or not verify_totp(secret, req.code):
        recent_attempts.append(now_ts)
        login_attempts_tracker[client_ip] = recent_attempts
        if len(recent_attempts) >= ADMIN_LOGIN_MAX_ATTEMPTS:
            from app.services.ip_blocker import add_ip_to_blocklist
            await add_ip_to_blocklist(
                db,
                ip_address=client_ip,
                reason="5 muvaffaqiyatsiz 2FA/TOTP urinish (Brute-force)",
                triggered_by_email=current_admin.email,
            )
        db.add(AdminLoginLog(username=current_admin.username, status="2FA_FAILED", ip_address=client_ip, user_agent=ua))
        await db.commit()
        raise HTTPException(status_code=400, detail="Noto'g'ri yoki muddati o'tgan 2FA/TOTP kodi")

    db.add(AdminLoginLog(username=current_admin.username, status="2FA_SUCCESS", ip_address=client_ip, user_agent=ua))
    await db.commit()
    return {"success": True, "message": "2FA/TOTP kodi muvaffaqiyatli tasdiqlandi"}



@router.get("/auth/ip-check")
async def admin_ip_check(request: Request):
    """Frontend IP Whitelist Guard uchun: joriy IP ALLOWED_ADMIN_IPS'da bormi?

    Bu endpoint IPWhitelistMiddleware'dan exempt qilingan, chunki frontend
    shu orqali ruxsatni tekshiradi va ruxsat bo'lmasa asosiy hostga (`/`)
    silent-redirect qiladi.
    """
    client_ip = get_client_ip(request).lower()
    allowed_ips = settings.allowed_admin_ips_set
    allowed = client_ip in allowed_ips
    return {
        "allowed": allowed,
        "ip": client_ip,
        "whitelist": sorted(allowed_ips),
    }


@router.get("/auth/me")
async def get_admin_me(current_admin: User = Depends(get_current_admin)):
    return {
        "id": current_admin.id,
        "username": current_admin.username,
        "email": current_admin.email,
        "full_name": current_admin.full_name,
        "role": current_admin.role.value,
        "last_login": current_admin.last_login.isoformat() if current_admin.last_login else None,
        "last_login_ip": current_admin.last_login_ip,
    }


# Dashboard Stats
@router.get("/overview/stats")
async def get_overview_stats(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users_res = await db.execute(select(func.count(User.id)))
    total_users = total_users_res.scalar() or 0

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    recent_users_res = await db.execute(select(func.count(User.id)).where(User.created_at >= week_ago))
    recent_users = recent_users_res.scalar() or 0

    wallets_res = await db.execute(select(func.count(User.id)).where(User.wallet_address.isnot(None)))
    connected_wallets = wallets_res.scalar() or 0

    tx_count_res = await db.execute(select(func.count(Transaction.id)))
    total_transactions = tx_count_res.scalar() or 0

    commission_gram_res = await db.execute(
        select(func.sum(Transaction.commission_amount)).where(Transaction.currency == "TON")
    )
    commission_gram = commission_gram_res.scalar() or 0.0

    commission_usdt_res = await db.execute(
        select(func.sum(Transaction.commission_amount)).where(Transaction.currency == "USDT")
    )
    commission_usdt = commission_usdt_res.scalar() or 0.0

    subscribers_res = await db.execute(
        select(func.count(User.id)).where(User.tariff_type.in_(["lite", "pro"]))
    )
    active_subscribers = subscribers_res.scalar() or 0

    return {
        "total_users": total_users,
        "weekly_user_growth": recent_users,
        "connected_wallets": connected_wallets,
        "total_transactions": total_transactions,
        "commission_revenue_ton": round(commission_gram, 4),
        "commission_revenue_usdt": round(commission_usdt, 4),
        "active_subscribers": active_subscribers,
    }


# ====== Dashboard Aggregate Stats (/stats) ======
@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    request: Request,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Yangi admin dashboard uchun yagona agregat statistika endpointi."""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    # 1. Foydalanuvchilar
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    new_users_this_week = (
        await db.execute(select(func.count(User.id)).where(User.created_at >= week_ago))
    ).scalar() or 0

    # 2. Hamyonlar
    connected_wallets = (
        await db.execute(select(func.count(User.id)).where(User.wallet_address.isnot(None)))
    ).scalar() or 0

    # 3. Tranzaksiyalar
    total_transactions = (await db.execute(select(func.count(Transaction.id)))).scalar() or 0
    transactions_this_week = (
        await db.execute(select(func.count(Transaction.id)).where(Transaction.created_at >= week_ago))
    ).scalar() or 0

    # 4. Komissiya daromadi (barcha statuslar)
    commission_gram = (
        await db.execute(select(func.sum(Transaction.commission_amount)).where(Transaction.currency == "TON"))
    ).scalar() or 0.0
    commission_usdt = (
        await db.execute(select(func.sum(Transaction.commission_amount)).where(Transaction.currency == "USDT"))
    ).scalar() or 0.0

    # 5. Faol obunalar
    active_subscribers = (
        await db.execute(select(func.count(User.id)).where(User.tariff_type.in_(["lite", "pro"])))
    ).scalar() or 0

    # 6. Tarif taqsimoti (foizlar bilan)
    tariff_rows = await db.execute(
        select(User.tariff_type, func.count().label("count")).group_by(User.tariff_type)
    )
    tariff_map = {row[0] or "free": row[1] for row in tariff_rows.all()}
    tariff_order = ["free", "lite", "pro"]
    tariff_total = sum(tariff_map.values()) or 1
    tariff_distribution = []
    for key in tariff_order:
        value = tariff_map.get(key, 0)
        if value > 0 or len(tariff_map) == 0:
            tariff_distribution.append({
                "name": _TARIFF_DISPLAY.get(key, "Free"),
                "value": value,
                "percent": round(value / tariff_total * 100, 1),
            })

    # 7. Grafik ma'lumotlari (oxirgi 7 kun)
    chart_data = []
    for i in range(6, -1, -1):
        date = (now - timedelta(days=i)).date()
        day_start = datetime.combine(date, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(date, datetime.max.time()).replace(tzinfo=timezone.utc)

        ton_res = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.created_at >= day_start,
                Transaction.created_at <= day_end,
                Transaction.currency == "TON",
                Transaction.status == TransactionStatus.COMPLETED,
            )
        )
        ton_rev = ton_res.scalar() or 0.0

        usdt_res = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.created_at >= day_start,
                Transaction.created_at <= day_end,
                Transaction.currency == "USDT",
                Transaction.status == TransactionStatus.COMPLETED,
            )
        )
        usdt_rev = usdt_res.scalar() or 0.0

        chart_data.append({
            "date": date.strftime("%d.%m"),
            "ton": round(ton_rev, 2),
            "usdt": round(usdt_rev, 2),
        })

    # 8. So'nggi faoliyatlar
    recent_tx = await db.execute(
        select(Transaction).order_by(Transaction.id.desc()).limit(10)
    )
    activities = []
    for tx in recent_tx.scalars().all():
        u = await db.get(User, tx.user_id)
        username = u.username if u else f"user#{tx.user_id}"
        amount_str = f"{tx.amount} {tx.currency}" if tx.amount else tx.transaction_type.value
        activities.append({
            "type": "transaction",
            "message": f"{username}: {tx.transaction_type.value} - {amount_str}",
            "time": tx.created_at.strftime("%H:%M") if tx.created_at else "",
            "status": tx.status.value,
        })

    if new_users_this_week:
        activities.insert(0, {
            "type": "user",
            "message": f"{new_users_this_week} ta yangi foydalanuvchi ro'yxatdan o'tdi",
            "time": now.strftime("%H:%M"),
            "status": "success",
        })

    return AdminStatsResponse(
        total_users=total_users,
        new_users_this_week=new_users_this_week,
        user_growth=round((new_users_this_week / total_users * 100), 1) if total_users > 0 else 0.0,
        connected_wallets=connected_wallets,
        total_transactions=total_transactions,
        transactions_this_week=transactions_this_week,
        transaction_growth=round((transactions_this_week / total_transactions * 100), 1) if total_transactions > 0 else 0.0,
        total_commission=round(commission_gram, 4),
        total_commission_usdt=round(commission_usdt, 4),
        active_subscribers=active_subscribers,
        tariff_distribution=tariff_distribution,
        chart_data=chart_data,
        recent_activities=activities,
    )


# Users Management
@router.get("/users")
async def get_users_list(
    page: int = 1,
    limit: int = 20,
    q: Optional[str] = None,
    role: Optional[str] = None,
    tariff: Optional[str] = None,
    wallet_status: Optional[str] = None,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User)
    if q:
        search_pattern = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.username).like(search_pattern),
                func.lower(User.email).like(search_pattern),
                func.lower(User.wallet_address).like(search_pattern),
            )
        )
    if role:
        stmt = stmt.where(User.role == role)
    if tariff:
        stmt = stmt.where(User.tariff_type == tariff.strip().lower())
    if wallet_status == "connected":
        stmt = stmt.where(User.wallet_address.isnot(None))
    elif wallet_status == "not_connected":
        stmt = stmt.where(User.wallet_address.is_(None))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * limit
    stmt = stmt.order_by(User.id.desc()).offset(offset).limit(limit)
    res = await db.execute(stmt)
    users = res.scalars().all()

    items = []
    for u in users:
        items.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role.value,
            "tariff_plan": _canonical_plan(u.tariff_type),
            "is_active": u.is_active,
            "wallet_address": u.wallet_address,
            "balance_gram": u.balance_gram,
            "balance_usdt": u.balance_usdt,
            "total_spent_gram": u.total_spent_gram,
            "total_spent_usdt": u.total_spent_usdt,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit,
    }


class UserTariffUpdateRequest(BaseModel):
    tariff_plan: str = Field(..., description="Free, Lite yoki Pro")
    reason: str = Field(..., min_length=5, description="O'zgartirish sababi (audit log uchun)")


class BlockUserRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Bloklash sababi (audit log uchun)")


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Foydalanuvchi haqida to'liq ma'lumot + tranzaksiyalar tarixi."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    tx_res = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.id.desc())
        .limit(50)
    )
    transactions = []
    for t in tx_res.scalars().all():
        transactions.append({
            "id": t.id,
            "type": t.transaction_type.value,
            "target": t.target_username,
            "amount": t.amount,
            "currency": t.currency,
            "status": t.status.value,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "tariff_plan": _canonical_plan(user.tariff_type),
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "wallet_address": user.wallet_address,
        "balance_gram": user.balance_gram,
        "balance_usdt": user.balance_usdt,
        "total_spent_gram": user.total_spent_gram,
        "total_spent_usdt": user.total_spent_usdt,
        "total_stars_purchased": user.total_stars_purchased,
        "total_premium_purchased": user.total_premium_purchased,
        "two_factor_enabled": user.two_factor_enabled,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "last_login_ip": user.last_login_ip,
        "transactions": transactions,
    }


@router.put("/users/{user_id}/tariff")
async def update_user_tariff(
    user_id: int,
    req: UserTariffUpdateRequest,
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Foydalanuvchi tarif rejasini va barcha unga bog'liq parametrlarni atomar o'zgartirish."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    new_plan = req.tariff_plan.strip()
    valid_plans = {"Free", "Lite", "Pro"}
    if new_plan not in valid_plans:
        raise HTTPException(status_code=400, detail="Noto'g'ri tarif plan. Faqat: Free, Lite, Pro")

    old_plan = user.tariff_plan or "Free"
    slug = new_plan.lower()

    # DB'dan mos Tariff obyekti topiladi
    stmt = select(Tariff).where(func.lower(Tariff.name) == slug)
    tariff_res = await db.execute(stmt)
    tariff_obj = tariff_res.scalar_one_or_none()

    # Atomar o'zgartirishlar: tariff_plan, tariff_type, tariff_id, commission_rate, tariff_expires_at
    user.tariff_plan = new_plan
    user.tariff_type = slug
    if tariff_obj:
        user.tariff_id = tariff_obj.id
        user.commission_rate = round((tariff_obj.commission_percent or 0.0) / 100.0, 4)
    else:
        # Default fallback komissiya foizlari (Pro=0.5%, Lite=2.5%, Free=5%)
        commissions = {"pro": 0.005, "lite": 0.025, "free": 0.05}
        user.tariff_id = None
        user.commission_rate = commissions.get(slug, 0.05)

    now_utc = datetime.now(timezone.utc)
    user.tariff_expires_at = now_utc + timedelta(days=30)
    user.is_verified = True

    await db.commit()

    # In-memory RPM Rate Limit cache tozalash
    try:
        from app.middleware import clear_rpm_cache
        clear_rpm_cache()
    except ImportError:
        pass

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="USER_TARIFF_UPDATE",
        target_object="USER",
        target_id=user_id,
        previous_val={"tariff_plan": old_plan},
        new_val={"tariff_plan": new_plan, "tariff_type": slug, "reason": req.reason},
        request=request,
    )

    return {
        "success": True,
        "message": f"@{user.username} foydalanuvchining tarifi {old_plan} dan {new_plan} ga to'liq o'zgartirildi (Limit va Komissiyalar yangilandi)",
    }



@router.post("/users/{user_id}/toggle-block")
async def toggle_user_block(
    user_id: int,
    req: BlockUserRequest,
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Foydalanuvchini bloklash / blokdan chiqarish (audit log bilan)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    if current_admin.id == user.id:
        raise HTTPException(status_code=400, detail="O'zingizni bloklay olmaysiz")

    old_active = user.is_active
    user.is_active = not user.is_active
    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="USER_BLOCK" if not user.is_active else "USER_UNBLOCK",
        target_object="USER",
        target_id=user_id,
        previous_val={"is_active": old_active},
        new_val={"is_active": user.is_active, "reason": req.reason},
        request=request,
    )

    return {
        "success": True,
        "message": f"@{user.username} {'bloklandi' if not user.is_active else 'blokdan chiqarildi'}",
        "is_active": user.is_active,
    }


# Transactions
@router.get("/transactions")
async def get_admin_transactions(
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    type_filter: Optional[str] = None,
    currency_filter: Optional[str] = None,
    q: Optional[str] = None,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Transaction, User.username).join(User, Transaction.user_id == User.id)

    if status_filter:
        stmt = stmt.where(Transaction.status == status_filter)
    if type_filter:
        stmt = stmt.where(Transaction.transaction_type == type_filter)
    if currency_filter:
        stmt = stmt.where(Transaction.currency == currency_filter)
    if q:
        raw_q = q.strip().lower()
        clean_q = re.sub(r'^(tx_|#)', '', raw_q)
        search_pat = f"%{raw_q}%"

        conditions = [
            func.lower(User.username).like(search_pat),
            func.lower(Transaction.target_username).like(search_pat),
            func.lower(Transaction.fragment_tx_id).like(search_pat),
        ]
        if clean_q.isdigit():
            conditions.append(Transaction.id == int(clean_q))

        stmt = stmt.where(or_(*conditions))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * limit
    stmt = stmt.order_by(Transaction.id.desc()).offset(offset).limit(limit)
    res = await db.execute(stmt)
    rows = res.all()

    items = []
    for tx, username in rows:
        items.append({
            "id": tx.id,
            "user_id": tx.user_id,
            "username": username,
            "transaction_type": tx.transaction_type.value,
            "status": tx.status.value,
            "amount": tx.amount,
            "commission_amount": tx.commission_amount,
            "currency": tx.currency,
            "target_username": tx.target_username,
            "fragment_tx_id": tx.fragment_tx_id,
            "is_flagged": tx.is_flagged,
            "refund_reason": tx.refund_reason,
            "error_message": tx.error_message,
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit,
    }


class TransactionRefundRequest(BaseModel):
    reason: Optional[str] = "Manual admin refund"


@router.post("/transactions/{transaction_id}/refund")
async def refund_transaction(
    transaction_id: int,
    req: TransactionRefundRequest,
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Transaction).where(Transaction.id == transaction_id)
    tx = (await db.execute(stmt)).scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Tranzaksiya topilmadi")

    if tx.status == TransactionStatus.REFUNDED:
        raise HTTPException(status_code=400, detail="Tranzaksiya allaqachon qaytarilgan")

    old_status = tx.status.value
    tx.status = TransactionStatus.REFUNDED
    tx.refund_reason = req.reason or "Admin refund"

    user_stmt = select(User).where(User.id == tx.user_id)
    user = (await db.execute(user_stmt)).scalar_one_or_none()
    if user and old_status == "completed":
        if (tx.currency or "GRAM").upper() == "USDT":
            user.balance_usdt += tx.amount
        else:
            user.balance_gram += tx.amount

    await log_admin_action(
        db,
        current_admin,
        "transaction_refund",
        "transaction",
        tx.id,
        previous_val={"status": old_status},
        new_val={"status": "refunded", "reason": tx.refund_reason},
        request=request,
    )
    await db.commit()
    return {"success": True, "message": f"Tranzaksiya #{tx.id} mablag'i qaytarildi (Refund)"}


# Commission Settings

@router.get("/tariffs")
@router.get("/settings/commission")
async def get_admin_tariffs(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tariff).order_by(Tariff.id.asc())
    res = await db.execute(stmt)
    tariffs = res.scalars().all()

    if not tariffs:
        default_tariffs = [
            Tariff(name="Free", description="Boshlang'ich bepul tarif", price_gram=0.0, price_usdt=0.0, commission_percent=5.0, rate_limit_per_min=60),
            Tariff(name="Lite", description="O'rta hajm resurslar", price_gram=10.0, price_usdt=25.0, commission_percent=2.5, rate_limit_per_min=120),
            Tariff(name="Pro", description="Maksimallashtirilgan API limitlar", price_gram=30.0, price_usdt=75.0, commission_percent=0.5, rate_limit_per_min=300),
        ]
        for t in default_tariffs:
            db.add(t)
        await db.commit()
        tariffs = default_tariffs

    def _features_list(t):
        raw = getattr(t, "features", None)
        if not raw:
            return []
        if isinstance(raw, str):
            return [f.strip() for f in raw.split("\n") if f.strip()]
        if isinstance(raw, list):
            return [str(f).strip() for f in raw if str(f).strip()]
        return []

    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "price_gram": t.price_gram,
            "price_usdt": t.price_usdt,
            "commission_percent": t.commission_percent,
            "rate_limit_per_min": t.rate_limit_per_min,
            "duration_days": getattr(t, "duration_days", None) or 30,
            "features": _features_list(t),
            "badge": getattr(t, "badge", None) or "",
            "is_active": t.is_active,
            "is_archived": t.is_archived,
        }
        for t in tariffs
    ]


class UpdateCommissionRequest(BaseModel):
    tariff_name: str = Field(..., description="Free, Lite yoki Pro")
    commission_percent: float = Field(..., ge=0, le=100, description="Yangi komissiya foizi")


@router.put("/settings/commission")
async def update_commission_setting(
    req: UpdateCommissionRequest,
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tariff).where(func.lower(Tariff.name) == req.tariff_name.strip().lower())
    res = await db.execute(stmt)
    tariff = res.scalar_one_or_none()

    if not tariff:
        raise HTTPException(status_code=404, detail=f"Tarif topilmadi: {req.tariff_name}")

    old_percent = tariff.commission_percent
    tariff.commission_percent = req.commission_percent
    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="COMMISSION_UPDATE",
        target_object="TARIFF_COMMISSION",
        target_id=tariff.id,
        previous_val={"tariff": tariff.name, "commission_percent": old_percent},
        new_val={"tariff": tariff.name, "commission_percent": req.commission_percent},
        request=request,
    )

    return {
        "success": True,
        "tariff_name": tariff.name,
        "old_commission": old_percent,
        "new_commission": req.commission_percent,
        "message": f"{tariff.name} tarifi komissiyasi {old_percent}% dan {req.commission_percent}% ga muvaffaqiyatli o'zgartirildi",
    }


class UpdateTariffRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, description="Tarif nomi (masalan: Lite)")
    price_gram: Optional[float] = Field(None, ge=0)
    price_usdt: Optional[float] = Field(None, ge=0)
    commission_percent: Optional[float] = Field(None, ge=0, le=100)
    rate_limit_per_min: Optional[int] = Field(None, gt=0)
    description: Optional[str] = None
    duration_days: Optional[int] = Field(None, gt=0, description="Obuna muddati (kun)")
    features: Optional[list] = Field(None, description="Xususiyatlar ro'yxati (yangi qator bilan saqlanadi)")
    badge: Optional[str] = Field(None, description="Badge: standart / tezkor / vip")
    is_active: Optional[bool] = Field(None, description="Tarif faol (ko'rinadi) yoki nofaol")
    is_archived: Optional[bool] = Field(None, description="Tarif arxivlangan (ko'rinmaydi) yoki arxivdan chiqarilgan")


@router.put("/tariffs/{tariff_id}")
async def update_tariff(
    tariff_id: int,
    req: UpdateTariffRequest,
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    t = await db.get(Tariff, tariff_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarif topilmadi")

    if req.name is not None and req.name.strip():
        name = req.name.strip()
        dup = (
            await db.execute(
                select(Tariff).where(
                    func.lower(Tariff.name) == name.lower(),
                    Tariff.id != tariff_id,
                )
            )
        ).scalar_one_or_none()
        if dup:
            raise HTTPException(status_code=400, detail=f"'{name}' nomli tarif allaqachon mavjud")
        t.name = name

    prev_val = {
        "name": t.name,
        "price_gram": t.price_gram,
        "price_usdt": t.price_usdt,
        "commission_percent": t.commission_percent,
        "rate_limit_per_min": t.rate_limit_per_min,
        "duration_days": getattr(t, "duration_days", None),
        "badge": getattr(t, "badge", None),
        "is_active": t.is_active,
        "is_archived": t.is_archived,
    }

    if req.price_gram is not None:
        t.price_gram = req.price_gram
    if req.price_usdt is not None:
        t.price_usdt = req.price_usdt
    if req.commission_percent is not None:
        t.commission_percent = req.commission_percent
    if req.rate_limit_per_min is not None:
        t.rate_limit_per_min = req.rate_limit_per_min
    if req.description is not None:
        t.description = req.description
    if req.duration_days is not None:
        t.duration_days = req.duration_days
    if req.features is not None:
        t.features = "\n".join(str(f).strip() for f in req.features if str(f).strip())
    if req.badge is not None:
        t.badge = req.badge.strip() or None
    if req.is_active is not None:
        t.is_active = req.is_active
    if req.is_archived is not None:
        t.is_archived = req.is_archived
    # Faollashtirilgan tarif avtomatik arxivdan chiqariladi — arxivlangan tarif
    # public katalogda ko'rinmaydi, shuning uchun "faol" va "arxivlangan" birga bo'lmaydi.
    if t.is_active:
        t.is_archived = False

    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="TARIFF_UPDATE",
        target_object="TARIFF",
        target_id=tariff_id,
        previous_val=prev_val,
        new_val={
            "name": t.name,
            "price_gram": t.price_gram,
            "price_usdt": t.price_usdt,
            "commission_percent": t.commission_percent,
            "rate_limit_per_min": t.rate_limit_per_min,
            "duration_days": getattr(t, "duration_days", None),
            "badge": getattr(t, "badge", None),
            "is_active": t.is_active,
            "is_archived": t.is_archived,
        },
        request=request,
    )

    return {
        "success": True,
        "id": t.id,
        "name": t.name,
        "price_gram": t.price_gram,
        "price_usdt": t.price_usdt,
        "commission_percent": t.commission_percent,
        "rate_limit_per_min": t.rate_limit_per_min,
        "duration_days": getattr(t, "duration_days", None) or 30,
        "badge": getattr(t, "badge", None) or "",
        "is_active": t.is_active,
        "is_archived": t.is_archived,
        "message": f"{t.name} tarifi muvaffaqiyatli yangilandi",
    }


class CreateTariffRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Tarif nomi (masalan: Lite)")
    description: Optional[str] = None
    price_gram: float = Field(0.0, ge=0, description="Narx (GRAM)")
    price_usdt: float = Field(0.0, ge=0, description="Narx (USDT)")
    commission_percent: float = Field(5.0, ge=0, le=100, description="Komissiya foizi")
    rate_limit_per_min: int = Field(60, gt=0, description="Daqiqalik so'rovlar limiti")
    duration_days: Optional[int] = Field(30, gt=0, description="Obuna muddati (kun)")
    features: Optional[list] = Field(None, description="Xususiyatlar ro'yxati (yangi qator bilan saqlanadi)")
    badge: Optional[str] = Field(None, description="Badge: standart / tezkor / vip")


@router.post("/tariffs")
async def create_tariff(
    req: CreateTariffRequest,
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Yangi tarif yaratadi (PostgreSQL'ga saqlanadi).

    Yaratilgan tarif `GET /api/v1/tariffs` (public) orqali frontend'da
    darhol ko'rinadi — admin o'zgarishlari bilan dinamik sinxronizatsiya.
    """
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tarif nomi bo'sh bo'lishi mumkin emas")

    existing = (
        await db.execute(
            select(Tariff).where(func.lower(Tariff.name) == name.lower())
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"'{name}' nomli tarif allaqachon mavjud")

    tariff = Tariff(
        name=name,
        description=req.description,
        price_gram=req.price_gram,
        price_usdt=req.price_usdt,
        commission_percent=req.commission_percent,
        rate_limit_per_min=req.rate_limit_per_min,
        duration_days=req.duration_days or 30,
        features="\n".join(str(f).strip() for f in (req.features or []) if str(f).strip()) or None,
        badge=(req.badge or "").strip() or None,
        is_active=True,
        is_archived=False,
    )
    db.add(tariff)
    await db.commit()
    await db.refresh(tariff)

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="TARIFF_CREATE",
        target_object="TARIFF",
        target_id=tariff.id,
        previous_val={},
        new_val={
            "name": tariff.name,
            "price_gram": tariff.price_gram,
            "price_usdt": tariff.price_usdt,
            "commission_percent": tariff.commission_percent,
            "rate_limit_per_min": tariff.rate_limit_per_min,
            "duration_days": tariff.duration_days,
            "badge": tariff.badge,
        },
        request=request,
    )

    return {
        "success": True,
        "id": tariff.id,
        "name": tariff.name,
        "description": tariff.description,
        "price_gram": tariff.price_gram,
        "price_usdt": tariff.price_usdt,
        "commission_percent": tariff.commission_percent,
        "rate_limit_per_min": tariff.rate_limit_per_min,
        "duration_days": tariff.duration_days or 30,
        "features": [f.strip() for f in (tariff.features or "").split("\n") if f.strip()],
        "badge": tariff.badge or "",
        "is_active": tariff.is_active,
        "is_archived": tariff.is_archived,
    }


@router.delete("/tariffs/{tariff_id}")
async def delete_tariff(
    tariff_id: int,
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Tarifni o'chiradi (soft-delete: is_archived=True).

    Arxivlangan tarif public katalogda ko'rinmaydi, tarix saqlanadi.
    """
    t = await db.get(Tariff, tariff_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarif topilmadi")

    if t.is_archived:
        return {"success": True, "message": f"{t.name} tarifi allaqachon arxivlangan"}

    prev_val = {
        "name": t.name,
        "is_active": t.is_active,
        "is_archived": t.is_archived,
    }
    t.is_active = False
    t.is_archived = True
    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="TARIFF_DELETE",
        target_object="TARIFF",
        target_id=tariff_id,
        previous_val=prev_val,
        new_val={"is_active": False, "is_archived": True},
        request=request,
    )

    return {"success": True, "message": f"{t.name} tarifi o'chirildi (arxivlandi)"}


# ======================================================================
# Platforma Hamyoni — FAQAT 24 so'zli Seed-Phrase (Mnemonic) orqali ulash
# ======================================================================
# Eski qo'lda yoziladigan (statik) `admin_ton_address` / `wallet_address`
# logikasi TO'LIQ OLIB TASHLANDI. Manzil faqat seed-phrase'dan derivatsiya
# qilinadi, USDT (Jetton) manzili va real on-chain balanslar avtomatik
# hisoblanadi (TonAPI).
@router.get("/platform-wallet")
@router.get("/settings/wallet")
async def get_platform_wallet_info(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Ulangan platforma hamyoni haqida ma'lumot (seed orqali ulangan bo'lsa).

    Agar `seed_connected` bo'lmasa — disconnect holati qaytariladi va bazadagi
    eski statik/qo'lda kiritilgan manzil tozalanadi (None qilinadi).
    """
    stmt = select(PlatformWallet).limit(1)
    res = await db.execute(stmt)
    p_wallet = res.scalar_one_or_none()

    if not p_wallet or not p_wallet.seed_connected:
        # Eski statik manzilni bazadan tozalash (qo'lda kiritilgan manzil logikasi o'chirilgan).
        if p_wallet is not None:
            has_stale = bool(
                p_wallet.wallet_address
                or p_wallet.usdt_wallet_address
                or p_wallet.pending_wallet_address
            )
            if has_stale:
                p_wallet.wallet_address = None
                p_wallet.usdt_wallet_address = None
                p_wallet.pending_wallet_address = None
                p_wallet.wallet_change_token = None
                p_wallet.wallet_change_expires_at = None
                p_wallet.balance_gram = 0.0
                p_wallet.balance_usdt = 0.0
                await db.commit()

        return {
            "id": p_wallet.id if p_wallet else None,
            "is_connected": False,
            "wallet_type": None,
            "wallet_address": None,
            "ton_address": None,
            "usdt_wallet_address": None,
            "usdt_address": None,
            "ton_balance": 0.0,
            "usdt_balance": 0.0,
            "balance_gram": 0.0,
            "balance_usdt": 0.0,
            "balance_source": "none",
            "stored_balance_gram": 0.0,
            "stored_balance_usdt": 0.0,
            "total_commission_gram": (p_wallet.total_commission_gram if p_wallet else 0.0) or 0.0,
            "total_commission_usdt": (p_wallet.total_commission_usdt if p_wallet else 0.0) or 0.0,
            "pending_wallet_address": None,
            "has_pending_change": False,
            "seed_connected": False,
            "wallet_seed_connected": False,
            "wallet_seed_hint": None,
            "updated_at": None,
        }

    # REAL on-chain balanslar (TonAPI): TON hamyoni + USDT Jetton hamyoni
    live = await get_platform_wallet_live_balances(db)

    return {
        "id": p_wallet.id,
        "is_connected": True,
        "wallet_type": p_wallet.wallet_type or "v4R2",
        "wallet_address": p_wallet.wallet_address,
        "ton_address": p_wallet.wallet_address,
        "usdt_wallet_address": p_wallet.usdt_wallet_address,
        "usdt_address": p_wallet.usdt_wallet_address,
        "ton_balance": live["real_balance_gram"],
        "usdt_balance": live["real_balance_usdt"],
        "balance_gram": live["real_balance_gram"],
        "balance_usdt": live["real_balance_usdt"],
        "balance_source": live["balance_source"],
        "stored_balance_gram": p_wallet.balance_gram,
        "stored_balance_usdt": p_wallet.balance_usdt,
        "total_commission_gram": p_wallet.total_commission_gram or 0.0,
        "total_commission_usdt": p_wallet.total_commission_usdt or 0.0,
        "pending_wallet_address": None,
        "has_pending_change": False,
        "seed_connected": True,
        "wallet_seed_connected": True,
        "wallet_seed_hint": (
            (p_wallet.wallet_seed_encrypted or "")[:24] + "…"
            if p_wallet.wallet_seed_encrypted
            else None
        ),
        "updated_at": p_wallet.updated_at.isoformat() if p_wallet.updated_at else None,
    }


# ======================================================================
# Qo'lda manzil kiritish / email-token tasdiqlash flow'i O'CHIRILDI.
# Platforma hamyoni endi FAQAT 24 so'zli seed-phrase (mnemonic) orqali
# ulanadi: `POST /api/admin/platform-wallet/connect`.
# ======================================================================
@router.put("/settings/wallet")
@router.post("/settings/wallet")
@router.post("/platform-wallet")
async def deprecated_manual_wallet_update(
    request: Request,
    current_admin: User = Depends(get_current_admin),
):
    raise HTTPException(
        status_code=410,
        detail="Qo'lda manzil kiritish bekor qilindi! Platforma hamyoni faqat 24 so'zli seed-phrase (mnemonic) orqali ulanadi: POST /api/admin/platform-wallet/connect",
    )


@router.post("/settings/wallet/confirm")
async def deprecated_wallet_confirm(
    request: Request,
    current_admin: User = Depends(get_current_admin),
):
    raise HTTPException(
        status_code=410,
        detail="Eski email-token tasdiqlash flow'i o'chirilgan. Hamyon faqat 24 so'zli seed-phrase orqali ulanadi.",
    )


class ConnectSeedRequest(BaseModel):
    seed_phrase: str = Field(..., min_length=8, description="24 so'zli BIP39 seed-phrase (mnemonic)")
    wallet_type: str = Field("v4R2", description="Hamyon turi: v4R2, v5R1, v3R2")


@router.post("/platform-wallet/connect-seed")
@router.post("/platform-wallet/connect")
async def connect_platform_wallet_seed(
    req: ConnectSeedRequest,
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Platforma hamyonini 24 so'zli seed-phrase orqali ulash.

    Seed-phrase tekshiriladi, TON + USDT (Jetton) manzillari hisoblanadi va
    Fernet (AES) bilan shifrlanib saqlanadi. 2FA talab qilinmaydi.
    """
    try:
        result = await connect_platform_wallet_from_seed(
            db=db,
            seed_phrase=req.seed_phrase,
            wallet_type=req.wallet_type,
        )
    except PlatformWalletConnectError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Seed-phrase orqali hamyon ulashda xatolik")
        raise HTTPException(status_code=500, detail=f"Platforma hamyonini ulashda xatolik: {exc}")

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="PLATFORM_WALLET_SEED_CONNECTED",
        target_object="PLATFORM_WALLET",
        target_id=None,
        previous_val=None,
        new_val={
            "wallet_address": result["wallet_address"],
            "usdt_wallet_address": result["usdt_wallet_address"],
            "wallet_type": result["wallet_type"],
        },
        request=request,
    )

    return {"success": True, "message": "Platforma hamyoni seed-phrase orqali muvaffaqiyatli ulandi", **result}


@router.post("/platform-wallet/disconnect-seed")
async def disconnect_platform_wallet_seed(
    request: Request,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Platforma hamyonining seed-phrase bog'lanishini bekor qiladi (shifrni o'chiradi)."""
    try:
        result = await disconnect_platform_wallet(db)
    except PlatformWalletConnectError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Seed-phrase bog'lanishni bekor qilishda xatolik")
        raise HTTPException(status_code=500, detail=f"Seed-phrase bog'lanishni bekor qilishda xatolik: {exc}")

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="PLATFORM_WALLET_SEED_DISCONNECTED",
        target_object="PLATFORM_WALLET",
        target_id=None,
        previous_val={"seed_connected": True},
        new_val={"seed_connected": False},
        request=request,
    )

    return {"success": True, "message": result["message"]}


class WithdrawRequest(BaseModel):
    destination_address: str = Field(..., min_length=40)
    amount: float = Field(..., gt=0)
    currency: str = Field("TON")


@router.post("/platform-wallet/withdraw")
async def withdraw_platform_funds(
    req: WithdrawRequest,
    request: Request,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PlatformWallet).limit(1)
    res = await db.execute(stmt)
    p_wallet = res.scalar_one_or_none()

    if not p_wallet or not p_wallet.seed_connected:
        raise HTTPException(status_code=400, detail="Platforma hamyoni seed-phrase orqali ulanmagan")

    # Tekshiruv REAL on-chain balanslarga qarshi o'tkaziladi.
    live = await get_platform_wallet_live_balances(db)

    if req.currency == "TON":
        if live["real_balance_gram"] < req.amount:
            raise HTTPException(status_code=400, detail="Platforma hamyonida yetarli TON mablag' yo'q")
        p_wallet.balance_gram = round(max((p_wallet.balance_gram or 0.0) - req.amount, 0.0), 6)
    else:
        if live["real_balance_usdt"] < req.amount:
            raise HTTPException(status_code=400, detail="Platforma hamyonida yetarli USDT mablag' yo'q")
        p_wallet.balance_usdt = round(max((p_wallet.balance_usdt or 0.0) - req.amount, 0.0), 6)

    payout = Payout(
        amount=req.amount,
        currency=req.currency,
        destination_address=req.destination_address,
        admin_username=current_admin.username,
        status="completed",
    )
    db.add(payout)
    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="PLATFORM_WITHDRAWAL",
        target_object="PLATFORM_WALLET",
        target_id=p_wallet.id,
        new_val={"amount": req.amount, "currency": req.currency, "destination": req.destination_address, "payout_id": payout.id},
        request=request,
    )

    return {
        "success": True,
        "message": f"{req.amount} {req.currency} {req.destination_address} manziliga yuborildi",
    }


# ====== Finance / Revenue & Profit (Komissiya va obuna tushumlari, foyda) ======


def _normalize_period(days: Optional[int], from_date: Optional[str], to_date: Optional[str]):
    """Vaqt oralig'ini (start, end) datetime-lariga aylantiradi. None = cheklovsiz."""
    now = datetime.now(timezone.utc)
    start, end = None, None

    if days and days > 0:
        start = now - timedelta(days=days)
        end = now

    if from_date:
        try:
            parsed = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            start = parsed
        except Exception:
            pass

    if to_date:
        try:
            parsed = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            end = parsed
        except Exception:
            pass

    return start, end


def _date_filters(start: Optional[datetime], end: Optional[datetime]):
    filters = []
    if start:
        filters.append(Transaction.created_at >= start)
    if end:
        filters.append(Transaction.created_at <= end)
    return filters


@router.get("/finance/overview")
async def get_finance_overview(
    days: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Moliyaviy umumiy hisobot: komissiya, obuna sotuvlari,
    chiqarilgan pullar (payouts) va sof foyda (TON / USDT)."""
    start, end = _normalize_period(days, from_date, to_date)
    range_filters = _date_filters(start, end)

    async def _tx_sum(column, statuses, types=None, currency=None):
        stmt = select(func.sum(column)).where(Transaction.status.in_(statuses))
        if types:
            stmt = stmt.where(Transaction.transaction_type.in_(types))
        if currency:
            stmt = stmt.where(Transaction.currency == currency)
        for f in range_filters:
            stmt = stmt.where(f)
        res = await db.execute(stmt)
        return res.scalar() or 0.0

    async def _payout_sum(currency):
        stmt = select(func.sum(Payout.amount)).where(Payout.currency == currency)
        if start:
            stmt = stmt.where(Payout.created_at >= start)
        if end:
            stmt = stmt.where(Payout.created_at <= end)
        res = await db.execute(stmt)
        return res.scalar() or 0.0

    completed = [TransactionStatus.COMPLETED]
    subscription_types = [TransactionType.PREMIUM, TransactionType.TARIFF]

    # Komissiya daromadi (platforma ulushi)
    commission_gram = await _tx_sum(Transaction.commission_amount, completed, currency="TON")
    commission_usdt = await _tx_sum(Transaction.commission_amount, completed, currency="USDT")

    # Obuna va Stars sotuvlaridan olingan foyda
    subscription_gram = await _tx_sum(Transaction.amount, completed, types=subscription_types, currency="TON")
    subscription_usdt = await _tx_sum(Transaction.amount, completed, types=subscription_types, currency="USDT")

    stars_gram = await _tx_sum(Transaction.amount, completed, types=[TransactionType.STARS], currency="TON")
    stars_usdt = await _tx_sum(Transaction.amount, completed, types=[TransactionType.STARS], currency="USDT")
    premium_gram = await _tx_sum(Transaction.amount, completed, types=[TransactionType.PREMIUM, TransactionType.TARIFF], currency="TON")
    premium_usdt = await _tx_sum(Transaction.amount, completed, types=[TransactionType.PREMIUM, TransactionType.TARIFF], currency="USDT")

    refunds_gram = await _tx_sum(Transaction.amount, [TransactionStatus.REFUNDED], currency="TON")
    refunds_usdt = await _tx_sum(Transaction.amount, [TransactionStatus.REFUNDED], currency="USDT")

    # Chiqarilgan pullar (payoutlar)
    withdrawals_gram = await _payout_sum("TON")
    withdrawals_usdt = await _payout_sum("USDT")

    total_revenue_gram = round(commission_gram + subscription_gram + stars_gram, 4)
    total_revenue_usdt = round(commission_usdt + subscription_usdt + stars_usdt, 4)
    net_profit_gram = round(total_revenue_gram - withdrawals_gram, 4)
    net_profit_usdt = round(total_revenue_usdt - withdrawals_usdt, 4)

    # Kunlik grafik ma'lumotlari
    loop_end = end or datetime.now(timezone.utc)
    if start:
        loop_start = start
    elif days and days > 0:
        loop_start = loop_end - timedelta(days=days)
    else:
        loop_start = loop_end - timedelta(days=30)

    chart_data = []
    date_iter = loop_start.date()
    end_date = loop_end.date()
    while date_iter <= end_date:
        day_start = datetime.combine(date_iter, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(date_iter, datetime.max.time()).replace(tzinfo=timezone.utc)

        ton_stmt = select(func.sum(Transaction.amount)).where(
            Transaction.status == TransactionStatus.COMPLETED,
            Transaction.currency == "TON",
            Transaction.created_at >= day_start,
            Transaction.created_at <= day_end,
        )
        usdt_stmt = select(func.sum(Transaction.amount)).where(
            Transaction.status == TransactionStatus.COMPLETED,
            Transaction.currency == "USDT",
            Transaction.created_at >= day_start,
            Transaction.created_at <= day_end,
        )
        ton_rev = (await db.execute(ton_stmt)).scalar() or 0.0
        usdt_rev = (await db.execute(usdt_stmt)).scalar() or 0.0

        chart_data.append({
            "date": date_iter.strftime("%d.%m"),
            "ton": round(ton_rev, 2),
            "usdt": round(usdt_rev, 2),
        })
        date_iter += timedelta(days=1)

    # So'nggi moliyaviy tranzaksiyalar
    recent_stmt = select(Transaction, User.username).join(User, Transaction.user_id == User.id)
    for f in range_filters:
        recent_stmt = recent_stmt.where(f)
    recent_stmt = recent_stmt.order_by(Transaction.id.desc()).limit(20)
    recent_rows = (await db.execute(recent_stmt)).all()

    recent_transactions = []
    for tx, username in recent_rows:
        recent_transactions.append({
            "id": tx.id,
            "username": username,
            "transaction_type": tx.transaction_type.value,
            "status": tx.status.value,
            "amount": tx.amount,
            "commission_amount": tx.commission_amount,
            "currency": tx.currency,
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
        })

    # Umumiy sonlar
    total_tx_count = (await db.execute(select(func.count(Transaction.id)))).scalar() or 0
    completed_tx_count = (
        await db.execute(
            select(func.count(Transaction.id)).where(Transaction.status == TransactionStatus.COMPLETED)
        )
    ).scalar() or 0
    payout_tx_count = (await db.execute(select(func.count(Payout.id)))).scalar() or 0

    return {
        "period": {
            "days": days,
            "from": start.isoformat() if start else None,
            "to": end.isoformat() if end else None,
        },
        "summary": {
            "commission_gram": round(commission_gram, 4),
            "commission_usdt": round(commission_usdt, 4),
            "subscription_gram": round(subscription_gram, 4),
            "subscription_usdt": round(subscription_usdt, 4),
            "stars_gram": round(stars_gram, 4),
            "stars_usdt": round(stars_usdt, 4),
            "premium_gram": round(premium_gram, 4),
            "premium_usdt": round(premium_usdt, 4),
            "refunds_gram": round(refunds_gram, 4),
            "refunds_usdt": round(refunds_usdt, 4),
            "total_revenue_gram": total_revenue_gram,
            "total_revenue_usdt": total_revenue_usdt,
            "withdrawals_gram": round(withdrawals_gram, 4),
            "withdrawals_usdt": round(withdrawals_usdt, 4),
            "net_profit_gram": net_profit_gram,
            "net_profit_usdt": net_profit_usdt,
        },


        "counts": {
            "total_transactions": total_tx_count,
            "completed_transactions": completed_tx_count,
            "total_payouts": payout_tx_count,
        },
        "chart_data": chart_data,
        "recent_transactions": recent_transactions,
    }


@router.get("/finance/payouts")
async def get_finance_payouts(
    page: int = 1,
    limit: int = 20,
    current_admin: User = Depends(require_admin_or_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Chiqarilgan pullar (payouts) tarixi."""
    stmt = select(Payout).order_by(Payout.id.desc())
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    items = []
    for p in res.scalars().all():
        items.append({
            "id": p.id,
            "amount": p.amount,
            "currency": p.currency,
            "destination_address": p.destination_address,
            "admin_username": p.admin_username,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit,
    }


# Health
@router.get("/health")
async def get_system_health(current_admin: User = Depends(get_current_admin)):
    return {
        "status": "operational",
        "uptime": "99.98%",
        "errors_24h": 0,
        "services": {
            "admin_api": {"status": "healthy", "latency_ms": 5},
            "database": {"status": "healthy", "latency_ms": 2},
        },
    }


# Audit Logs
@router.get("/audit-logs")
async def get_audit_logs(
    page: int = 1,
    limit: int = 20,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * limit
    stmt = stmt.order_by(AuditLog.id.desc()).offset(offset).limit(limit)
    res = await db.execute(stmt)
    logs = res.scalars().all()

    items = []
    for l in logs:
        items.append({
            "id": l.id,
            "admin_id": l.admin_id,
            "admin_username": l.admin_username,
            "action_type": l.action_type,
            "target_object": l.target_object,
            "target_id": l.target_id,
            "previous_value": l.previous_value,
            "new_value": l.new_value,
            "ip_address": l.ip_address,
            "user_agent": l.user_agent,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit,
    }


# Admin Users Management
@router.get("/team")
@router.get("/settings/admin-users")
async def get_admin_team(
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AdminUser).order_by(AdminUser.id.asc())
    res = await db.execute(stmt)
    admins = res.scalars().all()

    if not admins:
        # Seed initial admin users if empty (SEED_ADMIN_USERS .env orqali boshqariladi)
        for seed in settings.seed_admin_users:
            role_str = seed["role"]
            if role_str not in (UserRole.SUPERADMIN.value, UserRole.ADMIN.value, UserRole.SUPPORT.value):
                role_str = UserRole.SUPERADMIN.value
            db.add(AdminUser(
                email=seed["email"],
                username=seed["username"],
                full_name=seed["full_name"],
                role=UserRole(role_str),
                is_active=True,
            ))
        await db.commit()
        res = await db.execute(select(AdminUser).order_by(AdminUser.id.asc()))
        admins = res.scalars().all()

    result = []
    for a in admins:
        last_ip = a.last_login_ip
        last_time = a.last_login

        if not last_ip or not last_time:
            log_stmt = (
                select(AdminLoginLog)
                .where(
                    or_(
                        func.lower(AdminLoginLog.username) == a.username.lower(),
                        func.lower(AdminLoginLog.username) == a.email.lower()
                    )
                )
                .order_by(AdminLoginLog.id.desc())
                .limit(1)
            )
            log_entry = (await db.execute(log_stmt)).scalar_one_or_none()
            if log_entry:
                if not last_ip and log_entry.ip_address:
                    last_ip = log_entry.ip_address
                if not last_time and log_entry.created_at:
                    last_time = log_entry.created_at

        role_str = a.role.value if hasattr(a.role, "value") else str(a.role)
        result.append({
            "id": a.id,
            "username": a.username,
            "email": a.email,
            "full_name": a.full_name,
            "role": role_str,
            "is_active": a.is_active,
            "two_factor_enabled": a.two_factor_enabled,
            "last_login": last_time.isoformat() if last_time else None,
            "last_login_ip": last_ip or "127.0.0.1",
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return result


class CreateAdminRequest(BaseModel):
    username: str = Field(..., min_length=3)
    email: str = Field(..., min_length=5)
    role: str = Field(..., description="superadmin, admin, yoki support")
    full_name: Optional[str] = None


@router.post("/team/invite")
@router.post("/settings/admin-users")
async def create_admin_user(
    req: CreateAdminRequest,
    request: Request,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    role_str = req.role.lower().strip()
    if role_str not in (UserRole.ADMIN.value, UserRole.SUPERADMIN.value, UserRole.SUPPORT.value):
        raise HTTPException(status_code=400, detail="Noto'g'ri rol kiritildi.")

    email_clean = req.email.strip().lower()
    username_clean = req.username.strip().lower()

    exist = await db.execute(
        select(AdminUser).where(or_(func.lower(AdminUser.username) == username_clean, func.lower(AdminUser.email) == email_clean))
    )
    if exist.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu username yoki email allaqachon admin_users ro'yxatida mavjud")

    new_admin = AdminUser(
        username=username_clean,
        email=email_clean,
        full_name=req.full_name or username_clean,
        role=UserRole(role_str),
        is_active=True,
    )
    db.add(new_admin)

    user_exist = await db.execute(select(User).where(func.lower(User.email) == email_clean))
    u = user_exist.scalar_one_or_none()
    if not u:
        u = User(
            email=email_clean,
            username=username_clean,
            full_name=req.full_name or username_clean,
            hashed_password=get_password_hash(uuid.uuid4().hex),
            role=UserRole(role_str),
            is_active=True,
        )
        db.add(u)
    else:
        u.role = UserRole(role_str)
        u.is_active = True

    await db.commit()
    await db.refresh(new_admin)

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="ADMIN_USER_CREATE",
        target_object="ADMIN_USER",
        target_id=new_admin.id,
        new_val={"username": new_admin.username, "email": new_admin.email, "role": new_admin.role.value},
        request=request,
    )

    return {"success": True, "message": f"Yangi {role_str} admin_users ro'yxatiga qo'shildi: {new_admin.email}"}


# IP Whitelist
class AddAllowedIPRequest(BaseModel):
    ip_address: str = Field(..., min_length=7)
    description: Optional[str] = "Admin kirish IP manzili"


@router.get("/allowed-ips")
@router.get("/settings/ip-whitelist")
async def get_allowed_ips(
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AllowedIP).order_by(AllowedIP.id.desc())
    res = await db.execute(stmt)
    ips = res.scalars().all()
    return [
        {
            "id": i.id,
            "ip_address": i.ip_address,
            "description": i.description,
            "created_by": i.created_by,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in ips
    ]


@router.post("/allowed-ips")
@router.post("/settings/ip-whitelist")
async def add_allowed_ip(
    req: AddAllowedIPRequest,
    request: Request,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    ip_clean = req.ip_address.strip()
    stmt = select(AllowedIP).where(AllowedIP.ip_address == ip_clean)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ushbu IP manzil allaqachon ruxsat etilganlar ro'yxatida mavjud")

    new_ip = AllowedIP(
        ip_address=ip_clean,
        description=req.description,
        created_by=current_admin.username,
    )
    db.add(new_ip)
    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="IP_WHITELIST_ADD",
        target_object="ALLOWED_IP",
        target_id=new_ip.id,
        new_val={"ip_address": new_ip.ip_address, "description": new_ip.description},
        request=request,
    )

    return {"success": True, "message": f"IP manzil ({ip_clean}) ruxsat etilganlar ro'yxatiga qo'shildi"}


@router.delete("/allowed-ips/{ip_id}")
@router.delete("/settings/ip-whitelist/{ip_id}")
async def delete_allowed_ip(
    ip_id: int,
    request: Request,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    ip_entry = await db.get(AllowedIP, ip_id)
    if not ip_entry:
        raise HTTPException(status_code=404, detail="IP manzil topilmadi")

    ip_str = ip_entry.ip_address
    await db.delete(ip_entry)
    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="IP_WHITELIST_REMOVE",
        target_object="ALLOWED_IP",
        target_id=ip_id,
        previous_val={"ip_address": ip_str},
        request=request,
    )

    return {"success": True, "message": f"IP manzil ({ip_str}) ro'yxatdan o'chirildi"}


# ---------------------------------------------------------------------------
# Blocklangan IP-larni boshqarish (avtomatik IP bloklash)
# ---------------------------------------------------------------------------


@router.get("/blocked-ips")
@router.get("/settings/blocked-ips")
async def get_blocked_ips(
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Avtomatik bloklangan IP-lar ro'yxati (faqat superadmin)."""
    stmt = select(BlockedIP).order_by(BlockedIP.blocked_at.desc())
    res = await db.execute(stmt)
    ips = res.scalars().all()
    return [
        {
            "id": i.id,
            "ip_address": i.ip_address,
            "reason": i.reason,
            "triggered_by_email": i.triggered_by_email,
            "blocked_at": i.blocked_at.isoformat() if i.blocked_at else None,
            "blocked_until": i.blocked_until.isoformat() if i.blocked_until else None,
        }
        for i in ips
    ]


@router.delete("/blocked-ips/{ip_id}")
@router.delete("/settings/blocked-ips/{ip_id}")
async def unblock_ip(
    ip_id: int,
    request: Request,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Bloklangan IP-ni qo'lda blokdan chiqarish (faqat superadmin)."""
    ip_entry = await db.get(BlockedIP, ip_id)
    if not ip_entry:
        raise HTTPException(status_code=404, detail="Bloklangan IP topilmadi")

    ip_str = ip_entry.ip_address
    await db.delete(ip_entry)
    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="IP_UNBLOCK",
        target_object="BLOCKED_IP",
        target_id=ip_id,
        previous_val={"ip_address": ip_str, "reason": ip_entry.reason},
        request=request,
    )

    await notify_admins_security_alert(
        f"\U0001f513 Admin panelidan IP manzil blokdan chiqarildi:\n"
        f"IP: {ip_str}\nAdmin: @{current_admin.username}"
    )

    return {"success": True, "message": f"IP manzil ({ip_str}) blokdan chiqarildi"}


# ---------------------------------------------------------------------------
# Kirish tarixi (login-logs) — kim, qaysi email/IP bilan kirishga urindi
# ---------------------------------------------------------------------------


@router.get("/login-logs")
@router.get("/settings/login-logs")
async def get_admin_login_logs(
    limit: int = 100,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Oxirgi admin panel kirish urinishlari tarixi (faqat superadmin).

    Status qiymatlari: SUCCESS_GOOGLE, FORBIDDEN_NOT_WHITELISTED,
    FORBIDDEN_EMAIL_BLOCKED, FORBIDDEN_IP, PASSWORD_LOGIN_REJECTED va h.k.
    """
    limit = max(1, min(int(limit or 100), 500))
    stmt = (
        select(AdminLoginLog)
        .order_by(AdminLoginLog.id.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return [
        {
            "id": l.id,
            "username": l.username,
            "status": l.status,
            "ip_address": l.ip_address,
            "user_agent": l.user_agent,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


# ---------------------------------------------------------------------------
# Qo'lda IP bloklash (avtomatikdan tashqari, admin tomonidan)
# ---------------------------------------------------------------------------


class BlockIPRequest(BaseModel):
    ip_address: str = Field(..., min_length=7, description="Bloklanadigan IP manzil")
    reason: Optional[str] = Field(None, description="Bloklash sababi")


@router.post("/blocked-ips")
@router.post("/settings/blocked-ips")
async def block_ip_manual(
    req: BlockIPRequest,
    request: Request,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """IP manzilni admin panelidan qo'lda bloklaydi (doimiy)."""
    ip_str = req.ip_address.strip()
    if not ip_str:
        raise HTTPException(status_code=400, detail="IP manzil kiriting")

    from app.services.ip_blocker import add_ip_to_blocklist

    entry = await add_ip_to_blocklist(
        db,
        ip_address=ip_str,
        reason=req.reason.strip() or "Admin tomonidan qo'lda bloklandi",
        triggered_by_email=current_admin.email,
        blocked_until=None,
    )
    if not entry:
        raise HTTPException(
            status_code=400,
            detail=f"'{ip_str}' manzilini bloklab bo'lmadi (localhost manzillari bloklanmaydi yoki allaqachon bloklangan)",
        )

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="IP_BLOCK_MANUAL",
        target_object="BLOCKED_IP",
        target_id=entry.id,
        previous_val=None,
        new_val={"ip_address": ip_str, "reason": entry.reason},
        request=request,
    )
    await notify_admins_security_alert(
        f"\U0001f6ab Admin panelidan IP manzil qo'lda bloklandi:\n"
        f"IP: {ip_str}\nSabab: {entry.reason}\nAdmin: @{current_admin.username}"
    )

    return {
        "success": True,
        "message": f"IP manzil ({ip_str}) muvaffaqiyatli bloklandi",
        "blocked_ip": {
            "id": entry.id,
            "ip_address": entry.ip_address,
            "reason": entry.reason,
        },
    }


# ---------------------------------------------------------------------------
# Bloklangan emaillar (qo'lda) — ushbu email bilan kirish taqiqlanadi
# ---------------------------------------------------------------------------


@router.get("/blocked-emails")
@router.get("/settings/blocked-emails")
async def get_blocked_admin_emails(
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Admin panel uchun qo'lda bloklangan emaillar ro'yxati."""
    stmt = select(BlockedAdminEmail).order_by(BlockedAdminEmail.blocked_at.desc())
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [
        {
            "id": i.id,
            "email": i.email,
            "reason": i.reason,
            "blocked_by": i.blocked_by,
            "blocked_at": i.blocked_at.isoformat() if i.blocked_at else None,
        }
        for i in items
    ]


class BlockEmailRequest(BaseModel):
    email: str = Field(..., min_length=5, description="Bloklanadigan email manzil")
    reason: Optional[str] = Field(None, description="Bloklash sababi")


@router.post("/blocked-emails")
@router.post("/settings/blocked-emails")
async def block_admin_email(
    req: BlockEmailRequest,
    request: Request,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Email manzilni admin panel uchun bloklaydi (kirish taqiqlanadi).

    Agar shu email bilan AdminUser mavjud bo'lsa, u ham muzlatiladi (is_active=False).
    """
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="To'g'ri email manzil kiriting")

    stmt = select(BlockedAdminEmail).where(func.lower(BlockedAdminEmail.email) == email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"'{email}' allaqachon bloklangan")

    entry = BlockedAdminEmail(
        email=email,
        reason=req.reason.strip() or "Admin tomonidan bloklandi",
        blocked_by=current_admin.email,
    )
    db.add(entry)

    admin_user_stmt = select(AdminUser).where(func.lower(AdminUser.email) == email)
    admin_user_entry = (await db.execute(admin_user_stmt)).scalar_one_or_none()
    if admin_user_entry and admin_user_entry.is_active:
        admin_user_entry.is_active = False

    await db.commit()
    await db.refresh(entry)

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="EMAIL_BLOCK_MANUAL",
        target_object="BLOCKED_ADMIN_EMAIL",
        target_id=entry.id,
        previous_val=None,
        new_val={"email": email, "reason": entry.reason},
        request=request,
    )
    await notify_admins_security_alert(
        f"\U0001f6ab Admin panelidan email bloklandi:\n"
        f"Email: {email}\nSabab: {entry.reason}\nAdmin: @{current_admin.username}"
    )

    return {
        "success": True,
        "message": f"'{email}' emaili Admin Panel uchun bloklandi",
        "blocked_email": {
            "id": entry.id,
            "email": entry.email,
            "reason": entry.reason,
        },
    }


@router.delete("/blocked-emails/{blocked_id}")
@router.delete("/settings/blocked-emails/{blocked_id}")
async def unblock_admin_email(
    blocked_id: int,
    request: Request,
    current_admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Bloklangan emailni blokdan chiqaradi. Agar emailda AdminUser bo'lsa uni qayta faollashtiradi."""
    entry = await db.get(BlockedAdminEmail, blocked_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Bloklangan email topilmadi")

    email = entry.email
    reason = entry.reason

    admin_user_stmt = select(AdminUser).where(func.lower(AdminUser.email) == email)
    admin_user_entry = (await db.execute(admin_user_stmt)).scalar_one_or_none()
    if admin_user_entry and not admin_user_entry.is_active:
        admin_user_entry.is_active = True

    await db.delete(entry)
    await db.commit()

    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type="EMAIL_UNBLOCK_MANUAL",
        target_object="BLOCKED_ADMIN_EMAIL",
        target_id=blocked_id,
        previous_val={"email": email, "reason": reason},
        new_val=None,
        request=request,
    )

    return {"success": True, "message": f"'{email}' emaili blokdan chiqarildi"}


# ====== Admin Action Log (umumiy harakatlarni audit qilish) ======
@router.post("/actions/log")
async def log_admin_action_endpoint(
    action: AdminActionRequest,
    request: Request,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Frontend/admin tomonidan bajarilgan umumiy harakatlarni audit logga yozish."""
    await log_admin_action(
        db=db,
        admin=current_admin,
        action_type=action.action,
        target_object=action.target_type or "ADMIN_ACTION",
        target_id=action.target_id,
        new_val=action.details,
        request=request,
    )
    return {"success": True, "message": "Harakat audit logga yozildi"}
