"""Harness Trading - FastAPI Application"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .core.config import settings
from .core.events import event_bus


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info(f"Starting {settings.app_name} in {settings.app_env} mode")

    # Import skills to auto-register them
    from .agent.skills import market_data, technical  # noqa

    yield

    logger.info(f"Shutting down {settings.app_name}")


app = FastAPI(
    title=settings.app_name,
    description="AI-powered trading assistant with safety harness",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
# Browser spec rejects allow_origins=["*"] combined with allow_credentials=True,
# so we offer two modes:
#   - default (no CORS_ORIGINS env): open access, no credentials
#   - explicit CORS_ORIGINS="https://a.com,https://b.com": those origins, with credentials
_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
if _cors_env:
    _origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register API routes
from .api import agent, trading, harness  # noqa

app.include_router(agent.router)
app.include_router(trading.router)
app.include_router(harness.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}
