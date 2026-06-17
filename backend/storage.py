"""Database operations for evaluations and users."""
from datetime import UTC, datetime, timedelta
from typing import Any
import uuid


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _week_start(dt: datetime) -> datetime:
    return (dt - timedelta(days=dt.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def _month_start(dt: datetime) -> datetime:
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _day_start(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


async def ensure_indexes(db: Any) -> None:
    await db.evaluations.create_index([("user_id", 1), ("timestamp", -1)])
    await db.users.create_index("email", unique=True)


async def insert_evaluation(db: Any, doc: dict) -> None:
    await db.evaluations.insert_one(doc)


async def find_evaluation(db: Any, evaluation_id: str, user_id: str) -> dict | None:
    return await db.evaluations.find_one({"id": evaluation_id, "user_id": user_id}, {"_id": 0})


async def list_evaluations(db: Any, user_id: str, limit: int = 50) -> list:
    cursor = db.evaluations.find(
        {"user_id": user_id},
        {"_id": 0, "id": 1, "timestamp": 1, "target_role": 1,
         "ats_result": 1, "hireability_analysis": 1, "original_resume_text": 1, "final_verdict": 1},
    ).sort("timestamp", -1)
    return await cursor.to_list(limit)


async def delete_evaluation(db: Any, evaluation_id: str, user_id: str) -> int:
    result = await db.evaluations.delete_one({"id": evaluation_id, "user_id": user_id})
    return result.deleted_count


async def update_evaluation_resume_json(db: Any, evaluation_id: str, user_id: str, resume_json: dict) -> bool:
    result = await db.evaluations.update_one(
        {"id": evaluation_id, "user_id": user_id},
        {"$set": {"resume_json": resume_json}},
    )
    return result.modified_count > 0


async def upsert_user_from_google(db: Any, email: str, name: str) -> dict:
    existing = await db.users.find_one({"email": email})
    now = _now_iso()
    if existing:
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "updated_at": now}},
        )
        return await db.users.find_one({"email": email}, {"_id": 0})
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": name,
        "role": "user",
        "is_active": True,
        "profile": {"basics": None},
        "quota": {"evaluation_limit": 50},
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user)
    return user


async def get_user_by_id(db: Any, user_id: str) -> dict | None:
    return await db.users.find_one({"id": user_id}, {"_id": 0})


async def update_user_profile_basics(db: Any, user_id: str, basics: dict) -> dict | None:
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"profile.basics": basics, "updated_at": _now_iso()}},
    )
    return await get_user_by_id(db, user_id)


async def list_users(db: Any) -> list[dict]:
    cursor = db.users.find({}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=500)


async def update_user(db: Any, user_id: str, updates: dict) -> dict | None:
    set_updates: dict[str, Any] = {"updated_at": _now_iso()}
    if "role" in updates and updates["role"] is not None:
        set_updates["role"] = updates["role"]
    if "is_active" in updates and updates["is_active"] is not None:
        set_updates["is_active"] = bool(updates["is_active"])
    if "evaluation_limit" in updates and updates["evaluation_limit"] is not None:
        set_updates["quota.evaluation_limit"] = int(updates["evaluation_limit"])
    await db.users.update_one({"id": user_id}, {"$set": set_updates})
    return await get_user_by_id(db, user_id)


async def delete_user(db: Any, user_id: str) -> int:
    result = await db.users.delete_one({"id": user_id})
    return result.deleted_count


async def get_user_evaluation_limit(db: Any, user_id: str) -> int:
    user = await get_user_by_id(db, user_id)
    if not user:
        return 50
    return int(user.get("quota", {}).get("evaluation_limit", 50))


def _period_start_iso(period: str, timestamp: datetime | None = None) -> str:
    ts = timestamp or datetime.now(UTC)
    if period == "day":
        return _day_start(ts).isoformat()
    if period == "week":
        return _week_start(ts).isoformat()
    return _month_start(ts).isoformat()


async def get_user_current_usage(db: Any, user_id: str, timestamp: datetime | None = None) -> dict:
    usage = {}
    for period in ("day", "week", "month"):
        period_start = _period_start_iso(period, timestamp)
        usage[period] = await db.evaluations.count_documents(
            {"user_id": user_id, "timestamp": {"$gte": period_start}},
        )
    return usage


async def get_admin_evaluation_counts(db: Any, period: str) -> list[dict]:
    period_start = _period_start_iso(period)
    pipeline = [
        {"$match": {"timestamp": {"$gte": period_start}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
    ]
    counts = await db.evaluations.aggregate(pipeline).to_list(length=1000)
    users = await list_users(db)
    counts_by_user = {c.get("_id"): int(c.get("count", 0)) for c in counts}
    rows = []
    for user in users:
        rows.append(
            {
                "user_id": user["id"],
                "name": user.get("name", ""),
                "email": user.get("email", ""),
                "count": counts_by_user.get(user["id"], 0),
            }
        )
    rows.sort(key=lambda r: r["count"], reverse=True)
    return rows
