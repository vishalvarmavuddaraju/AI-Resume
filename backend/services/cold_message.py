"""LinkedIn cold referral message generation from resume and job description."""
import json
import logging
from pathlib import Path

from fastapi import HTTPException

from llm import parse_json_from_response_text, responses_create_text
from prompt_loader import get_cold_message_system_prompt, get_cold_message_user_prompt

_BASICS_PATH = Path(__file__).resolve().parent.parent / "resources" / "basics.json"


def _load_candidate_name() -> str:
    try:
        data = json.loads(_BASICS_PATH.read_text(encoding="utf-8"))
        return data.get("basics", {}).get("name", "")
    except Exception:
        return ""


async def generate_cold_message(
    resume_json: dict,
    job_description: str,
    company_name: str,
    target_role: str,
    api_key: str | None,
) -> dict:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")

    candidate_name = _load_candidate_name()

    system_prompt = get_cold_message_system_prompt()
    user_prompt = get_cold_message_user_prompt(
        resume_json=json.dumps(resume_json, indent=2),
        job_description=job_description,
        company_name=company_name,
        target_role=target_role,
        candidate_name=candidate_name or "Candidate",
    )

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
        logging.error("JSON parse error in cold message generation: %s, Response: %s", e, response_text)
        raise HTTPException(status_code=500, detail="Failed to parse cold message response")
    except Exception as e:
        logging.error("Cold message generation error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
