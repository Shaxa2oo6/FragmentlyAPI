import asyncio
import os
import secrets
import sys
import time

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Testlar tashqi .env'ga bog'liq bo'lmasin va izolyatsiya qilingan DB'da ishlasin.
# os.environ qiymatlari pydantic-settings'da .env fayldan ustun turadi.
os.environ.setdefault("TEST_DATABASE_URL", "sqlite+aiosqlite:///./test_admin_backend.db")
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["SECRET_KEY"] = "test-only-secret-key-c4a800fc-93f2-4f90-b54b-1f1a6f0c2d5e"
os.environ["GOOGLE_CLIENT_ID"] = "test-client-id"
os.environ["ALLOWED_ADMIN_EMAILS"] = "admin@example.com"
os.environ["ALLOWED_ADMIN_IPS"] = "127.0.0.1,::1"
os.environ["SEED_ADMIN_USERS"] = "admin@example.com:superadmin:Super Admin:superadmin"

import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric import rsa
from google.oauth2 import id_token as google_id_token
from unittest.mock import patch

from httpx import AsyncClient, ASGITransport
from app.config import settings
from app.main import app
from app.database import engine, Base

TEST_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
TEST_PUBLIC_KEY = TEST_PRIVATE_KEY.public_key()


def make_google_token(email: str, email_verified: bool = True) -> str:
    now = int(time.time())
    payload = {
        "iss": "https://accounts.google.com",
        "azp": settings.GOOGLE_CLIENT_ID,
        "aud": settings.GOOGLE_CLIENT_ID,
        "sub": email,
        "email": email,
        "email_verified": email_verified,
        "iat": now,
        "exp": now + 3600,
    }
    return pyjwt.encode(payload, TEST_PRIVATE_KEY, algorithm="RS256")


def fake_verify_oauth2_token(token, request, audience, clock_skew_in_seconds=0):
    unverified = pyjwt.decode(token, options={"verify_signature": False})
    if unverified.get("aud") != audience:
        raise ValueError("Invalid audience")
    return pyjwt.decode(token, TEST_PUBLIC_KEY, algorithms=["RS256"], audience=audience)


def google_auth_patch():
    return patch.object(
        google_id_token, "verify_oauth2_token", side_effect=fake_verify_oauth2_token
    )


async def run_tests():
    print("=== TESTING NEW ADMIN ENDPOINTS (users, refund, finance) ===")

    async with engine.begin() as conn:
        def _ensure(sync_conn):
            from sqlalchemy import inspect, text
            insp = inspect(sync_conn)
            if insp.has_table("admin_login_logs"):
                try:
                    sync_conn.execute(text("ALTER TABLE admin_login_logs ALTER COLUMN status TYPE VARCHAR(50)"))
                    sync_conn.execute(text("ALTER TABLE admin_login_logs ALTER COLUMN username TYPE VARCHAR(100)"))
                except Exception:
                    pass
            if insp.has_table("transactions"):
                tx_cols = {c["name"] for c in insp.get_columns("transactions")}
                if "error_message" not in tx_cols:
                    sync_conn.execute(text("ALTER TABLE transactions ADD COLUMN error_message TEXT"))
        await conn.run_sync(_ensure)
        await conn.run_sync(Base.metadata.create_all)


    from app.database import async_session
    from app.models import (
        AdminUser,
        PaymentMethod,
        Transaction,
        TransactionStatus,
        TransactionType,
        User,
        UserRole,
    )
    from app.auth import get_password_hash
    from sqlalchemy import select, delete

    async with async_session() as session:
        admin_check = await session.execute(
            select(AdminUser).where(AdminUser.email == "admin@example.com")
        )
        if not admin_check.scalar_one_or_none():
            session.add(AdminUser(
                email="admin@example.com", username="superadmin",
                full_name="Super Admin", role=UserRole.SUPERADMIN, is_active=True,
            ))

        existing = await session.execute(select(User).where(User.username == "testuser"))
        test_user = existing.scalar_one_or_none()
        if test_user:
            await session.delete(test_user)
            await session.commit()

        test_user = User(
            email="testuser@example.com",
            username="testuser",
            full_name="Test User",
            hashed_password=get_password_hash(secrets.token_hex(16)),
            role=UserRole.USER,
            is_active=True,
            wallet_address="0:" + secrets.token_hex(32),
            balance_gram=50.0,
            balance_usdt=100.0,
            tariff_plan="Free",
        )
        session.add(test_user)
        await session.flush()

        session.add_all([
            Transaction(
                user_id=test_user.id,
                transaction_type=TransactionType.PREMIUM,
                status=TransactionStatus.COMPLETED,
                payment_method=PaymentMethod.GRAM,
                amount=25.0, commission_amount=2.5, currency="TON",
                target_username="tg_user",
            ),
            Transaction(
                user_id=test_user.id,
                transaction_type=TransactionType.STARS,
                status=TransactionStatus.COMPLETED,
                payment_method=PaymentMethod.USDT,
                amount=40.0, commission_amount=1.5, currency="USDT",
                target_username="stars_user",
            ),
            Transaction(
                user_id=test_user.id,
                transaction_type=TransactionType.TARIFF,
                status=TransactionStatus.REFUNDED,
                payment_method=PaymentMethod.GRAM,
                amount=10.0, commission_amount=0.5, currency="TON",
                refund_reason="test refund",
            ),
        ])
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with google_auth_patch():
            res_login = await client.post(
                "/api/admin/auth/google",
                json={"token": make_google_token("admin@example.com")},
            )
        assert res_login.status_code == 200
        token = res_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[OK] Admin login")

        res_users = await client.get("/api/admin/users?q=testuser", headers=headers)
        assert res_users.status_code == 200
        uid = res_users.json()["items"][0]["id"]
        print(f"[OK] Users list, test user id={uid}")

        res_detail = await client.get(f"/api/admin/users/{uid}", headers=headers)
        assert res_detail.status_code == 200
        assert res_detail.json()["username"] == "testuser"
        assert len(res_detail.json()["transactions"]) == 3
        print("[OK] GET /users/{id} detail with transactions")

        res_tariff = await client.put(
            f"/api/admin/users/{uid}/tariff",
            json={"tariff_plan": "Lite", "reason": "promo upgrade for tests"},
            headers=headers,
        )
        assert res_tariff.status_code == 200
        print("[OK] PUT /users/{id}/tariff ->", res_tariff.json()["message"])

        res_block = await client.post(
            f"/api/admin/users/{uid}/toggle-block",
            json={"reason": "security test block"},
            headers=headers,
        )
        assert res_block.status_code == 200
        assert res_block.json()["is_active"] is False
        print("[OK] POST /users/{id}/toggle-block (blocked)")

        res_unblock = await client.post(
            f"/api/admin/users/{uid}/toggle-block",
            json={"reason": "security test unblock"},
            headers=headers,
        )
        assert res_unblock.status_code == 200
        assert res_unblock.json()["is_active"] is True
        print("[OK] POST /users/{id}/toggle-block (unblocked)")

        res_txs = await client.get("/api/admin/transactions?q=testuser", headers=headers)
        tx_completed = next(t for t in res_txs.json()["items"] if t["status"] == "completed")
        res_refund = await client.post(
            f"/api/admin/transactions/{tx_completed['id']}/refund",
            json={"reason": "manual refund for testing"},
            headers=headers,
        )
        assert res_refund.status_code == 200
        print("[OK] POST /transactions/{id}/refund ->", res_refund.json()["message"])

        res_finance = await client.get("/api/admin/finance/overview?days=30", headers=headers)
        assert res_finance.status_code == 200
        fin = res_finance.json()
        assert fin["summary"]["total_revenue_gram"] >= 25.0
        assert fin["summary"]["subscription_gram"] >= 25.0
        assert fin["summary"]["stars_usdt"] >= 0.0
        assert fin["summary"]["refunds_gram"] >= 10.0
        print("[OK] GET /finance/overview", fin["summary"])

        res_payouts = await client.get("/api/admin/finance/payouts", headers=headers)
        assert res_payouts.status_code == 200
        print("[OK] GET /finance/payouts, total:", res_payouts.json()["total"])

        res_audit = await client.get("/api/admin/audit-logs?limit=5", headers=headers)
        assert res_audit.status_code == 200
        actions = [a["action_type"] for a in res_audit.json()["items"]]
        print("[OK] Audit log actions:", actions[:6])

    print("\nALL NEW ENDPOINT TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(run_tests())
