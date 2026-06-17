"""User profile routes."""
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from config import get_db
from schemas import UpdateBasicsRequest
from storage import update_user_profile_basics

router = APIRouter()


@router.put("/user/profile/basics")
async def put_profile_basics(body: UpdateBasicsRequest, current_user=Depends(get_current_user)):
    db = get_db()
    updated = await update_user_profile_basics(db, current_user["id"], body.basics.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": updated}
