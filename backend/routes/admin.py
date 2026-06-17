"""Admin management routes."""
from fastapi import APIRouter, Depends, HTTPException

from auth import require_admin
from config import get_db
from schemas import AdminUserUpdateRequest
from storage import (
    delete_user,
    get_admin_evaluation_counts,
    list_users,
    update_user,
)

router = APIRouter()


@router.get("/admin/users")
async def get_admin_users(_admin=Depends(require_admin)):
    db = get_db()
    users = await list_users(db)
    return {"users": users}


@router.patch("/admin/users/{user_id}")
async def patch_admin_user(user_id: str, body: AdminUserUpdateRequest, _admin=Depends(require_admin)):
    db = get_db()
    updated = await update_user(db, user_id, body.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": updated}


@router.delete("/admin/users/{user_id}")
async def delete_admin_user(user_id: str, _admin=Depends(require_admin)):
    if user_id == _admin.get("id"):
        raise HTTPException(status_code=400, detail="Admin cannot delete own account")
    db = get_db()
    deleted = await delete_user(db, user_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}


@router.get("/admin/evaluations/summary")
async def get_admin_evaluations_summary(period: str = "week", _admin=Depends(require_admin)):
    if period not in {"day", "week", "month"}:
        raise HTTPException(status_code=400, detail="period must be one of: day, week, month")
    db = get_db()
    data = await get_admin_evaluation_counts(db, period)
    return {"period": period, "users": data}
