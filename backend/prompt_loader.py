"""
Module for loading prompts and templates from files.
"""
from pathlib import Path
from typing import Dict

ROOT_DIR = Path(__file__).parent
PROMPTS_DIR = ROOT_DIR / "resources/prompts"
IMPROVE_PROMPTS_DIR = PROMPTS_DIR / "improve"
FORMAT_PROMPTS_DIR = PROMPTS_DIR / "format"
REVIEW_PROMPTS_DIR = PROMPTS_DIR / "review"
COVERLETTER_PROMPTS_DIR = PROMPTS_DIR / "coverletter"
COLDMESSAGE_PROMPTS_DIR = PROMPTS_DIR / "coldmessage"

TEMPLATES_DIR = ROOT_DIR / "resources/templates"


def load_prompt(filename: str, prompt_dir: Path = PROMPTS_DIR) -> str:
    """Load a prompt from the prompts directory."""
    prompt_path = prompt_dir / filename
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")


def load_template(filename: str) -> str:
    """Load a template from the templates directory."""
    template_path = TEMPLATES_DIR / filename
    if not template_path.exists():
        raise FileNotFoundError(f"Template file not found: {template_path}")
    return template_path.read_text(encoding="utf-8")


def format_prompt(template: str, **kwargs) -> str:
    """Format a prompt template with provided variables.
    Supports both {VAR_NAME} and <<<VAR_NAME>>> syntax.
    """
    # Convert <<<VAR_NAME>>> to {VAR_NAME} for Python format
    import re
    formatted_template = re.sub(r'<<<(\w+)>>>', r'{\1}', template)
    return formatted_template.format(**kwargs)


# Cache loaded prompts and templates
_prompt_cache: Dict[str, str] = {}
_template_cache: Dict[str, str] = {}


def get_improve_system_prompt(target_role: str, formatting_pref: str) -> str:
    """Get the improve system prompt with variables filled based on formatting preference."""
    # Normalize formatting preference to match filename
    formatting_pref_normalized = formatting_pref.lower().replace("-", "_")
    
    # Map formatting preferences to prompt files
    prompt_filename = f"improve_system_{formatting_pref_normalized}.txt"
    
    cache_key = f"improve_system_{formatting_pref_normalized}"
    if cache_key not in _prompt_cache:
        _prompt_cache[cache_key] = load_prompt(prompt_filename, IMPROVE_PROMPTS_DIR)
    
    return format_prompt(
        _prompt_cache[cache_key],
        TARGET_ROLE=target_role
    )

def get_improve_user_prompt(
    resume_json: str,
    job_description: str,
    ats_score_reasons: dict | None = None,
    contextual_alignment_guidance: dict | None = None,
) -> str:
    """Get the evaluation user prompt with variables filled."""
    if "improve_user" not in _prompt_cache:
        _prompt_cache["improve_user"] = load_prompt("improve_user.txt", IMPROVE_PROMPTS_DIR)
    
    if ats_score_reasons:
        ats_score_reasons_str = ats_score_reasons
    else:
        ats_score_reasons_str = "No information provided about ATS score reasons"
    if contextual_alignment_guidance:
        contextual_alignment_guidance_str = contextual_alignment_guidance
    else:
        contextual_alignment_guidance_str = "No contextual alignment guidance provided"
    return format_prompt(
        _prompt_cache["improve_user"],
        RESUME_JSON=resume_json,
        JOB_DESCRIPTION=job_description,
        ATS_SCORE_REASONS=ats_score_reasons_str,
        CONTEXTUAL_ALIGNMENT_GUIDANCE=contextual_alignment_guidance_str,
    )


def get_format_resume_system_prompt() -> str:
    """Get the extract resume system prompt."""
    if "format_resume_system" not in _prompt_cache:
        _prompt_cache["format_resume_system"] = load_prompt("extract_resume_system.txt", FORMAT_PROMPTS_DIR)
    return _prompt_cache["format_resume_system"]


def get_format_resume_user_prompt(resume_text: str) -> str:
    """Get the extract resume user prompt with variables filled."""
    if "format_resume_user" not in _prompt_cache:
        _prompt_cache["format_resume_user"] = load_prompt("extract_resume_user.txt", FORMAT_PROMPTS_DIR)
    
    return format_prompt(
        _prompt_cache["format_resume_user"],
        RESUME_TEXT=resume_text
    )
    
def get_update_resume_json_system_prompt() -> str:
    """Get the resume JSON update system prompt."""
    if "update_resume_json_system" not in _prompt_cache:
        _prompt_cache["update_resume_json_system"] = load_prompt("update_resume_json_system.txt", FORMAT_PROMPTS_DIR)
    return _prompt_cache["update_resume_json_system"]


def get_update_resume_json_user_prompt(current_resume_json: str, improve_summary_array: str) -> str:
    """Get the resume JSON update user prompt with variables filled."""
    if "update_resume_json_user" not in _prompt_cache:
        _prompt_cache["update_resume_json_user"] = load_prompt("update_resume_json_user.txt", FORMAT_PROMPTS_DIR)

    return format_prompt(
        _prompt_cache["update_resume_json_user"],
        CURRENT_RESUME_JSON=current_resume_json,
        IMPROVEMENT_SUMMARY_ARRAY=improve_summary_array,
    )

def get_format_jd_system_prompt() -> str:
    """Get the extract JD system prompt."""
    if "format_jd_system" not in _prompt_cache:
        _prompt_cache["format_jd_system"] = load_prompt("extract_jd_system.txt", FORMAT_PROMPTS_DIR)
    return _prompt_cache["format_jd_system"]

def get_format_jd_user_prompt(job_description: str) -> str:
    """Get the format JD user prompt with variables filled."""
    if "format_jd_user" not in _prompt_cache:
        _prompt_cache["format_jd_user"] = load_prompt("extract_jd_user.txt", FORMAT_PROMPTS_DIR)
    
    return format_prompt(
        _prompt_cache["format_jd_user"],
        JOB_DESCRIPTION=job_description,
    )

def get_review_ats_analysis_system_prompt() -> str:
    """Get the review ATS analysis system prompt."""
    if "review_ats_analysis_system" not in _prompt_cache:
        _prompt_cache["review_ats_analysis_system"] = load_prompt("generate_ats_analysis_system.txt", REVIEW_PROMPTS_DIR)
    return _prompt_cache["review_ats_analysis_system"]

def get_review_ats_analysis_user_prompt(job_description: str, resume_json: str) -> str:
    """Get the review ATS analysis user prompt with variables filled."""
    if "review_ats_analysis_user" not in _prompt_cache:
        _prompt_cache["review_ats_analysis_user"] = load_prompt("generate_ats_analysis_user.txt", REVIEW_PROMPTS_DIR)
    return format_prompt(
        _prompt_cache["review_ats_analysis_user"],
        JOB_DESCRIPTION=job_description,
        RESUME_JSON=resume_json
    )
    
def get_review_hr_analysis_system_prompt() -> str:
    """Get the review HR analysis system prompt."""
    if "review_hr_analysis_system" not in _prompt_cache:
        _prompt_cache["review_hr_analysis_system"] = load_prompt("generate_hr_analysis_system.txt", REVIEW_PROMPTS_DIR)
    return _prompt_cache["review_hr_analysis_system"]

def get_review_hr_analysis_user_prompt(job_description: str, resume_json: str) -> str:
    """Get the review HR analysis user prompt with variables filled."""
    if "review_hr_analysis_user" not in _prompt_cache:
        _prompt_cache["review_hr_analysis_user"] = load_prompt("generate_hr_analysis_user.txt", REVIEW_PROMPTS_DIR)
    return format_prompt(
        _prompt_cache["review_hr_analysis_user"],
        JOB_DESCRIPTION=job_description,
        RESUME_JSON=resume_json
    )


def get_review_contextual_alignment_system_prompt() -> str:
    """Get the contextual alignment system prompt."""
    if "review_contextual_alignment_system" not in _prompt_cache:
        _prompt_cache["review_contextual_alignment_system"] = load_prompt(
            "generate_contextual_alignment_system.txt", REVIEW_PROMPTS_DIR
        )
    return _prompt_cache["review_contextual_alignment_system"]


def get_review_contextual_alignment_user_prompt(
    target_role: str, job_description: str, resume_text: str
) -> str:
    """Get the contextual alignment user prompt with variables filled."""
    if "review_contextual_alignment_user" not in _prompt_cache:
        _prompt_cache["review_contextual_alignment_user"] = load_prompt(
            "generate_contextual_alignment_user.txt", REVIEW_PROMPTS_DIR
        )
    return format_prompt(
        _prompt_cache["review_contextual_alignment_user"],
        TARGET_ROLE=target_role,
        JOB_DESCRIPTION=job_description,
        RESUME_TEXT=resume_text,
    )


def get_cold_message_system_prompt() -> str:
    """Get the cold message generation system prompt."""
    if "cold_message_system" not in _prompt_cache:
        _prompt_cache["cold_message_system"] = load_prompt("generate_cold_message_system.txt", COLDMESSAGE_PROMPTS_DIR)
    return _prompt_cache["cold_message_system"]


def get_cold_message_user_prompt(
    resume_json: str, job_description: str, company_name: str, target_role: str, candidate_name: str
) -> str:
    """Get the cold message generation user prompt with variables filled."""
    if "cold_message_user" not in _prompt_cache:
        _prompt_cache["cold_message_user"] = load_prompt("generate_cold_message_user.txt", COLDMESSAGE_PROMPTS_DIR)
    return format_prompt(
        _prompt_cache["cold_message_user"],
        RESUME_JSON=resume_json,
        JOB_DESCRIPTION=job_description,
        COMPANY_NAME=company_name or "Not specified",
        TARGET_ROLE=target_role,
        CANDIDATE_NAME=candidate_name,
    )


def get_cover_letter_system_prompt() -> str:
    """Get the cover letter generation system prompt."""
    if "cover_letter_system" not in _prompt_cache:
        _prompt_cache["cover_letter_system"] = load_prompt("generate_cover_letter_system.txt", COVERLETTER_PROMPTS_DIR)
    return _prompt_cache["cover_letter_system"]


def get_cover_letter_user_prompt(
    resume_json: str, job_description: str, company_name: str, target_role: str
) -> str:
    """Get the cover letter generation user prompt with variables filled."""
    if "cover_letter_user" not in _prompt_cache:
        _prompt_cache["cover_letter_user"] = load_prompt("generate_cover_letter_user.txt", COVERLETTER_PROMPTS_DIR)
    return format_prompt(
        _prompt_cache["cover_letter_user"],
        RESUME_JSON=resume_json,
        JOB_DESCRIPTION=job_description,
        COMPANY_NAME=company_name or "Not specified",
        TARGET_ROLE=target_role,
    )