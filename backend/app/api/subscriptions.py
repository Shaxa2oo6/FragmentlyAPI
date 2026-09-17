# backend/app/api/subscriptions.py
"""
Obuna (Subscription) ta'riflari va joriy reja API
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])

# Ta'riflar (narxlar GRAM/USDT da)
PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price": 0,
        "currency": "",
        "requests_per_minute": 10,
        "features": ["Daqiqasiga 10 ta so'rov", "Yuqori xizmat barqarorligi", "Standart qo'llab-quvvatlash"],
        "current": True,
    },
    {
        "id": "lite",
        "name": "Lite",
        "price": 1.61,
        "currency": "GRAM",
        "requests_per_minute": 30,
        "features": [
            "Daqiqasiga 30 ta so'rov",
            "Yuqori xizmat barqarorligi",
            "Tezkor API Response",
        ],
        "current": False,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price": 4.50,
        "currency": "GRAM",
        "requests_per_minute": 100,
        "features": [
            "Daqiqasiga 100 ta so'rov",
            "Prioritetli tranzaksiya navbati",
            "24/7 VIP qo'llab-quvvatlash",
            "Shaxsiy Webhook xabarnomalari",
        ],
        "current": False,
    },
]


@router.get("/plans")
async def get_plans(current_user: User = Depends(get_current_user)):
    """Obuna ta'riflari ro'yxati va foydalanuvchining joriy rejasi."""
    # Hozircha hamma Free. Kengaytirish: User.plan_id maydoni orqali.
    plans = [dict(p) for p in PLANS]
    for p in plans:
        p["current"] = p["id"] == "free"
    return {
        "plans": plans,
        "current_plan": "free",
        "current_limit": 10,
        "user": {"username": current_user.username},
    }


@router.post("/subscribe")
async def subscribe(data: dict, current_user: User = Depends(get_current_user)):
    """Obunaga o'tish (demo: bu yerda to'lov tizimi ulanadi)."""
    plan_id = data.get("plan_id")
    plan = next((p for p in PLANS if p["id"] == plan_id), None)
    if not plan:
        return {"success": False, "message": "Bunday ta'rif topilmadi"}

    return {
        "success": True,
        "message": f"{plan['name']} ta'rifiga o'tildi",
        "plan": plan,
    }