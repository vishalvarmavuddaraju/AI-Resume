"""History and evaluation CRUD."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from config import get_db
from schemas import HistoryItem, UpdateResumeJsonRequest
from storage import (
    delete_evaluation,
    find_evaluation,
    list_evaluations,
    update_evaluation_resume_json,
)

router = APIRouter()


@router.get("/history", response_model=List[HistoryItem])
async def get_history(current_user=Depends(get_current_user)):
    db = get_db()
    evaluations = await list_evaluations(db, current_user["id"], limit=50)
    history = []
    for e in evaluations:
        ats_result = e.get("ats_result", {})
        hireability = e.get("hireability_analysis", {}) or {}
        ats_score = ats_result.get("final_score", 0)
        hireability_score = hireability.get("hireability_evaluation", {}).get("hireability_score", 0)
        interview_probability = hireability.get("final_recommendation", {}).get("shortlist_decision", "unknown")
        resume_text = e.get("original_resume_text", "")
        history.append({
            "id": e["id"],
            "timestamp": e["timestamp"],
            "target_role": e["target_role"],
            "ats_score": ats_score,
            "hireability_score": hireability_score,
            "interview_probability": interview_probability,
            "preview": resume_text[:100] + "..." if len(resume_text) > 100 else resume_text,
        })
    return history


@router.get("/evaluation/{evaluation_id}")
async def get_evaluation(evaluation_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    evaluation = await find_evaluation(db, evaluation_id, current_user["id"])
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation


@router.patch("/evaluation/{evaluation_id}/resume_json")
async def patch_evaluation_resume_json(evaluation_id: str, body: UpdateResumeJsonRequest, current_user=Depends(get_current_user)):
    """Update an evaluation's resume_json (e.g. after manual edits in the JSON editor)."""
    db = get_db()
    evaluation = await find_evaluation(db, evaluation_id, current_user["id"])
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    updated = await update_evaluation_resume_json(db, evaluation_id, current_user["id"], body.resume_json)
    if not updated:
        return {"message": "No changes applied", "resume_json": body.resume_json}
    return {"message": "Resume JSON updated", "resume_json": body.resume_json}


@router.delete("/evaluation/{evaluation_id}")
async def delete_evaluation_route(evaluation_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    deleted = await delete_evaluation(db, evaluation_id, current_user["id"])
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return {"message": "Evaluation deleted"}
