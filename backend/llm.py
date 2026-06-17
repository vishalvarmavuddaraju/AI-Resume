"""OpenAI client: model selection, response create, text/JSON extraction."""
import json
import os
from typing import Any, Optional

from openai import AsyncOpenAI


def get_openai_model() -> str:
    return os.environ.get("OPENAI_MODEL", os.environ.get("OPENAI_MODEL_MINI", "gpt-4o-mini"))


def select_model(model: Optional[str]) -> str:
    if not model or not str(model).strip():
        return get_openai_model()
    m = str(model).strip().lower()
    if m == "mini":
        return os.environ.get("OPENAI_MODEL_MINI", get_openai_model())
    if m == "ultra":
        return os.environ.get("OPENAI_MODEL_ULTRA", get_openai_model())
    return str(model).strip()


def extract_response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text
    try:
        chunks = []
        for item in getattr(response, "output", []) or []:
            for content in getattr(item, "content", []) or []:
                text = getattr(content, "text", None)
                if isinstance(text, str) and text:
                    chunks.append(text)
        return "\n".join(chunks).strip()
    except Exception:
        return str(response).strip()


async def responses_create(
    *,
    api_key: str,
    instructions: str,
    input_text: str,
    model: Optional[str] = None,
    previous_response_id: Optional[str] = None,
):
    client = AsyncOpenAI(api_key=api_key)
    return await client.responses.create(
        model=select_model(model),
        instructions=instructions,
        input=input_text,
        previous_response_id=previous_response_id,
    )


async def responses_create_text(
    *,
    api_key: str,
    instructions: str,
    input_text: str,
    model: Optional[str] = None,
    previous_response_id: Optional[str] = None,
) -> str:
    response = await responses_create(
        api_key=api_key,
        instructions=instructions,
        input_text=input_text,
        model=model,
        previous_response_id=previous_response_id,
    )
    return extract_response_text(response)


async def responses_create_text_and_id(
    *,
    api_key: str,
    instructions: str,
    input_text: str,
    model: Optional[str] = None,
    previous_response_id: Optional[str] = None,
) -> tuple[str, Optional[str]]:
    response = await responses_create(
        api_key=api_key,
        instructions=instructions,
        input_text=input_text,
        model=model,
        previous_response_id=previous_response_id,
    )
    return extract_response_text(response), getattr(response, "id", None)


def parse_json_from_response_text(response_text: str) -> dict:
    response_text = (response_text or "").strip()
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]
    return json.loads(response_text)
