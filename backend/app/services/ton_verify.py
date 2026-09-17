# backend/app/services/ton_verify.py
"""
TON blockchain'dagi to'lovni REAL vaqtda tekshirish servisi.

Foydalanuvchi TON Connect orqali platforma hamyoniga tranzaksiya yuborganidan
so'ng, `confirm` endpoint bu servis orqali tranzaksiya haqiqatan mavjudligini
va summa hamda qabul qiluvchi to'g'ri ekanligini tekshiradi.

Manbalar:
  1) TON Center  -> /getTransactions  (kalitsiz, mainnet)
  2) TonAPI.io   -> /v2/accounts/.../transactions + events (zaxira)
"""

import asyncio
import logging
from typing import Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TON_DECIMALS = 9


class TONVerifyService:
    def __init__(self):
        self.toncenter_url = "https://toncenter.com/api/v2"
        self.tonapi_url = "https://tonapi.io/v2"
        self.ton_api_key = getattr(settings, "TON_API_KEY", None)
        if self.ton_api_key and self.ton_api_key.startswith("your-"):
            self.ton_api_key = None
        self.timeout = 10.0

    @staticmethod
    def normalize_address(addr: Optional[str]) -> str:
        """Manzilni qisqacha oddiy normalizatsiya (hamma bo'sh joylarni olib tashlaydi)."""
        return (addr or "").replace(" ", "").strip()

    @staticmethod
    def _canonical(addr: Optional[str]) -> str:
        """Friendly (EQC..) va raw (0:..) manzillarni solishtirish uchun canonical shakl.

        Imkoni bo'lsa pytoniq Address orqali raw (<wc>:<hex>) ko'rinishga keltiradi,
        aks holda bo'sh joylarsiz oddiy qaytaradi.
        """
        addr = TONVerifyService.normalize_address(addr)
        if not addr:
            return ""
        try:
            from pytoniq_core.boc.address import Address

            return Address(addr).to_str(is_user_friendly=False)
        except Exception:
            return addr.lower()

    @staticmethod
    def _friendly_valid(addr: str) -> bool:
        return len(addr) == 48 and addr.startswith(("UQ", "EQ", "UQC", "EQC")) and "_" not in addr

    def is_valid_address(self, addr: Optional[str]) -> bool:
        addr = self.normalize_address(addr)
        if not addr:
            return False
        if self._friendly_valid(addr):
            return True
        # raw <workchain>:<hex64>
        if ":" in addr:
            wc, _, hexpart = addr.partition(":")
            return wc.isdigit() and len(hexpart) == 64 and all(c in "0123456789abcdefABCDEF" for c in hexpart)
        return False

    @staticmethod
    def _tx_hash(t: dict) -> str:
        """toncenter getTransactions tranzaksiya hash'ini chiqaradi."""
        tid = t.get("transaction_id") or {}
        h = tid.get("hash") or t.get("hash") or ""
        return str(h).strip().lower()

    @staticmethod
    def _tx_utime(t: dict) -> int:
        """Tranzaksiya UTC vaqti (utime maydoni yoki transaction_id.lt zaxira)."""
        try:
            return int(t.get("utime") or 0)
        except Exception:
            return 0

    async def _toncenter_transactions(self, client: httpx.AsyncClient, address: str) -> list:
        params = {"address": address, "limit": 100, "archival": "true"}
        if self.ton_api_key:
            params["api_key"] = self.ton_api_key
        res = await client.get(f"{self.toncenter_url}/getTransactions", params=params, timeout=self.timeout)
        res.raise_for_status()
        data = res.json()
        if not data.get("ok"):
            return []
        return data.get("result", [])

    async def _tonapi_transactions(self, client: httpx.AsyncClient, address: str) -> list:
        res = await client.get(
            f"{self.tonapi_url}/accounts/{address}/transactions", params={"limit": 100}, timeout=self.timeout
        )
        res.raise_for_status()
        data = res.json()
        return data.get("transactions", [])

    async def find_native_payment(
        self,
        recipient: str,
        sender: str,
        expected_amount_ton: float,
        comment: Optional[str] = None,
        attempts: int = 8,
        delay: float = 3.0,
    ) -> Dict:
        """Recipient blokcheyn tranzaksiyalarini skanerlab, sender + summa (va
        ixtiyoriy comment) mos keladigan REAL tranzaksiya hash'ini qaytaradi.

        pytoniq `raw_send_message` faqat muvaffaqiyat belgisi (1) qaytaradi,
        real tx_hash bermaydi — shuning uchun transfer yuborilgach blockchain
        dan haqiqiy tranzaksiya qidiriladi.

        Returns:
            {"verified": True, "tx_hash": "...", "amount_ton": ...} yoki
            {"verified": False, "reason": ...}
        """
        import time as _time

        recipient = self.normalize_address(recipient)
        sender = self.normalize_address(sender)
        if not recipient:
            return {"verified": False, "reason": "qabul qiluvchi ko'rsatilmagan"}

        desired_nano = int(round(expected_amount_ton * 10**TON_DECIMALS))
        start = _time.time()

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for _ in range(attempts):
                txs = []
                try:
                    txs = await self._toncenter_transactions(client, recipient)
                except Exception as exc:
                    logger.warning("toncenter tx fetch error: %s", exc)

                for t in txs:
                    in_msg = t.get("in_msg") or {}
                    src = self.normalize_address(in_msg.get("source") or "")
                    value_nano = int(in_msg.get("value") or 0)
                    money = value_nano / 10**TON_DECIMALS

                    amount_ok = value_nano >= desired_nano * 0.99 or abs(value_nano - desired_nano) <= 5 * 10**8
                    sender_ok = not sender or src == sender or src.endswith(sender[-12:]) or sender in src
                    if not (amount_ok and sender_ok):
                        continue

                    if comment:
                        comment_ok = False
                        raw_msg = in_msg.get("message") or in_msg.get("raw_body") or ""
                        try:
                            decoded = bytes.fromhex(str(raw_msg)).decode("utf-8", "ignore")
                            if comment in decoded:
                                comment_ok = True
                        except Exception:
                            comment_ok = True  # message parse bo'lmasa comment tekshirilmaydi
                        if not comment_ok:
                            continue

                    t_hash = self._tx_hash(t)
                    if not t_hash:
                        continue
                    return {
                        "verified": True,
                        "method": "toncenter",
                        "tx_hash": t_hash,
                        "amount_ton": round(money, 9),
                        "sender": src,
                        "confirmations": 1,
                    }

                # Zaxira manba: TonAPI events (toncenter ba'zi manzillar uchun bo'sh qaytaradi)
                try:
                    ev = await client.get(
                        f"{self.tonapi_url}/accounts/{recipient}/events",
                        params={"limit": 30},
                        timeout=self.timeout,
                    )
                    if ev.status_code == 200:
                        for event in (ev.json().get("events") or []):
                            actions = event.get("actions") or []
                            # Event ichida bounce (platformadan qaytish) bor-yo'qligini tekshirish
                            rec_canon = self._canonical(recipient)
                            bounced = False
                            for action in actions:
                                transfer = action.get("TonTransfer") or action.get("SimpleTransfer") or {}
                                if not transfer:
                                    continue
                                s = self._canonical((transfer.get("sender") or {}).get("address") or "")
                                r = self._canonical((transfer.get("recipient") or {}).get("address") or "")
                                if s == rec_canon and r != rec_canon:
                                    bounced = True
                                    break
                            if bounced:
                                continue
                            for action in actions:
                                transfer = action.get("TonTransfer") or action.get("SimpleTransfer") or {}
                                if not transfer:
                                    continue
                                value_nano = int(transfer.get("amount") or 0)
                                if value_nano <= 0:
                                    continue
                                money = value_nano / 10**TON_DECIMALS
                                amount_ok = value_nano >= desired_nano * 0.99 or abs(value_nano - desired_nano) <= 5 * 10**8
                                if not amount_ok:
                                    continue
                                rec = self._canonical(
                                    (transfer.get("recipient") or {}).get("address") or ""
                                )
                                src = self._canonical(
                                    (transfer.get("sender") or {}).get("address") or ""
                                )
                                if rec != self._canonical(recipient):
                                    continue
                                sender_ok = not sender or src == self._canonical(sender) or src.endswith(self._canonical(sender)[-12:]) or self._canonical(sender) in src
                                if not sender_ok:
                                    continue
                                if comment:
                                    comment_ok = comment in str(transfer.get("comment") or "")
                                    if not comment_ok:
                                        continue
                                event_id = str(event.get("event_id") or "").strip().lower()
                                if len(event_id) != 64:
                                    continue
                                return {
                                    "verified": True,
                                    "method": "tonapi",
                                    "tx_hash": event_id,
                                    "amount_ton": round(money, 9),
                                    "sender": src,
                                    "confirmations": 1,
                                }
                except Exception as exc:
                    logger.warning("tonapi event search error: %s", exc)

                if _time.time() - start > 90:
                    break
                await asyncio.sleep(delay)

        return {"verified": False, "reason": "tranzaksiya topilmadi yoki tasdiqlanmadi"}

    async def find_jetton_payment(
        self,
        recipient_owner: str,
        expected_amount_usdt: float,
        jetton_master: Optional[str] = None,
        comment: Optional[str] = None,
        attempts: int = 8,
        delay: float = 3.0,
    ) -> Dict:
        """TonAPI orqali Jetton (USDT) tranzaksiyasini qidiradi va REAL tx_hash qaytaradi.

        pytoniq `raw_send_message` jetton transfer uchun ham faqat muvaffaqiyat
        belgisi (1) qaytaradi — shuning uchun yuborilgach blockchain'da haqiqiy
        tranzaksiya qidiriladi.

        Args:
            recipient_owner: qabul qiluvchi TON hamyon manzili (Jetton egasi).
            expected_amount_usdt: yuborilgan USDT miqdori (decimal, masalan 0.1).
            jetton_master: USDT Jetton Master manzili (ixtiyoriy, odatda USDT).
            comment: memo/comment tekshiruvi (ixtiyoriy).
        """
        import time as _time

        recipient_owner = self._canonical(recipient_owner)
        if not recipient_owner:
            return {"verified": False, "reason": "qabul qiluvchi ko'rsatilmagan"}

        desired_nano = int(round(expected_amount_usdt * 10**6))  # USDT (TON) decimals = 6        start = _time.time()

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for _ in range(attempts):
                try:
                    ev = await client.get(
                        f"{self.tonapi_url}/accounts/{recipient_owner}/events",
                        params={"limit": 50},
                        timeout=self.timeout,
                    )
                    if ev.status_code == 200:
                        for event in (ev.json().get("events") or []):
                            for action in (event.get("actions") or []):
                                jt = action.get("JettonTransfer") or {}
                                if not jt:
                                    continue
                                amount_nano = int(jt.get("amount") or 0)
                                if amount_nano <= 0:
                                    continue
                                amount_ok = amount_nano >= desired_nano * 0.99 or abs(amount_nano - desired_nano) <= 500
                                if not amount_ok:
                                    continue
                                if jetton_master:
                                    j_addr = (jt.get("jetton") or {}).get("address") or ""
                                    if self._canonical(j_addr) != self._canonical(jetton_master):
                                        continue
                                rec = (jt.get("recipient") or {}).get("address") or ""
                                if comment:
                                    comment_ok = comment in str(jt.get("comment") or "")
                                    if not comment_ok:
                                        continue
                                event_id = str(event.get("event_id") or "").strip().lower()
                                if len(event_id) != 64:
                                    continue
                                return {
                                    "verified": True,
                                    "method": "tonapi",
                                    "tx_hash": event_id,
                                    "amount_usdt": round(amount_nano / 10**6, 9),
                                    "recipient": rec,
                                }
                except Exception as exc:
                    logger.warning("jetton payment search error: %s", exc)

                if _time.time() - start > 90:
                    break
                await asyncio.sleep(delay)

        return {"verified": False, "reason": "jetton tranzaksiya topilmadi yoki tasdiqlanmadi"}

    async def verify_native_payment(
        self,
        tx_hash: str,
        recipient: str,
        sender: str,
        expected_amount_ton: float,
    ) -> Dict:
        """Natív TON (GRAM) to'lovini tekshiradi: hash mavjud, qabul qiluvchi + summa mos."""
        tx_hash = (tx_hash or "").strip().lower()
        recipient = self.normalize_address(recipient)
        sender = self.normalize_address(sender)
        if not tx_hash or not recipient:
            return {"verified": False, "reason": "tx_hash yoki qabul qiluvchi ko'rsatilmagan"}

        desired_nano = int(round(expected_amount_ton * 10**TON_DECIMALS))
        best = {"verified": False, "reason": "tranzaksiya topilmadi yoki tasdiqlanmadi"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                txs = []
                try:
                    txs = await self._toncenter_transactions(client, recipient)
                    best["method"] = "toncenter"
                except Exception as exc:
                    logger.warning("toncenter tx fetch error: %s", exc)
                    try:
                        txs = await self._tonapi_transactions(client, sender)
                        best["method"] = "tonapi"
                    except Exception as exc2:
                        logger.warning("tonapi tx fetch error: %s", exc2)

                for t in txs:
                    t_hash = self._tx_hash(t)
                    if t_hash != tx_hash:
                        continue
                    in_msg = t.get("in_msg") or {}
                    src = self.normalize_address(in_msg.get("source") or "")
                    value_nano = int(in_msg.get("value") or 0)
                    money = value_nano / 10**TON_DECIMALS

                    # Qabul qiluvchi shu tranzaksiyada ekanini also check out_msgs for sender side
                    amount_ok = value_nano >= desired_nano * 0.99 or abs(value_nano - desired_nano) <= 5 * 10**8
                    sender_ok = not sender or src == sender or src.endswith(sender[-12:]) or sender in src

                    if amount_ok and sender_ok:
                        return {
                            "verified": True,
                            "method": best.get("method", "toncenter"),
                            "tx_hash": tx_hash,
                            "amount_ton": round(money, 9),
                            "sender": src,
                            "confirmations": 1,
                        }
                    best.update({
                        "reason": "summa yoki jo'natuvchi mos kelmadi",
                        "found_amount_ton": round(money, 9),
                        "found_sender": src,
                    })

                # Zaxira: TonAPI events orqali event_id == tx_hash tekshirish
                if not best.get("verified"):
                    try:
                        ev = await client.get(
                            f"{self.tonapi_url}/accounts/{recipient}/events",
                            params={"limit": 50},
                            timeout=self.timeout,
                        )
                        if ev.status_code == 200:
                            for event in (ev.json().get("events") or []):
                                eid = str(event.get("event_id") or "").strip().lower()
                                if eid != tx_hash:
                                    continue
                                actions = event.get("actions") or []
                                rec_canon = self._canonical(recipient)
                                bounced = False
                                for action in actions:
                                    transfer = action.get("TonTransfer") or action.get("SimpleTransfer") or {}
                                    if not transfer:
                                        continue
                                    s = self._canonical((transfer.get("sender") or {}).get("address") or "")
                                    r = self._canonical((transfer.get("recipient") or {}).get("address") or "")
                                    if s == rec_canon and r != rec_canon:
                                        bounced = True
                                        break
                                if bounced:
                                    best.update({"reason": "to'lov bounce bo'lib qaytdi (kontrakt deploy qilinmagan)"})
                                    continue
                                for action in actions:
                                    transfer = action.get("TonTransfer") or action.get("SimpleTransfer") or {}
                                    if not transfer:
                                        continue
                                    value_nano = int(transfer.get("amount") or 0)
                                    if value_nano <= 0:
                                        continue
                                    money = value_nano / 10**TON_DECIMALS
                                    amount_ok = value_nano >= desired_nano * 0.99 or abs(value_nano - desired_nano) <= 5 * 10**8
                                    if not amount_ok:
                                        continue
                                    src = self._canonical(
                                        (transfer.get("sender") or {}).get("address") or ""
                                    )
                                    sender_ok = not sender or src == self._canonical(sender) or src.endswith(self._canonical(sender)[-12:]) or self._canonical(sender) in src
                                    if not sender_ok:
                                        continue
                                    return {
                                        "verified": True,
                                        "method": "tonapi",
                                        "tx_hash": tx_hash,
                                        "amount_ton": round(money, 9),
                                        "sender": src,
                                        "confirmations": 1,
                                    }
                                best.update({"reason": "event topildi ammo summa/jo'natuvchi mos kelmadi"})
                    except Exception as exc:
                        logger.warning("tonapi verify fallback error: %s", exc)
        except Exception as exc:
            logger.error("verify_native_payment error: %s", exc)
            best["reason"] = f"tekshirishda xatolik: {exc}"

        return best

    async def verify_tx_exists(self, tx_hash: str, user_wallet: str) -> Dict:
        """Tranzaksiya hash'ining haqiqiy ekanligini foydalanuvchi hisobidan tekshiradi (USDT uchun)."""
        tx_hash = (tx_hash or "").strip().lower()
        user_wallet = self.normalize_address(user_wallet)
        if not tx_hash or not user_wallet:
            return {"verified": False, "reason": "tx_hash yoki hamyon ko'rsatilmagan"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                txs = []
                try:
                    for t in await self._toncenter_transactions(client, user_wallet):
                        txs.append(t)
                except Exception:
                    pass
                if not txs:
                    try:
                        txs = await self._tonapi_transactions(client, user_wallet)
                    except Exception:
                        pass

                for t in txs:
                    t_hash = self._tx_hash(t)
                    if t_hash == tx_hash:
                        return {"verified": True, "method": "onchain", "tx_hash": tx_hash}
        except Exception as exc:
            logger.error("verify_tx_exists error: %s", exc)
            return {"verified": False, "reason": str(exc)}

        return {"verified": False, "reason": "tranzaksiya topilmadi"}


ton_verify_service = TONVerifyService()