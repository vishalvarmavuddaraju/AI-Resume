"""Pydantic models for API request/response contracts."""
from datetime import datetime, timezone
from typing import List, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EvaluationRequest(BaseModel):
    resume_text: str
    job_description: str
    target_role: str = "Software Engineer"
    formatting_preference: str = "standard"  # standard, star, metrics-heavy


class EvaluationResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    original_resume_text: str
    initial_resume_json: dict
    resume_json: dict
    jd_json: dict
    job_description: str
    target_role: str
    formatting_preference: str
    ats_analysis: dict
    ats_result: dict
    final_verdict: dict
    hireability_analysis: dict | None = None
    contextual_alignment_guidance: dict | None = None
    iterations: list[dict] = Field(default_factory=list)
    improvements_summary: list[dict] = Field(default_factory=list)
    ats_pass_threshold: int = 70
    user_id: str | None = None


class HistoryItem(BaseModel):
    id: str
    timestamp: str
    target_role: str
    ats_score: int
    hireability_score: int
    interview_probability: str
    preview: str


class LatexFromJsonRequest(BaseModel):
    """Request body for generating LaTeX from custom resume_json (e.g. after manual edits)."""
    resume_json: dict
    template: str = "1page"


class UpdateResumeJsonRequest(BaseModel):
    """Request body for persisting edited resume_json to the database."""
    resume_json: dict


class CoverLetterRequest(BaseModel):
    """Request body for generating a cover letter from evaluation data."""
    resume_json: dict
    job_description: str
    company_name: str = ""
    target_role: str = "Software Engineer"


class ColdMessageRequest(BaseModel):
    """Request body for generating a LinkedIn cold referral message."""
    resume_json: dict
    job_description: str
    company_name: str = ""
    target_role: str = "Software Engineer"


class BasicsLink(BaseModel):
    label: str
    url: str


class BasicsProfile(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=3, max_length=255)
    links: list[BasicsLink] = Field(default_factory=list)


class UserProfile(BaseModel):
    basics: BasicsProfile | None = None


class UserQuota(BaseModel):
    evaluation_limit: int = Field(default=50, ge=0, le=10000)


class UserRecord(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["user", "admin"] = "user"
    is_active: bool = True
    profile: UserProfile = Field(default_factory=UserProfile)
    quota: UserQuota = Field(default_factory=UserQuota)
    created_at: str
    updated_at: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRecord


class AuthMeResponse(BaseModel):
    user: UserRecord


class UpdateBasicsRequest(BaseModel):
    basics: BasicsProfile


class AdminUserUpdateRequest(BaseModel):
    role: Literal["user", "admin"] | None = None
    is_active: bool | None = None
    evaluation_limit: int | None = Field(default=None, ge=0, le=10000)

    @model_validator(mode="after")
    def validate_has_any_update(self):
        if self.role is None and self.is_active is None and self.evaluation_limit is None:
            raise ValueError("At least one field must be provided")
        return self


class AdminUsersResponse(BaseModel):
    users: list[UserRecord]
