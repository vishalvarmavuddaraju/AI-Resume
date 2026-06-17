"""Evaluate text/PDF and LaTeX generation."""
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from auth import get_current_user
from config import get_api_key, get_db, get_ats_pass_threshold
from pdf import extract_pdf_text
from schemas import EvaluationRequest, EvaluationResult, LatexFromJsonRequest, CoverLetterRequest, ColdMessageRequest
from services.evaluation import evaluate_with_loop
from services.latex import generate_latex, AVAILABLE_TEMPLATES
from services.cover_letter import generate_cover_letter
from services.cold_message import generate_cold_message
from storage import (
    find_evaluation,
    get_user_current_usage,
    get_user_evaluation_limit,
    insert_evaluation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/templates")
async def list_templates():
    """Return list of available LaTeX resume templates and ATS pass threshold."""
    return {
        "templates": AVAILABLE_TEMPLATES,
        "ats_pass_threshold": get_ats_pass_threshold(),
    }


@router.post("/evaluate/text")
async def evaluate_text_resume(request: EvaluationRequest, current_user=Depends(get_current_user)):
    basics = current_user.get("profile", {}).get("basics")
    if not basics:
        raise HTTPException(status_code=400, detail="Profile basics required before evaluation")
    db = get_db()
    usage = await get_user_current_usage(db, current_user["id"])
    limit = await get_user_evaluation_limit(db, current_user["id"])
    if usage["month"] >= limit:
        raise HTTPException(status_code=429, detail=f"Evaluation limit reached ({limit}/month)")
    api_key = get_api_key()
    result = await evaluate_with_loop(
        request.resume_text,
        request.job_description,
        request.target_role,
        request.formatting_preference,
        api_key,
        user_basics=basics,
    )
    evaluation = EvaluationResult(
        original_resume_text=result.get("original_resume_text", request.resume_text),
        initial_resume_json=result.get("initial_resume_json", {}),
        resume_json=result.get("resume_json", {}),
        jd_json=result.get("jd_json", {}),
        job_description=request.job_description,
        target_role=request.target_role,
        formatting_preference=request.formatting_preference,
        ats_analysis=result.get("ats_analysis", {}),
        ats_result=result.get("ats_result", {}),
        final_verdict=result.get("final_verdict", {}),
        hireability_analysis=result.get("hireability_analysis"),
        contextual_alignment_guidance=result.get("contextual_alignment_guidance"),
        iterations=result.get("iterations", []),
        improvements_summary=result.get("improvements_summary", []),
        ats_pass_threshold=result.get("ats_pass_threshold", 70),
        user_id=current_user["id"],
    )
    doc = evaluation.model_dump()
    await insert_evaluation(db, doc)
    doc.pop("_id", None)
    return doc


@router.get("/evaluate/{evaluation_id}/latex")
async def get_latex_code(
    evaluation_id: str,
    template: str = "1page",
    current_user=Depends(get_current_user),
):
    db = get_db()
    evaluation = await find_evaluation(db, evaluation_id, current_user["id"])
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    resume_json = evaluation.get("resume_json", {})
    latex_code = generate_latex(resume_json, template_name=template)
    return {"evaluation_id": evaluation_id, "latex_code": latex_code, "template": template}


@router.post("/evaluate/{evaluation_id}/latex")
async def post_latex_from_json(evaluation_id: str, body: LatexFromJsonRequest, current_user=Depends(get_current_user)):
    """Generate LaTeX from provided resume_json (e.g. after manual edits). Evaluation must exist."""
    db = get_db()
    evaluation = await find_evaluation(db, evaluation_id, current_user["id"])
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    resume_json = body.resume_json
    template = body.template if body.template in AVAILABLE_TEMPLATES else "1page"
    latex_code = generate_latex(resume_json, template_name=template)
    return {"evaluation_id": evaluation_id, "latex_code": latex_code, "template": template}


@router.post("/evaluate/{evaluation_id}/cover-letter")
async def post_cover_letter(evaluation_id: str, body: CoverLetterRequest, current_user=Depends(get_current_user)):
    """Generate a cover letter from resume JSON and job description."""
    db = get_db()
    evaluation = await find_evaluation(db, evaluation_id, current_user["id"])
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    api_key = get_api_key()
    result = await generate_cover_letter(
        resume_json=body.resume_json,
        job_description=body.job_description,
        company_name=body.company_name,
        target_role=body.target_role,
        api_key=api_key,
    )
    return {"evaluation_id": evaluation_id, "cover_letter": result.get("cover_letter", result)}


@router.post("/evaluate/{evaluation_id}/cold-message")
async def post_cold_message(evaluation_id: str, body: ColdMessageRequest, current_user=Depends(get_current_user)):
    """Generate a LinkedIn cold referral message from resume JSON and job description."""
    db = get_db()
    evaluation = await find_evaluation(db, evaluation_id, current_user["id"])
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    api_key = get_api_key()
    result = await generate_cold_message(
        resume_json=body.resume_json,
        job_description=body.job_description,
        company_name=body.company_name,
        target_role=body.target_role,
        api_key=api_key,
    )
    return {"evaluation_id": evaluation_id, "cold_message": result.get("cold_message", result)}


@router.post("/evaluate/pdf")
async def evaluate_pdf_resume(
    file: UploadFile = File(...),
    job_description: str = Form(...),
    target_role: str = Form("Software Engineer"),
    formatting_preference: str = Form("standard"),
    current_user=Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    content = await file.read()
    resume_text = extract_pdf_text(content)
    if not resume_text:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")
    basics = current_user.get("profile", {}).get("basics")
    if not basics:
        raise HTTPException(status_code=400, detail="Profile basics required before evaluation")
    db = get_db()
    usage = await get_user_current_usage(db, current_user["id"])
    limit = await get_user_evaluation_limit(db, current_user["id"])
    if usage["month"] >= limit:
        raise HTTPException(status_code=429, detail=f"Evaluation limit reached ({limit}/month)")
    api_key = get_api_key()
    result = await evaluate_with_loop(
        resume_text,
        job_description,
        target_role,
        formatting_preference,
        api_key,
        user_basics=basics,
    )
    evaluation = EvaluationResult(
        original_resume_text=result.get("original_resume_text", resume_text),
        initial_resume_json=result.get("initial_resume_json", {}),
        resume_json=result.get("resume_json", {}),
        jd_json=result.get("jd_json", {}),
        job_description=job_description,
        target_role=target_role,
        formatting_preference=formatting_preference,
        ats_analysis=result.get("ats_analysis", {}),
        ats_result=result.get("ats_result", {}),
        final_verdict=result.get("final_verdict", {}),
        hireability_analysis=result.get("hireability_analysis"),
        contextual_alignment_guidance=result.get("contextual_alignment_guidance"),
        iterations=result.get("iterations", []),
        improvements_summary=result.get("improvements_summary", []),
        ats_pass_threshold=result.get("ats_pass_threshold", 70),
        user_id=current_user["id"],
    )
    doc = evaluation.model_dump()
    await insert_evaluation(db, doc)
    doc.pop("_id", None)
    return doc
