"""Harness Trading - FastAPI Application"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .core.config import settings
from .core.events import event_bus


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info(f"Starting {settings.app_name} in {settings.app_env} mode")

    # Scan skills/ directory and auto-register skills (Phase 2 directory-based)
    from .skills import scan_and_register

    scan_and_register()

    # Register gateway dispatch methods (skill.invoke, etc.)
    from .gateway.methods import register_all_builtin_methods

    register_all_builtin_methods()

    # Bootstrap channels from config/channels.yaml (feed/alert/broker)
    from .channels.bootstrap import bootstrap_channels

    bootstrap_channels()

    # Scan workflows/ directory and register workflows
    from .workflows.engine import workflow_registry

    wf_count = workflow_registry.scan(Path(__file__).parent.parent.parent)
    logger.info(f"Workflows loaded: {wf_count}")

    # Scan agents/ directory and register agent roles
    from .agent.roles import agent_registry

    ag_count = agent_registry.scan(Path(__file__).parent.parent.parent)
    logger.info(f"Agent roles loaded: {ag_count}")

    # Bootstrap knowledge garden (BM25 index from knowledge/ directory)
    from .knowledge.garden import get_garden

    root = Path(__file__).parent.parent.parent
    garden = get_garden(root)
    k_count = garden.index_all()
    logger.info(f"Knowledge entries indexed: {k_count}")

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

# Register Gateway WebSocket bridge (Node ↔ Python)
from .gateway.server import router as gateway_router  # noqa

app.include_router(gateway_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}
