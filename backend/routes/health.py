"""Health and root endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "Resume Evaluator API"}


@router.get("/health")
async def health():
    return {"status": "healthy"}
