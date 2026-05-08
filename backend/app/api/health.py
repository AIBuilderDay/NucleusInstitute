"""Health check endpoint — no auth, no DB."""

from fastapi import APIRouter

from app.core.config import settings
from app.provider.matching.base import list_matchers

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "default_matcher": settings.default_matcher,
        "available_matchers": list_matchers(),
    }
