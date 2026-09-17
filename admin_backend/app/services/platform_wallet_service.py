"""Platforma hamyonini 24/12 so'zli seed-phrase orqali ulash servisi.

Vazifalari:
1. Seed-phrase ni validatsiya qilish (BIP39 / TON 'basic seed').
2. TON public manzillarini (v4R2/v5R1/v3R2/v3R1) StateInit orqali hisoblash.
3. Haqiqiy (blokcheynda faol) hamyon turini aniqlash (TonAPI).
4. USDT (Jetton) hamyon manzilini TonAPI orqali resolve qilish.
5. Balanslarni (TON + USDT) olish.
6. Seed-phrase ni Fernet (AES) bilan shifrlash.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PlatformWallet
from app.services.encryption import encrypt_seed
from app.services.seed_validator import mnemonic_to_keypair, normalize_mnemonic, validate_mnemonic

logger = logging.getLogger(__name__)

# TON USDT (USD₮) Jetton master kontrakti (mainnet, Tether rasmiy manzili)
USDT_JETTON_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
_TONAPI_URL = "https://tonapi.io/v2"

# Admin panelda tanlanishi mumkin bo'lgan hamyon turlari (faqat 3 xil).
WALLET_TYPES = ("v4R2", "v5R1", "v3R2")
# Avtomatik aniqlash uchun qo'shimcha versiya ham derivatsiya qilinadi.
DERIVED_WALLET_TYPES = ("v4R2", "v5R1", "v3R2", "v3R1")


class PlatformWalletConnectError(Exception):
    """Platforma hamyonini ulashdagi biznes-xato."""


def derive_ton_addresses(public_key: bytes) -> Dict[str, str]:
    """Barcha wallet versiyalari uchun TON manzillarini hisoblaydi.

    Returns:
        {"v4R2": "EQC...", "v5R1": "...", "v3R2": "...", "v3R1": "..."}
    """
    from pytoniq_core.boc.address import Address
    from pytoniq_core.tlb.account import StateInit
    from pytoniq_core.tlb.custom.wallet import WalletV3Data, WalletV4Data, WalletV5R1Data

    from pytoniq.contract.wallets.wallet import WALLET_V3_R1_CODE, WALLET_V3_R2_CODE, WALLET_V4_R2_CODE
    from pytoniq.contract.wallets.wallet_v5 import WALLET_V5_R1_CODE, WalletV5WalletID

    wc = 0
    wallet_id = 698983191 + wc  # standard subwallet_id (TON)

    def _address(code, data_cell) -> str:
        state_init = StateInit(code=code, data=data_cell)
        return Address((wc, state_init.serialize().hash)).to_str(
            is_user_friendly=True, is_bounceable=True, is_test_only=False
        )

    v5_wallet_id = WalletV5WalletID(
        workchain=wc, subwallet_number=0, network_global_id=-239
    ).pack()

    return {
        "v4R2": _address(WALLET_V4_R2_CODE, WalletV4Data(seqno=0, wallet_id=wallet_id, public_key=public_key).serialize()),
        "v5R1": _address(WALLET_V5_R1_CODE, WalletV5R1Data(seqno=0, wallet_id=v5_wallet_id, public_key=public_key, extensions=None, is_signature_allowed=True).serialize()),
        "v3R2": _address(WALLET_V3_R2_CODE, WalletV3Data(seqno=0, wallet_id=wallet_id, public_key=public_key).serialize()),
        "v3R1": _address(WALLET_V3_R1_CODE, WalletV3Data(seqno=0, wallet_id=wallet_id, public_key=public_key).serialize()),
    }


def raw_address(friendly: str) -> str:
    """EQC... manzildan '0:...' ko'rinishidagi raw manzilni chiqaradi."""
    from pytoniq_core.boc.address import Address

    return Address(friendly).to_str(is_user_friendly=False)


async def _account_status(client: httpx.AsyncClient, address: str) -> Optional[Dict]:
    """TonAPI orqali manzil holati va balansini so'raydi."""
    try:
        res = await client.get(f"{_TONAPI_URL}/accounts/{address}")
        if res.status_code != 200:
            return None
        data = res.json()
        return {
            "status": data.get("status", "nonexist"),
            "balance": int(data.get("balance", 0) or 0),
        }
    except Exception as exc:  # pragma: no cover
        logger.warning("TonAPI account status xatosi (%s): %s", address, exc)
        return None


async def _wallets_by_public_key(
    client: httpx.AsyncClient, public_key_hex: str
) -> List[Dict]:
    """TonAPI /v2/pubkeys/{public_key}/wallets - public key bo'yicha barcha hamyonlar."""
    url = f"{_TONAPI_URL}/pubkeys/{public_key_hex}/wallets"
    try:
        res = await client.get(url)
        if res.status_code != 200:
            return []
        data = res.json()
        accounts = data.get("accounts") or data.get("wallets") or []
        result = []
        for acc in accounts:
            r = acc.get("address", "")
            if not r:
                continue
            result.append({
                "raw": r,
                "status": acc.get("status", "nonexist"),
                "balance": int(acc.get("balance", 0) or 0),
                "last_activity": int(acc.get("last_activity", 0) or 0),
            })
        return result
    except Exception as exc:  # pragma: no cover
        logger.warning("TonAPI getWalletsByPublicKey xatosi: %s", exc)
        return []


async def detect_wallet_type(public_key: bytes) -> Dict:
    """Hamyon turini aniqlaydi va HAMYONNI BLOKCHEYNDAN TOPADI."""
    addresses = derive_ton_addresses(public_key)
    raw_to_type = {raw_address(addr): wtype for wtype, addr in addresses.items()}
    type_aliases = {
        "wallet v4 r2": "v4R2",
        "wallet v3 r2": "v3R2",
        "wallet v3 r1": "v3R1",
        "wallet v5 r1": "v5R1",
        "w5": "v5R1",
        "v5": "v5R1",
    }

    candidates: List[tuple] = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            found = await _wallets_by_public_key(client, public_key.hex())
            if not found:
                for wtype in DERIVED_WALLET_TYPES:
                    st = await _account_status(client, addresses[wtype])
                    if st:
                        found.append({
                            "raw": raw_address(addresses[wtype]),
                            "status": st["status"],
                            "balance": st["balance"],
                            "last_activity": 0,
                        })

            for item in found:
                raw, status, balance, last_act = (
                    item["raw"], item["status"], item["balance"], item["last_activity"],
                )
                if status == "active":
                    score = 100.0
                elif status in ("uninit", "frozen", "uninitialized") and balance > 0:
                    score = 50.0
                else:
                    continue
                score += min(balance / 1e9, 1000) + min(last_act / 1e9, 10)
                candidates.append((raw, status, balance, last_act, score))
    except Exception as exc:  # pragma: no cover
        logger.warning("Wallet turini aniqlashda xatolik: %s", exc)

    if not candidates:
        return {
            "wallet_type": "v4R2",
            "friendly_address": addresses["v4R2"],
            "raw_address": raw_address(addresses["v4R2"]),
            "is_active": False,
            "wallet_found": False,
        }

    candidates.sort(key=lambda c: c[4], reverse=True)
    raw, status, _b, _la, _s = candidates[0]
    wtype = raw_to_type.get(raw, "v4R2")
    from pytoniq_core.boc.address import Address

    friendly = Address(raw).to_str(is_user_friendly=True, is_bounceable=True, is_test_only=False)
    return {
        "wallet_type": wtype,
        "friendly_address": friendly,
        "raw_address": raw,
        "is_active": status == "active",
        "wallet_found": True,
    }


async def resolve_usdt_jetton_wallet(owner_address: str) -> Optional[str]:
    """USDT (Jetton) hamyon manzilini TonAPI orqali resolve qiladi.

    USDT Jetton manzili = f(master, owner). TonAPI buni beradi:
    GET /v2/accounts/{owner}/jettons/{master} -> {"wallet_address": {...}}
    """
    url = f"{_TONAPI_URL}/accounts/{owner_address}/jettons/{USDT_JETTON_MASTER}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                w = data.get("wallet_address")
                if isinstance(w, dict):
                    w = w.get("address")
                if not w:
                    w = data.get("address")
                if w:
                    return str(w)
    except Exception as exc:  # pragma: no cover
        logger.warning("TonAPI USDT jetton wallet resolve xatosi (%s): %s", owner_address, exc)
    return None


async def get_wallet_balances(address: str) -> Dict:
    """TON + USDT balanslarini olish (TonAPI). Xatolikda 0.0 qaytaradi."""
    ton_balance = 0.0
    usdt_balance = 0.0
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{_TONAPI_URL}/accounts/{address}")
            if res.status_code == 200:
                data = res.json()
                ton_balance = round(int(data.get("balance", 0) or 0) / 1e9, 6)

            res2 = await client.get(f"{_TONAPI_URL}/accounts/{address}/jettons")
            if res2.status_code == 200:
                for item in res2.json().get("balances", []):
                    j = item.get("jetton", {}) or {}
                    if (j.get("symbol") or "").upper() in ("USDT", "USD₮"):
                        decimals = int(j.get("decimals", 9) or 9)
                        usdt_balance = round(int(item.get("balance", 0) or 0) / (10 ** decimals), 6)
    except Exception as exc:  # pragma: no cover
        logger.warning("TonAPI balans olish xatosi (%s): %s", address, exc)
    return {"ton_balance": ton_balance, "usdt_balance": usdt_balance}


async def get_platform_wallet_live_balances(db: AsyncSession) -> Dict:
    """Platforma hamyonining REAL on-chain balanslarini TonAPI orqali oladi.

    - TON balansi  -> `platform_wallet.wallet_address` dan (asosiy TON hamyoni)
    - USDT balansi -> egalik qiluvchi (owner) TON manzilining /jettons so'rovidan
      (USDT Jetton Wallet'ning o'zi emas — uning /jettons ro'yxati bo'sh bo'ladi).

    Xatolik / hali o'rnatilmagan holatda DB'dagi (saqlangan) qiymatlarga tushadi.
    TonAPI 200 qaytarsa — bu authoritative real qiymat (shu jumladan 0.0);
    faqat TonAPI tarmoq xatosi bersa stored qiymat ishlatiladi.
    Returns:
        {
            "real_balance_gram": float,
            "real_balance_usdt": float,
            "balance_source": "live" | "stored",
        }
    """
    res = await db.execute(select(PlatformWallet).limit(1))
    pw = res.scalar_one_or_none()

    if not pw or not (pw.wallet_address or "").strip():
        return {
            "real_balance_gram": 0.0,
            "real_balance_usdt": 0.0,
            "balance_source": "stored",
        }

    ton_addr = pw.wallet_address.strip()

    ton_balance = None  # None = aniq ma'lumot olinmadi (network xato)
    usdt_balance = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # TON balansi
            try:
                r1 = await client.get(f"{_TONAPI_URL}/accounts/{ton_addr}")
                if r1.status_code == 200:
                    d1 = r1.json()
                    if (d1.get("status") or "") in ("nonexist", "not initialized"):
                        ton_balance = 0.0
                    else:
                        ton_balance = round(int(d1.get("balance", 0) or 0) / 1e9, 6)
            except Exception as exc:  # pragma: no cover
                logger.warning("Live TON balans xatosi (%s): %s", ton_addr, exc)

            # USDT (Jetton) balansi — EGALIK QILUVCHI (owner) manzildan olinadi.
            # Eslatma: `usdt_wallet_address` — bu USDT Jetton Wallet (kontrakt).
            # Jetton Wallet'ning o'zining /jettons ro'yxati bo'sh bo'ladi; real
            # USDT balansi faqat owner (TON) manzilining /jettons so'rovida keladi.
            try:
                r2 = await client.get(f"{_TONAPI_URL}/accounts/{ton_addr}/jettons")
                if r2.status_code == 200:
                    usdt_balance = 0.0
                    for item in r2.json().get("balances", []):
                        j = item.get("jetton", {}) or {}
                        if (j.get("symbol") or "").upper() in ("USDT", "USD₮"):
                            decimals = int(j.get("decimals", 9) or 9)
                            usdt_balance = round(int(item.get("balance", 0) or 0) / (10 ** decimals), 6)
                            break
            except Exception as exc:  # pragma: no cover
                logger.warning("Live USDT balans xatosi (%s): %s", ton_addr, exc)
    except Exception as exc:  # pragma: no cover
        logger.warning("Live balans olishda umumiy xatolik: %s", exc)

    if ton_balance is None and usdt_balance is None:
        return {
            "real_balance_gram": round(pw.balance_gram or 0.0, 6),
            "real_balance_usdt": round(pw.balance_usdt or 0.0, 6),
            "balance_source": "stored",
        }

    return {
        "real_balance_gram": round(ton_balance if ton_balance is not None else (pw.balance_gram or 0.0), 6),
        "real_balance_usdt": round(usdt_balance if usdt_balance is not None else (pw.balance_usdt or 0.0), 6),
        "balance_source": "live",
    }


async def connect_platform_wallet_from_seed(
    db: AsyncSession,
    seed_phrase: str,
    wallet_type: str = "v4R2",
) -> Dict:
    """Seed-phrase ni tekshirib, platforma hamyonlarini (TON + USDT) ulaydi va saqlaydi.

    Returns:
        {
            "wallet_address": ..., "usdt_wallet_address": ...,
            "wallet_type": ..., "seed_connected": True,
            "balance_gram": ..., "balance_usdt": ...,
            "wallet_found": bool, "is_active": bool,
        }

    Raises:
        PlatformWalletConnectError
    """
    error = validate_mnemonic(seed_phrase)
    if error:
        raise PlatformWalletConnectError(error)

    if wallet_type and wallet_type not in WALLET_TYPES:
        raise PlatformWalletConnectError(
            f"Noto'g'ri hamyon turi: {wallet_type}. Faqat: {', '.join(WALLET_TYPES)}"
        )

    words = normalize_mnemonic(seed_phrase)
    normalized_seed = " ".join(words)

    public_key, _ = mnemonic_to_keypair(words)

    # Hamyon turini aniqlash va manzillarni hisoblash
    detected = await detect_wallet_type(public_key)
    addr_map = derive_ton_addresses(public_key)

    chosen_type = wallet_type if wallet_type in WALLET_TYPES else detected["wallet_type"]
    ton_address = detected["friendly_address"] if chosen_type == detected["wallet_type"] else addr_map[chosen_type]

    # USDT (Jetton) hamyon manzili
    usdt_address = await resolve_usdt_jetton_wallet(ton_address)
    if not usdt_address:
        # Jetton manzili resolve bo'lmasa — TON manzili ishlatiladi (USDT egalik qiluvchi manzilga tushadi)
        usdt_address = ton_address

    balances = await get_wallet_balances(ton_address)

    encrypted_seed = encrypt_seed(normalized_seed)

    # DB'ga saqlash (upsert — platform_wallet jadvalida bitta yozuv)
    res = await db.execute(select(PlatformWallet).limit(1))
    p_wallet = res.scalar_one_or_none()
    if p_wallet is None:
        p_wallet = PlatformWallet()
        db.add(p_wallet)

    p_wallet.wallet_address = ton_address
    p_wallet.wallet_type = chosen_type
    p_wallet.usdt_wallet_address = usdt_address
    p_wallet.wallet_seed_encrypted = encrypted_seed
    p_wallet.seed_connected = True
    p_wallet.balance_gram = round(balances["ton_balance"], 6)
    p_wallet.balance_usdt = round(balances["usdt_balance"], 6)
    p_wallet.pending_wallet_address = None
    p_wallet.wallet_change_token = None
    p_wallet.wallet_change_expires_at = None

    await db.commit()

    return {
        "is_connected": True,
        "wallet_address": ton_address,
        "ton_address": ton_address,
        "usdt_wallet_address": usdt_address,
        "usdt_address": usdt_address,
        "wallet_type": chosen_type,
        "seed_connected": True,
        "wallet_found": detected["wallet_found"],
        "is_active": detected["is_active"],
        "balance_gram": p_wallet.balance_gram,
        "balance_usdt": p_wallet.balance_usdt,
        "ton_balance": p_wallet.balance_gram,
        "usdt_balance": p_wallet.balance_usdt,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }


async def disconnect_platform_wallet(db: AsyncSession) -> Dict:
    """Seed bilan bog'langan platforma hamyonlarini uzadi (seed shifrini o'chiradi)."""
    res = await db.execute(select(PlatformWallet).limit(1))
    p_wallet = res.scalar_one_or_none()
    if not p_wallet:
        raise PlatformWalletConnectError("Platforma hamyoni topilmadi")

    p_wallet.wallet_seed_encrypted = None
    p_wallet.seed_connected = False
    await db.commit()

    return {
        "success": True,
        "seed_connected": False,
        "wallet_address": p_wallet.wallet_address,
        "usdt_wallet_address": p_wallet.usdt_wallet_address,
        "message": "Platforma hamyoni seed-phrase bilan bog'lanishi bekor qilindi",
    }
