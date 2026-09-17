import base64
import hashlib
import hmac
import os
import struct
import time


def generate_totp_secret() -> str:
    random_bytes = os.urandom(20)
    return base64.b32encode(random_bytes).decode("utf-8").replace("=", "")


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    if not code:
        return False

    code = str(code).strip()

    if not secret:
        return False

    try:
        secret_clean = secret.upper().replace(" ", "")
        missing_padding = len(secret_clean) % 8
        if missing_padding:
            secret_clean += "=" * (8 - missing_padding)

        key = base64.b32decode(secret_clean, casefold=True)
        now = int(time.time())
        current_step = now // 30

        for i in range(-window, window + 1):
            step = current_step + i
            counter = struct.pack(">Q", step)
            hmac_hash = hmac.new(key, counter, hashlib.sha1).digest()
            offset = hmac_hash[-1] & 0x0F
            binary_code = (
                ((hmac_hash[offset] & 0x7F) << 24)
                | ((hmac_hash[offset + 1] & 0xFF) << 16)
                | ((hmac_hash[offset + 2] & 0xFF) << 8)
                | (hmac_hash[offset + 3] & 0xFF)
            )
            totp = binary_code % 1000000
            totp_str = str(totp).zfill(6)
            if totp_str == code:
                return True
    except Exception:
        pass
    return False


def get_totp_uri(secret: str, account_name: str, issuer: str = "Fragmently Admin") -> str:
    return f"otpauth://totp/{issuer}:{account_name}?secret={secret}&issuer={issuer}"
