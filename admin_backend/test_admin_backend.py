import asyncio
import os
import secrets
import sys
import time
from unittest.mock import patch

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Testlar tashqi .env'ga bog'liq bo'lmasin va izolyatsiya qilingan DB'da ishlasin.
# os.environ qiymatlari pydantic-settings'da .env fayldan ustun turadi.
# Xohlasangiz TEST_DATABASE_URL orqali o'z DB'ingizni ko'rsatishingiz mumkin.
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

from httpx import AsyncClient, ASGITransport
from app.config import settings
from app.main import app
from app.database import engine, Base
from app.utils.totp import generate_totp_secret, verify_totp
from app.utils.ton_validator import is_valid_ton_address

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
    print("=== STARTING STANDALONE ADMIN BACKEND TESTS (PORT 8001) ===")

    # Initialize DB & Ensure Schema
    async with engine.begin() as conn:
        def _check(sync_conn):
            from sqlalchemy import inspect, text
            insp = inspect(sync_conn)
            if insp.has_table("admin_login_logs"):
                try:
                    sync_conn.execute(text("ALTER TABLE admin_login_logs ALTER COLUMN status TYPE VARCHAR(50)"))
                    sync_conn.execute(text("ALTER TABLE admin_login_logs ALTER COLUMN username TYPE VARCHAR(100)"))
                except Exception:
                    pass
            if insp.has_table("platform_wallet"):
                cols = {c["name"] for c in insp.get_columns("platform_wallet")}
                if "pending_wallet_address" not in cols:
                    sync_conn.execute(text("DROP TABLE platform_wallet"))
        await conn.run_sync(_check)
        await conn.run_sync(Base.metadata.create_all)


    from app.database import async_session
    from app.models import AdminUser, UserRole
    from sqlalchemy import select

    async with async_session() as session:
        admin_check = await session.execute(select(AdminUser))
        if not admin_check.scalars().all():
            session.add_all([
                AdminUser(email="admin@example.com", username="superadmin", full_name="Super Admin", role=UserRole.SUPERADMIN, is_active=True),
                AdminUser(email="support@example.com", username="admin", full_name="System Admin", role=UserRole.ADMIN, is_active=True),
            ])
            await session.commit()

    # Unit tests
    assert is_valid_ton_address("EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N") == True
    assert is_valid_ton_address("invalid_address_123") == False
    print("[OK] TON Address Checksum Validator passed!")

    secret = generate_totp_secret()
    assert verify_totp(secret, "123456") == False
    print("[OK] TOTP 2FA Verifier passed (master-code bypass removed)!")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:

        # 1. Health check
        res_h = await client.get("/health")
        assert res_h.status_code == 200
        assert res_h.json()["service"] == "admin_backend"
        print("[OK] Admin Backend Health endpoint passed!")

        # 2. Reject non-admin email
        with google_auth_patch():
            res_reject = await client.post(
                "/api/admin/auth/google",
                json={"token": make_google_token("unauthorized@user.com")},
            )
        assert res_reject.status_code == 403
        print("[OK] Reject non-admin email passed (403 Forbidden)!")

        # 2b. Reject request without a Google token (email-only must NOT log in)
        res_no_token = await client.post(
            "/api/admin/auth/google", json={"email": "admin@example.com"}
        )
        assert res_no_token.status_code == 400
        print("[OK] Email-only login rejected (400 Bad Request)!")

        # 3. Reject password login
        res_pwd = await client.post("/api/admin/auth/login", json={"username": "superadmin", "password": "123"})
        assert res_pwd.status_code == 403
        print("[OK] Password login disabled check passed (403 Forbidden)!")

        # 4. Login valid superadmin (via verified Google id_token)
        with google_auth_patch():
            res_login = await client.post(
                "/api/admin/auth/google",
                json={"token": make_google_token("admin@example.com")},
            )
        assert res_login.status_code == 200
        login_data = res_login.json()
        assert login_data["success"] is True
        assert login_data["role"] == "superadmin"
        assert login_data["redirect"] == "/admin/dashboard"
        token = login_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("[OK] Google OAuth valid admin login passed (success + redirect /admin/dashboard)!")

        # 5. Commission settings
        res_comm = await client.get("/api/admin/settings/commission", headers=headers)
        assert res_comm.status_code == 200
        print("[OK] GET /api/admin/settings/commission passed!")

        # 6. Update Free commission
        res_up_comm = await client.put("/api/admin/settings/commission", json={"tariff_name": "Free", "commission_percent": 4.5}, headers=headers)
        assert res_up_comm.status_code == 200
        print("[OK] PUT /api/admin/settings/commission passed!")

        # 7. Platform wallet GET
        res_pw = await client.get("/api/admin/settings/wallet", headers=headers)
        assert res_pw.status_code == 200
        print("[OK] GET /api/admin/settings/wallet passed!")

        # 8. Eski qo'lda manzil kiritish endpoint'lar olib tashlangan (410)
        test_ton_addr = "0:" + secrets.token_hex(32)
        res_upd_w = await client.put(
            "/api/admin/settings/wallet",
            json={"wallet_address": test_ton_addr, "wallet_type": "v5R1"},
            headers=headers,
        )
        assert res_upd_w.status_code == 410
        print("[OK] Manual address update endpoint removed (410 Gone)!")

        # 9. GET /platform-wallet - qo'lda manzil saqlanib qolmaydi (faqat seed orqali)
        res_get_w = await client.get("/api/admin/platform-wallet", headers=headers)
        assert res_get_w.status_code == 200
        gw = res_get_w.json()
        assert gw["ton_address"] is None or gw["seed_connected"] is True
        print("[OK] GET /platform-wallet - manual address never stored (ton_address only from seed)!")


        # 10. IP Whitelist endpoints
        res_ips = await client.get("/api/admin/settings/ip-whitelist", headers=headers)
        assert res_ips.status_code == 200

        test_ip = f"10.{secrets.randbelow(254) + 1}.{secrets.randbelow(254) + 1}.{secrets.randbelow(254) + 1}"
        res_add_ip = await client.post("/api/admin/settings/ip-whitelist", json={"ip_address": test_ip, "description": "Admin Office"}, headers=headers)
        assert res_add_ip.status_code == 200
        print("[OK] IP Whitelist GET & POST passed!")

        # 11. Audit logs
        res_logs = await client.get("/api/admin/audit-logs", headers=headers)
        assert res_logs.status_code == 200
        print("[OK] Audit logs verified!")

    print("\nALL STANDALONE ADMIN BACKEND TEST CASES PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())
