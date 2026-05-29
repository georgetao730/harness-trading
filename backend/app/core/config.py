"""Harness Trading Backend - Core Configuration"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")


class Settings(BaseSettings):
    # App
    app_name: str = "Harness Trading"
    app_env: str = "development"
    app_debug: bool = True
    app_secret_key: str = "change-me-in-production"

    # Database
    database_url: str = "sqlite+aiosqlite:///./harness.db"
    redis_url: str = "redis://localhost:6379/0"

    # Default trading mode
    default_trading_mode: str = "dry_run"

    # LLM Provider API Keys (loaded from env)
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    moonshot_api_key: Optional[str] = None
    qwen_api_key: Optional[str] = None
    glm_api_key: Optional[str] = None

    # Config paths
    providers_config_path: str = "config/providers.yaml"
    harness_config_path: str = "config/harness.yaml"

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()
