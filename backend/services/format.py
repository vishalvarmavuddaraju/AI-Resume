"""Resume extraction to structured JSON."""
import json
import logging

from fastapi import HTTPException

from llm import parse_json_from_response_text, responses_create_text
from prompt_loader import get_format_resume_system_prompt, get_format_resume_user_prompt, get_format_jd_system_prompt, get_format_jd_user_prompt


async def format_resume_json(resume_text: str, api_key: str | None) -> dict:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")
    system_prompt = get_format_resume_system_prompt()
    user_prompt = get_format_resume_user_prompt(resume_text)
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
        logging.error("JSON parse error in extract_resume: %s, Response: %s", e, response_text)
        raise HTTPException(status_code=500, detail="Failed to parse resume extraction response")
    except Exception as e:
        logging.error("Resume extraction error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

async def format_jd_json(job_description: str, api_key: str | None) -> dict:
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured. Please add your OpenAI API key.")
    system_prompt = get_format_jd_system_prompt()
    user_prompt = get_format_jd_user_prompt(job_description)
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
        logging.error("JSON parse error in extract_jd: %s, Response: %s", e, response_text)
        raise HTTPException(status_code=500, detail="Failed to parse job description extraction response")
    except Exception as e:
        logging.error("Job description extraction error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))