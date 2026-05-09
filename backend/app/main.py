"""FastAPI application entry point.

Lifespan:
- on startup: ensure DB schema (`init_db`) + optionally seed synthetic Utah data
- on shutdown: nothing for now (engine is module-level singleton)

Router prefixes (all under /api/v1):
- /health
- /talent
- /startup
- /match
- /discover
- /connect
- /auth
- /onboard
- /email
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.connect import router as connect_router
from app.api.discovery import router as discovery_router
from app.api.email import router as email_router
from app.api.health import router as health_router
from app.api.match import router as match_router
from app.api.onboard import router as onboard_router
from app.api.startup import router as startup_router
from app.api.talent import router as talent_router
from app.core.config import settings
from app.database.connection import init_db, session_factory

# Importing this package triggers @register_matcher decorators so the registry
# is hydrated before any request can route through MatchingService.
import app.provider.matching  # noqa: F401

logger = settings.logger


API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        f"Starting {settings.app_name} v{settings.app_version} "
        f"in {settings.environment}"
    )
    await init_db()

    if settings.seed_on_startup:
        from app.seed.utah_synthetic import seed_if_empty

        async with session_factory() as session:
            inserted = await seed_if_empty(session)
            if inserted:
                logger.info(
                    f"Seeded {inserted['talents']} talents, {inserted['startups']} startups, "
                    f"{inserted['talent_extensions']} talent ext, "
                    f"{inserted['startup_extensions']} startup ext, "
                    f"{inserted['talent_follows']}+{inserted['startup_follows']} follows"
                )
            else:
                logger.info("Seed skipped — DB already has rows")

    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(talent_router, prefix=f"{API_PREFIX}/talent", tags=["talent"])
app.include_router(startup_router, prefix=f"{API_PREFIX}/startup", tags=["startup"])
app.include_router(match_router, prefix=f"{API_PREFIX}/match", tags=["match"])
app.include_router(discovery_router, prefix=f"{API_PREFIX}/discover", tags=["discover"])
app.include_router(connect_router, prefix=f"{API_PREFIX}/connect", tags=["connect"])
app.include_router(auth_router, prefix=f"{API_PREFIX}/auth", tags=["auth"])
app.include_router(onboard_router, prefix=f"{API_PREFIX}/onboard", tags=["onboard"])
app.include_router(email_router, prefix=f"{API_PREFIX}/email", tags=["email"])
