"""Autopilot FastAPI service entry point — runs on its own port (default 8766).

Lifespan:
  - Init local SQLite (autopilot.db)
  - Start the APScheduler tick
  - On shutdown, stop the scheduler

Routes are mounted unprefixed (this service has no other concerns):
  GET  /health
  GET  /config         PUT /config
  GET  /runs           POST /run-now
  GET  /heal           GET /contacts
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as autopilot_router
from .config import logger, settings
from .db import init_db
from .scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info(f"Autopilot starting on port {settings.autopilot_port}")
    await init_db()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Autopilot shutting down")


app = FastAPI(
    title="HEAL Autopilot",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "healthy",
        "service": "heal-autopilot",
        "anthropic_configured": bool(settings.anthropic_api_key),
        "nucleus_backend_url": settings.nucleus_backend_url,
        "tick_minutes": settings.autopilot_tick_minutes,
    }


app.include_router(autopilot_router)
