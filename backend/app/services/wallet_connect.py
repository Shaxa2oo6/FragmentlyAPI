"""GRAM / TON hamyonini mnemonic (seed-phrase) orqali ulash servisi.

Vazifalari:
1. Seed-phrase ni validatsiya qilish (BIP39 / TON standartlari).
2. Har bir TON wallet versiyasi (v4R2, v5R1, v3R2, v3R1) uchun
   StateInit orqali manzilni hisoblash (provayder talab qilinmaydi).
3. TonAPI orqali qaysi versiya blokcheynda faol ekanini aniqlash
   (agar hech biri faol bo'lmasa - v4R2 standart qilib olinadi).
4. Hamyon balansini (GRAM/TON + USDT Jetton) olish.
5. Seed-phrase ni Fernet (AES) bilan shifrlash va saqlash.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Mnemonic, User, WalletConnection
from app.services.encryption import encrypt_seed
from app.services.seed_validator import mnemonic_to_keypair, normalize_mnemonic, validate_mnemonic
from app.services.ton_balance import ton_balance

logger = logging.getLogger(__name__)

WALLET_TYPES = ("v4R2", "v5R1", "v3R2", "v3R1")

# TonAPI manzili (v2)
_TONAPI_URL = "https://tonapi.io/v2"


async def get_user_wallet_type(db: AsyncSession, user_id: int) -> Optional[str]:
    """Foydalanuvchining aktiv WalletConnection'dagi wallet_type'ini qaytaradi.

    Topilmasa None qaytadi (fragment servislar v5r1 ni default sifatida ishlatadi).
    """
    from sqlalchemy import select

    res = await db.execute(
        select(WalletConnection)
        .where(
            WalletConnection.user_id == user_id,
            WalletConnection.is_active.is_(True),
        )
        .order_by(WalletConnection.id.desc())
    )
    wc = res.scalars().first()
    if wc and wc.wallet_type:
        return str(wc.wallet_type)
    return None


class WalletConnectError(Exception):
    """Wallet ulash jarayonidagi biznes-xato."""


class WalletConnectService:
    """Mnemonic orqali GRAM / TON hamyonini ulash."""

    # ---------- Manzil derivatsiyasi ----------

    def _derive_addresses(self, public_key: bytes) -> Dict[str, str]:
        """Barcha wallet versiyalari uchun manzillarni hisoblaydi.

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

    # ---------- Wallet turini aniqlash ----------

    async def _account_status(self, client: httpx.AsyncClient, address: str) -> Optional[Dict]:
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
        self, client: httpx.AsyncClient, public_key_hex: str
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
                raw = acc.get("address", "")
                if not raw:
                    continue
                result.append({
                    "raw": raw,
                    "status": acc.get("status", "nonexist"),
                    "balance": int(acc.get("balance", 0) or 0),
                    "last_activity": int(acc.get("last_activity", 0) or 0),
                })
            return result
        except Exception as exc:  # pragma: no cover
            logger.warning("TonAPI getWalletsByPublicKey xatosi: %s", exc)
            return []

    @staticmethod
    def _toncenter_wallet_type(raw_address: str) -> Optional[str]:
        """TON Center getWalletInformation - wallet_type nomini qaytaradi (masalan 'wallet v4 r2')."""
        try:
            params = {"address": raw_address}
            api_key = getattr(settings, "TON_API_KEY", None)
            if api_key and not str(api_key).startswith("your"):
                params["api_key"] = api_key
            import httpx as _httpx

            res = _httpx.get(
                "https://toncenter.com/api/v2/getWalletInformation",
                params=params,
                timeout=6.0,
            )
            if res.status_code == 200 and res.json().get("ok"):
                wt = (res.json().get("result") or {}).get("wallet_type") or ""
                return wt.strip() or None
        except Exception as exc:  # pragma: no cover
            logger.warning("TON Center getWalletInformation xatosi (%s): %s", raw_address, exc)
        return None

    async def detect_wallet_type(self, public_key: bytes) -> Dict:
        """Hamyon turini aniqlaydi va HAMYONNI BLOKCHEYNDAN TOPADI.

        Returns:
            {
                "wallet_type": "v4R2" | "v5R1" | ...,
                "friendly_address": "EQC...",
                "raw_address": "0:...",
                "is_active": bool,       # blokcheynda deploy qilinganmi
                "wallet_found": bool,    # bu seed uchun mavjud hamyon topildimi
            }
        """
        addresses = self._derive_addresses(public_key)
        raw_to_type = {self._raw_address(addr): wtype for wtype, addr in addresses.items()}
        # Zaxira: variant (w5) nomi uchun sinonimlar
        type_aliases = {
            "wallet v4 r2": "v4R2",
            "wallet v3 r2": "v3R2",
            "wallet v3 r1": "v3R1",
            "wallet v5 r1": "v5R1",
            "w5": "v5R1",
            "v5": "v5R1",
        }

        timeout = float(getattr(settings, "TON_BALANCE_TIMEOUT", 10) or 10)
        candidates: List[Tuple[str, str, int, int, float]] = []  # (raw, status, balance, last_act, score)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                found = await self._wallets_by_public_key(client, public_key.hex())
                if not found:
                    # Zaxira: har bir versiya manzilini alohida tekshiramiz
                    for wtype in WALLET_TYPES:
                        st = await self._account_status(client, addresses[wtype])
                        if st:
                            found.append({
                                "raw": self._raw_address(addresses[wtype]),
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
                        score = 50.0  # pul yuborilgan lekin deploy qilinmagan
                    else:
                        continue  # yo'q / bo'sh - hisobga olmaymiz
                    score += min(balance / 1e9, 1000) + min(last_act / 1e9, 10)
                    candidates.append((raw, status, balance, last_act, score))
        except Exception as exc:  # pragma: no cover
            logger.warning("Wallet turini aniqlashda xatolik: %s", exc)

        if not candidates:
            # Blokcheynda hech narsa topilmadi -> bu yangi / ishlatilmagan seed
            chosen = "v4R2"
            friendly = addresses[chosen]
            return {
                "wallet_type": chosen,
                "friendly_address": friendly,
                "raw_address": self._raw_address(friendly),
                "is_active": False,
                "wallet_found": False,
            }

        # Eng yuqori ballni tanlaymiz
        candidates.sort(key=lambda c: c[4], reverse=True)
        raw, status, _balance, _la, _score = candidates[0]

        wtype = raw_to_type.get(raw)
        if wtype is None:
            # Noma'lum versiya - TON Center orqali nomini aniqlaymiz
            tcenter_type = self._toncenter_wallet_type(raw)
            wtype = type_aliases.get((tcenter_type or "").lower(), tcenter_type or "custom")

        from pytoniq_core.boc.address import Address

        friendly = Address(raw).to_str(is_user_friendly=True, is_bounceable=True, is_test_only=False)
        return {
            "wallet_type": wtype,
            "friendly_address": friendly,
            "raw_address": raw,
            "is_active": status == "active",
            "wallet_found": True,
        }

    @staticmethod
    def _raw_address(friendly: str) -> str:
        """EQC... manzildan '0:...' ko'rinishidagi raw manzilni chiqaradi."""
        from pytoniq_core.boc.address import Address

        return Address(friendly).to_str(is_user_friendly=False)

    # ---------- Asosiy oqim ----------

    async def connect(self, db: AsyncSession, user: User, raw_mnemonic: str) -> Dict:
        """Seed-phrase ni tekshirib, hamyonni ulaydi va ma'lumotlarni saqlaydi."""
        error = validate_mnemonic(raw_mnemonic)
        if error:
            raise WalletConnectError(error)

        words = normalize_mnemonic(raw_mnemonic)
        seed_phrase = " ".join(words)

        public_key, _ = mnemonic_to_keypair(words)

        # Wallet turini aniqlash va hamyonni blokcheyndan topish
        detected = await self.detect_wallet_type(public_key)
        wallet_type = detected["wallet_type"]
        friendly_address = detected["friendly_address"]
        raw_address = detected["raw_address"]
        is_active = detected["is_active"]
        wallet_found = detected["wallet_found"]

        # Balans (GRAM/TON + USDT)
        balance_data = await ton_balance.get_wallet_balance(friendly_address)
        ton_balance_value = float(balance_data.get("ton_balance", 0.0) or 0.0)
        usdt_balance_value = float(balance_data.get("usdt_balance", 0.0) or 0.0)

        # Fernet (AES) shifrlash
        encrypted_seed = encrypt_seed(seed_phrase)

        # --- DB'ga saqlash ---
        # DIQQAT: API token bu yerda YARATILMAYDI — spec 1.A qoidasi:
        # token faqat foydalanuvchi Profile sahifasida "Generate API Token"
        # tugmasini bosganda hosil qilinadi.
        user.wallet_seed_encrypted = encrypted_seed
        user.wallet_address = friendly_address
        user.wallet_connected = True
        user.balance_gram = ton_balance_value
        user.balance_usdt = usdt_balance_value
        user.is_verified = True

        # Mnemonic tarixi
        db.add(Mnemonic(
            user_id=user.id,
            seed_phrase_encrypted=encrypted_seed,
            wallet_address=friendly_address,
            is_active=True,
        ))

        # Wallet ulanish meta-ma'lumotlari (upsert)
        result = await db.execute(
            select(WalletConnection).where(WalletConnection.user_id == user.id)
        )
        conn = result.scalar_one_or_none()
        if conn is None:
            conn = WalletConnection(user_id=user.id)
            db.add(conn)
        conn.wallet_address = friendly_address
        conn.raw_address = raw_address
        conn.wallet_type = wallet_type
        conn.is_active = is_active
        conn.balance_ton = ton_balance_value
        conn.balance_gram = ton_balance_value

        await db.commit()
        await db.refresh(conn)

        created_at = conn.created_at
        if created_at and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        if wallet_found:
            message = "Hamyon muvaffaqiyatli ulandi"
        else:
            message = (
                "Bu seed uchun blokcheynda faol hamyon topilmadi - yangi hamyon "
                "manzili standart v4R2 bo'yicha hisoblandi"
            )

        return {
            "status": "success",
            "message": message,
            "wallet_info": {
                "address": friendly_address,
                "raw_address": raw_address,
                "wallet_type": wallet_type,
                "is_active": is_active,
                "wallet_found": wallet_found,
                "balance_ton": ton_balance_value,
                "balance_gram": ton_balance_value,
                "balance_usdt": usdt_balance_value,
                "created_at": created_at.isoformat() if created_at else datetime.now(timezone.utc).isoformat(),
            },
        }


wallet_connect_service = WalletConnectService()
