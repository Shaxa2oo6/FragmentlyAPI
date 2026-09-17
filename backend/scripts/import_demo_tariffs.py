# backend/scripts/import_demo_tariffs.py
"""
Demo tarif import skripti.

Ishlatish:
    python scripts/import_demo_tariffs.py

Nima qiladi:
  1. `tariffs` jadvaliga yangi ustunlar qo'shadi (agar yo'q bo'lsa):
     duration_days, features, badge
  2. Jadval bo'sh bo'lsa demo tariflar (Free/Lite/Pro) yozadi
  3. Mavjud yozuvlarda yangi maydonlar bo'sh bo'lsa ularni to'ldiradi
     (narx, komissiya, muddat, so'rovlar soni, xususiyatlar)

Jadvalga qo'shimcha tarif qo'shish uchun: pastdagi DEMO_TARIFFS ro'yxatiga
yozuv qo'shing va skriptni qayta ishga tushiring.
"""
import os

import psycopg

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/fragmently",
)

# Nomi, tavsif, narx TON, narx USDT, komissiya %, so'rov/min, muddat kun, badge, xususiyatlar
DEMO_TARIFFS = [
    {
        "name": "Free",
        "description": "Boshlang'ich bepul tarif",
        "price_gram": 0.0,
        "price_usdt": 0.0,
        "commission_percent": 5.0,
        "rate_limit_per_min": 100,
        "duration_days": 30,
        "badge": "standart",
        "features": "Daqiqasiga 10 ta so'rov\nStandart qo'llab-quvvatlash\n5% komissiya",
    },
    {
        "name": "Lite",
        "description": "O'rta hajm resurslar, past komissiya",
        "price_gram": 1.61,
        "price_usdt": 2.5,
        "commission_percent": 2.5,
        "rate_limit_per_min": 30,
        "duration_days": 30,
        "badge": "tezkor",
        "features": "Daqiqasiga 30 ta so'rov\nTez API javob\n2.5% komissiya\n30 kun faollik",
    },
    {
        "name": "Pro",
        "description": "Maksimallashtirilgan API limitlar, 0.5% komissiya",
        "price_gram": 4.50,
        "price_usdt": 7.0,
        "commission_percent": 0.5,
        "rate_limit_per_min": 100,
        "duration_days": 30,
        "badge": "vip",
        "features": "Daqiqasiga 100 ta so'rov\n0.5% komissiya\nVIP 24/7 qo'llab-quvvatlash\nShaxsiy Webhook xabarnomalari\n30 kun faollik",
    },
]


def main():
    conn = psycopg.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT to_regclass('public.tariffs')")
    if not cur.fetchone()[0]:
        raise SystemExit("Xato: 'tariffs' jadvali topilmadi. Avval backend-ni ishga tushiring (jadval avtomatik yaratiladi).")

    cols = {r[0] for r in cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='tariffs'")}
    for col, ddl in (
        ("duration_days", "ALTER TABLE tariffs ADD COLUMN duration_days INTEGER DEFAULT 30"),
        ("features", "ALTER TABLE tariffs ADD COLUMN features TEXT"),
        ("badge", "ALTER TABLE tariffs ADD COLUMN badge VARCHAR(30)"),
    ):
        if col not in cols:
            print(f"[+] ustun qo'shildi: {col}")
            cur.execute(ddl)

    cur.execute("SELECT id, name FROM tariffs")
    existing = {name: tid for tid, name in cur.fetchall()}

    for t in DEMO_TARIFFS:
        if t["name"] in existing:
            cur.execute(
                """
                UPDATE tariffs SET
                    description = %s,
                    price_gram = %s,
                    price_usdt = %s,
                    commission_percent = %s,
                    rate_limit_per_min = %s,
                    duration_days = COALESCE(duration_days, %s),
                    badge = COALESCE(badge, %s),
                    features = COALESCE(features, %s)
                WHERE name = %s
                """,
                (
                    t["description"], t["price_gram"], t["price_usdt"],
                    t["commission_percent"], t["rate_limit_per_min"],
                    t["duration_days"], t["badge"], t["features"], t["name"],
                ),
            )
            print(f"[~] yangilandi: {t['name']}")
        else:
            cur.execute(
                """
                INSERT INTO tariffs
                    (name, description, price_gram, price_usdt, commission_percent,
                     rate_limit_per_min, duration_days, badge, features, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                """,
                (
                    t["name"], t["description"], t["price_gram"], t["price_usdt"],
                    t["commission_percent"], t["rate_limit_per_min"],
                    t["duration_days"], t["badge"], t["features"],
                ),
            )
            print(f"[+] yaratildi: {t['name']}")

    cur.execute("SELECT id, name, price_gram, price_usdt, commission_percent, rate_limit_per_min, duration_days, badge FROM tariffs ORDER BY price_gram")
    print("\n=== Joriy tariffs jadvali ===")
    for r in cur.fetchall():
        print(r)

    conn.close()
    print("\nDemo import muvaffaqiyatli yakunlandi.")


if __name__ == "__main__":
    main()
