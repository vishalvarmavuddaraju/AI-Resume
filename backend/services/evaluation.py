"""Evaluation: score resume, apply improvements, re-evaluate loop."""
import asyncio
import logging
from copy import deepcopy
import json

from fastapi import HTTPException

from llm import parse_json_from_response_text, responses_create_text
from prompt_loader import (
    get_improve_system_prompt,
    get_improve_user_prompt,
    get_review_contextual_alignment_system_prompt,
    get_review_contextual_alignment_user_prompt,
    get_update_resume_json_system_prompt,
    get_update_resume_json_user_prompt,
    get_review_ats_analysis_system_prompt,
    get_review_ats_analysis_user_prompt,
    get_review_hr_analysis_system_prompt,
    get_review_hr_analysis_user_prompt,
)
from config import get_ats_pass_threshold
from services.format import format_resume_json, format_jd_json
from services.ats_scoring import compute_ats_score
from services.normalization import SkillNormalizer


async def get_improvement_suggestions(
    resume_json: dict,
    job_description: str,
    target_role: str,
    formatting_pref: str,
    api_key: str | None,
    ats_score_reasons: dict | None = None,
    contextual_alignment_guidance: dict | None = None,
) -> dict:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")
    system_prompt = get_improve_system_prompt(target_role, formatting_pref)
    user_prompt = get_improve_user_prompt(
        resume_json,
        job_description,
        ats_score_reasons,
        contextual_alignment_guidance,
    )
    response_text = ""
    try:
        response_text = await responses_create_text(
            api_key=api_key,
            instructions=system_prompt,
            input_text=user_prompt,
            model="ultra",
        )
        return parse_json_from_response_text(response_text)
    except json.JSONDecodeError as e:
        logging.error("JSON parse error: %s, Response: %s", e, response_text)
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        logging.error("AI improvement error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


async def apply_improvement_summary_to_resume_json(
    current_resume_json: dict,
    improvement_summary_array: list,
    api_key: str | None,
) -> dict:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")
    system_prompt = get_update_resume_json_system_prompt()
    current_resume_json_str = json.dumps(current_resume_json, indent=2)
    improvement_summary_array_str = json.dumps(improvement_summary_array or [], indent=2)
    user_prompt = get_update_resume_json_user_prompt(current_resume_json_str, improvement_summary_array_str)
    response_text = ""
    try:
        response_text = await responses_create_text(
            api_key=api_key,
            instructions=system_prompt,
            input_text=user_prompt,
            model="mini",
        )
        return parse_json_from_response_text(response_text)
    except json.JSONDecodeError as e:
        logging.error("JSON parse error in resume JSON update: %s, Response: %s", e, response_text)
        return current_resume_json
    except Exception as e:
        logging.error("Resume JSON update error: %s", e)
        return current_resume_json


async def get_ats_analysis(
    norm_jd: dict,
    norm_resume: dict,
    api_key: str | None,
) -> dict:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")
    system_prompt = get_review_ats_analysis_system_prompt()
    user_prompt = get_review_ats_analysis_user_prompt(norm_jd, norm_resume)
    response_text = ""
    try:
        response_text = await responses_create_text(
            api_key=api_key,
            instructions=system_prompt,
            input_text=user_prompt,
            model="ultra",
        )
        return parse_json_from_response_text(response_text)
    except json.JSONDecodeError as e:
        logging.error("JSON parse error in ATS analysis: %s, Response: %s", e, response_text)
        raise HTTPException(status_code=500, detail="Failed to parse ATS analysis response")
    except Exception as e:
        logging.error("ATS analysis error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


async def get_hireability_analysis(
    job_description: str,
    resume_json: dict,
    api_key: str | None,
) -> dict | None:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")
    system_prompt = get_review_hr_analysis_system_prompt()
    user_prompt = get_review_hr_analysis_user_prompt(job_description, resume_json)
    response_text = ""
    try:
        response_text = await responses_create_text(
            api_key=api_key,
            instructions=system_prompt,
            input_text=user_prompt,
            model="ultra",
        )
        return parse_json_from_response_text(response_text)
    except json.JSONDecodeError as e:
        logging.error("JSON parse error in hireability analysis: %s, Response: %s", e, response_text)
        return None
    except Exception as e:
        logging.error("Hireability analysis error: %s", e)
        return None


async def get_contextual_alignment_guidance(
    resume_text: str,
    job_description: str,
    target_role: str,
    api_key: str | None,
) -> dict | None:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")
    system_prompt = get_review_contextual_alignment_system_prompt()
    user_prompt = get_review_contextual_alignment_user_prompt(target_role, job_description, resume_text)
    response_text = ""
    try:
        response_text = await responses_create_text(
            api_key=api_key,
            instructions=system_prompt,
            input_text=user_prompt,
            model="mini",
        )
        return parse_json_from_response_text(response_text)
    except json.JSONDecodeError as e:
        logging.error("JSON parse error in contextual alignment guidance: %s, Response: %s", e, response_text)
        return None
    except Exception as e:
        logging.error("Contextual alignment guidance error: %s", e)
        return None


async def evaluate_with_loop(
    resume_text: str,
    job_description: str,
    target_role: str,
    formatting_pref: str,
    api_key: str | None,
    max_iterations: int = 3,
    user_basics: dict | None = None,
) -> dict:
    ats_pass_threshold = get_ats_pass_threshold()
    # Step 1: format resume and JD in parallel
    logging.info("Formatting resume and JD in parallel...")
    resume_json, jd_json = await asyncio.gather(
        format_resume_json(resume_text, api_key),
        format_jd_json(job_description, api_key),
    )
    basics = user_basics if user_basics is not None else await load_basics()

    initial_resume_json = deepcopy(resume_json)
    current_resume_json = resume_json

    # Step 2: normalize both
    normalizer = SkillNormalizer()
    norm_jd, norm_resume, _, _ = normalizer.normalize_pair(jd_json, current_resume_json)

    iterations = []
    ats_analysis = None
    ats_result = None
    pending_improvements = None
    all_improvements: list[dict] = []
    contextual_alignment_guidance: dict | None = None

    for iteration in range(1, max_iterations + 1):
        logging.info("Evaluation iteration %d", iteration)

        # Step 3: ATS analysis → score
        ats_analysis = await get_ats_analysis(norm_jd, norm_resume, api_key)
        ats_result = compute_ats_score(ats_analysis)
        ats_score = ats_result.get("final_score", 0)

        iteration_record = {
            "iteration": iteration,
            "ats_score": ats_score
        }
        if pending_improvements:
            iteration_record["improvements_made"] = pending_improvements
            pending_improvements = None

        iterations.append(iteration_record)

        # Step 3a: score passes threshold — generate HR analysis and return
        if ats_score >= ats_pass_threshold:
            logging.info(
                "ATS score %d >= %d at iteration %d, generating HR analysis",
                ats_score,
                ats_pass_threshold,
                iteration,
            )

            hireability_analysis = await get_hireability_analysis(job_description, current_resume_json, api_key)
            return _build_result(
                resume_text, initial_resume_json, current_resume_json, jd_json,
                ats_analysis,
                ats_result,
                hireability_analysis,
                iterations,
                basics,
                all_improvements,
                contextual_alignment_guidance,
                ats_pass_threshold,
            )

        # Step 3b: score below threshold — run improvement pipeline (skip on last iteration)
        if iteration < max_iterations:
            logging.info(
                "ATS score %d < %d at iteration %d, running improvement pipeline...",
                ats_score,
                ats_pass_threshold,
                iteration,
            )
            if contextual_alignment_guidance is None:
                contextual_alignment_guidance = await get_contextual_alignment_guidance(
                    resume_text, job_description, target_role, api_key
                )
            
            ats_score_reasons = {}
            breakdown = ats_result.get("score_breakdown", {})
            weights = ats_result.get("normalized_weights", {})
            phases = ats_result.get("phase_scores", {})
            for key, weight_key in [
                ("must_have", "must_have"),
                ("experience_years", "experience_years"),
                ("cloud", "cloud"),
                ("preferred", "preferred"),
                ("experience_depth", "experience_depth"),
                ("education", "education"),
            ]:
                if weights.get(weight_key, 0) > 0 and phases.get(weight_key, 1.0) < 1.0:
                    ats_score_reasons[key] = breakdown.get(key, {}).get("reason", "")

            improvements = await get_improvement_suggestions(
                current_resume_json,
                job_description,
                target_role,
                formatting_pref,
                api_key,
                ats_score_reasons,
                contextual_alignment_guidance,
            )

            improvement_summary = improvements.get("resume_improvements", {}).get("improvement_summary", [])
            pending_improvements = [imp.get("issue", "") for imp in improvement_summary]
            all_improvements.extend(improvement_summary)

            improvement_summary_array = [
                {
                    "original": imp.get("original", ""),
                    "improved": imp.get("improved", ""),
                    "section": imp.get("section", "")
                }
                for imp in improvement_summary
            ]

            # Step 4: apply improvements → re-normalize
            current_resume_json = await apply_improvement_summary_to_resume_json(
                current_resume_json, improvement_summary_array, api_key,
            )
            norm_jd, norm_resume, _, _ = normalizer.normalize_pair(jd_json, current_resume_json)
        else:
            logging.info("Max iterations reached. Final ATS score: %d", ats_score)

    # Exhausted all iterations — still return the best result we have
    logging.info("Generating HR analysis after exhausting iterations...")
    hireability_analysis = await get_hireability_analysis(job_description, current_resume_json, api_key)
    return _build_result(
        resume_text, initial_resume_json, current_resume_json, jd_json,
        ats_analysis,
        ats_result,
        hireability_analysis,
        iterations,
        basics,
        all_improvements,
        contextual_alignment_guidance,
        ats_pass_threshold,
    )


async def load_basics() -> dict:
    """Default basics loader used by tests and non-auth callers."""
    return {}

def _build_result(
    original_resume_text: str,
    initial_resume_json: dict,
    resume_json: dict,
    jd_json: dict,
    ats_analysis: dict,
    ats_result: dict,
    hireability_analysis: dict | None,
    iterations: list,
    basics: dict | None = None,
    improvements_summary: list[dict] | None = None,
    contextual_alignment_guidance: dict | None = None,
    ats_pass_threshold: int = 70,
) -> dict:
    if basics and "resume" in resume_json:
        resume_json["resume"]["basics"] = basics
    final_recommendation = {}
    if isinstance(hireability_analysis, dict):
        final_recommendation = hireability_analysis.get("final_recommendation", {}) or {}
    return {
        "original_resume_text": original_resume_text,
        "initial_resume_json": initial_resume_json,
        "resume_json": resume_json,
        "jd_json": jd_json,
        "ats_analysis": ats_analysis,
        "ats_result": ats_result,
        "hireability_analysis": hireability_analysis,
        "iterations": iterations,
        "final_verdict": final_recommendation,
        "improvements_summary": improvements_summary or [],
        "contextual_alignment_guidance": contextual_alignment_guidance,
        "ats_pass_threshold": ats_pass_threshold,
    }
