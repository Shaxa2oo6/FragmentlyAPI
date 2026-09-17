"""API Token generatsiya servisi.

Qat'iy biznes-qoidalar (spec 1.A):
  1. Token HECh qachon avtomatik yaratilmaydi (registratsiya/login hamyon ulash vaqtida).
  2. `api_token` DB'da `null` bo'lib qoladi.
  3. Faqat wallet ulangach, foydalanuvchi "Generate / Regenerate API Token"
     tugmasini bosganida quyidagi formatda hosil qilinadi:

       frag_<secrets.token_urlsafe(32)>_<user_id>

  4. Regenerate (aylantirish) eski tokenni bekor qiladi va yangisini yozadi.
"""

import secrets

API_TOKEN_PREFIX = "frag_"


def generate_api_token(user_id: int) -> str:
    """Yangi API token yaratadi: `frag_<43 belgi>_<user_id>`."""
    return f"{API_TOKEN_PREFIX}{secrets.token_urlsafe(32)}_{user_id}"


def set_api_token(user, db) -> str:
    """Foydalanuvchi uchun yangi token yaratib DB'ga saqlaydi.

    `user` — `User` modeli, `db` — AsyncSession. Yangi token qaytariladi.
    """
    new_token = generate_api_token(user.id)
    user.api_token = new_token
    db.add(user)
    return new_token
