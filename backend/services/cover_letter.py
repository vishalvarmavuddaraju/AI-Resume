"""Cover letter generation from resume and job description."""
import json
import logging

from fastapi import HTTPException

from llm import parse_json_from_response_text, responses_create_text
from prompt_loader import get_cover_letter_system_prompt, get_cover_letter_user_prompt


async def generate_cover_letter(
    resume_json: dict,
    job_description: str,
    company_name: str,
    target_role: str,
    api_key: str | None,
) -> dict:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")

    system_prompt = get_cover_letter_system_prompt()
    user_prompt = get_cover_letter_user_prompt(
        resume_json=json.dumps(resume_json, indent=2),
        job_description=job_description,
        company_name=company_name,
        target_role=target_role,
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
        logging.error("JSON parse error in cover letter generation: %s, Response: %s", e, response_text)
        raise HTTPException(status_code=500, detail="Failed to parse cover letter response")
    except Exception as e:
        logging.error("Cover letter generation error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
