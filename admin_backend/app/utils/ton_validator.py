import base64
import re


def is_valid_ton_address(address: str) -> bool:
    if not address or not isinstance(address, str):
        return False

    addr = address.strip()

    if re.match(r"^-?\d+:[0-9a-fA-F]{64}$", addr):
        return True

    if len(addr) != 48:
        return False

    if not re.match(r"^[A-Za-z0-9_-]{48}$", addr):
        return False

    try:
        b64 = addr.replace("-", "+").replace("_", "/")
        padded = b64 + "=" * (-len(b64) % 4)
        raw_bytes = base64.b64decode(padded)

        if len(raw_bytes) != 36:
            return False

        data = raw_bytes[:34]
        crc_actual = (raw_bytes[34] << 8) | raw_bytes[35]

        crc = 0
        for byte in data:
            crc ^= byte << 8
            for _ in range(8):
                if crc & 0x8000:
                    crc = ((crc << 1) ^ 0x1021) & 0xFFFF
                else:
                    crc = (crc << 1) & 0xFFFF

        return crc == crc_actual
    except Exception:
        return False
