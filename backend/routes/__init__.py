"""API route modules."""
from fastapi import APIRouter

from . import admin, auth, evaluate, health, history, user

api_router = APIRouter(prefix="/api")

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(user.router, tags=["user"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(evaluate.router, tags=["evaluate"])
api_router.include_router(history.router, tags=["history"])
