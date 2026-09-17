import asyncio
import os
import secrets
import sys
import time

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Testlar tashqi .env'ga bog'liq bo'lmasin va izolyatsiya qilingan DB'da ishlasin.
os.environ.setdefault("TEST_DATABASE_URL", "sqlite+aiosqlite:///./test_admin_backend.db")
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["SECRET_KEY"] = "test-only-secret-key-c4a800fc-93f2-4f90-b54b-1f1a6f0c2d5e"
os.environ["GOOGLE_CLIENT_ID"] = "test-client-id"
os.environ["ALLOWED_ADMIN_EMAILS"] = "admin@example.com"
os.environ["ALLOWED_ADMIN_IPS"] = "127.0.0.1,::1"

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

# Valid 24-word BIP39 test mnemonic (entropy 0x00..0x00, checksum "art")
VALID_24_WORD_SEED = (
    "abandon abandon abandon abandon abandon abandon abandon abandon "
    "abandon abandon abandon abandon abandon abandon abandon abandon "
    "abandon abandon abandon abandon abandon abandon abandon art"
)


def make_google_token(email: str) -> str:
    now = int(time.time())
    payload = {
        "iss": "https://accounts.google.com",
        "azp": settings.GOOGLE_CLIENT_ID,
        "aud": settings.GOOGLE_CLIENT_ID,
        "sub": email,
        "email": email,
        "email_verified": True,
        "iat": now,
        "exp": now + 3600,
    }
    return pyjwt.encode(payload, TEST_PRIVATE_KEY, algorithm="RS256")


def fake_verify_oauth2_token(token, request, audience, clock_skew_in_seconds=0):
    return pyjwt.decode(token, TEST_PUBLIC_KEY, algorithms=["RS256"], audience=audience)


async def run_tests():
    print("=== TESTING SEED-ONLY PLATFORM WALLET FLOW (no manual address, no 2FA) ===")

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
            if insp.has_table("platform_wallet"):
                cols = {c["name"] for c in insp.get_columns("platform_wallet")}
                if "wallet_type" not in cols:
                    sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN wallet_type VARCHAR(20) DEFAULT 'v4R2'"))
                if "seed_connected" not in cols:
                    sync_conn.execute(text("ALTER TABLE platform_wallet ADD COLUMN seed_connected BOOLEAN DEFAULT FALSE"))
        await conn.run_sync(_ensure)
        await conn.run_sync(Base.metadata.create_all)

    from app.database import async_session
    from sqlalchemy import text
    async with async_session() as session:
        await session.execute(text("UPDATE platform_wallet SET seed_connected=FALSE, wallet_seed_encrypted=NULL, wallet_address=NULL, usdt_wallet_address=NULL"))
        await session.commit()


    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch.object(google_id_token, "verify_oauth2_token", side_effect=fake_verify_oauth2_token):
            res_login = await client.post(
                "/api/admin/auth/google",
                json={"token": make_google_token("admin@example.com")},
            )
        assert res_login.status_code == 200
        headers = {"Authorization": f"Bearer {res_login.json()['access_token']}"}
        print("[OK] Admin login")

        # 1. GET /platform-wallet вЂ” dastlab disconnect holatda (is_connected False)
        res_get = await client.get("/api/admin/platform-wallet", headers=headers)
        assert res_get.status_code == 200
        assert res_get.json()["is_connected"] is False
        print("[OK] GET /platform-wallet disconnected initially ->", res_get.json()["is_connected"])

        # 2. Eski qo'lda manzil kiritish endpoint'lar olib tashlangan -> 410
        res_dep = await client.put(
            "/api/admin/settings/wallet",
            json={"wallet_address": "0:" + secrets.token_hex(32), "wallet_type": "v5R1"},
            headers=headers,
        )
        assert res_dep.status_code == 410
        print("[OK] PUT /settings/wallet (manual address) removed -> 410")

        # 3. Noto'g'ri seed (24 so'z emas) rad etiladi
        res_bad = await client.post(
            "/api/admin/platform-wallet/connect",
            json={"seed_phrase": "qisqa ibora", "wallet_type": "v4R2"},
            headers=headers,
        )
        assert res_bad.status_code == 400
        print("[OK] Invalid seed rejected (400)")

        # 4. Noto'g'ri hamyon turi rad etiladi
        res_badtype = await client.post(
            "/api/admin/platform-wallet/connect",
            json={"seed_phrase": VALID_24_WORD_SEED, "wallet_type": "WRONG"},
            headers=headers,
        )
        assert res_badtype.status_code == 400
        print("[OK] Invalid wallet_type rejected (400)")

        # 5. Ulanmagan holda withdraw -> 400
        res_withdraw = await client.post(
            "/api/admin/platform-wallet/withdraw",
            json={"destination_address": "0:" + secrets.token_hex(32), "amount": 1.0, "currency": "TON"},
            headers=headers,
        )
        assert res_withdraw.status_code == 400
        print("[OK] POST /platform-wallet/withdraw requires connected seed -> 400")

        # 6. 24 so'zli seed bilan ulash (2FA so'ralmaydi, Superadmin Auth kifoya)
        res_conn = await client.post(
            "/api/admin/platform-wallet/connect",
            json={"seed_phrase": VALID_24_WORD_SEED, "wallet_type": "v4R2"},
            headers=headers,
        )
        assert res_conn.status_code == 200, res_conn.text
        data = res_conn.json()
        assert data["success"] is True
        assert data["is_connected"] is True
        assert data["wallet_type"] == "v4R2"
        assert data["wallet_address"].startswith(("EQC", "UQ", "EQ", "UQDE", "0:"))
        print("[OK] POST /platform-wallet/connect WITHOUT 2FA ->", data["wallet_address"][:12])

        # 7. GET /platform-wallet вЂ” ulangan hamyon + avtomatik manzillar
        res_get2 = await client.get("/api/admin/platform-wallet", headers=headers)
        assert res_get2.status_code == 200
        gw = res_get2.json()
        assert gw["is_connected"] is True
        assert gw["wallet_type"] == "v4R2"
        assert gw["ton_address"] == data["wallet_address"]
        assert gw["usdt_address"]
        print("[OK] GET /platform-wallet connected ->", gw["wallet_type"], gw["ton_address"][:12], gw["usdt_address"][:12])

        # 8. Disconnect
        res_disconnect = await client.post("/api/admin/platform-wallet/disconnect-seed", headers=headers)
        assert res_disconnect.status_code == 200
        print("[OK] POST /platform-wallet/disconnect-seed ->", res_disconnect.json()["message"])

        # 9. Disconnect'dan so'ng GET yana disconnect holat
        res_get3 = await client.get("/api/admin/platform-wallet", headers=headers)
        assert res_get3.json()["is_connected"] is False
        print("[OK] GET /platform-wallet disconnected after disconnect")

    print("\nALL SEED-ONLY WALLET TESTS PASSED!")


if __name__ == "__main__":
    asyncio.run(run_tests())
