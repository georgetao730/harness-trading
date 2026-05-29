"""LLM Manager - Provider config loading, routing, and orchestration"""

import os
import re
from pathlib import Path
from typing import Dict, Optional

import yaml
from loguru import logger

from .base import (
    BaseLLMProvider,
    ChatResponse,
    Message,
    ProviderConfig,
    ProviderType,
    TaskType,
)


class LLMManager:
    """Central manager for all LLM providers with smart routing."""

    def __init__(self, config_path: str = "config/providers.yaml"):
        self._providers: Dict[str, BaseLLMProvider] = {}
        self._routing: Dict[str, str] = {}
        self._fallback_chain: list = []
        self._config_path = config_path
        self._load_config()

    def _load_config(self):
        """Load provider configs from YAML file with env var substitution."""
        path = Path(self._config_path)
        if not path.exists():
            # Try from project root
            path = Path(__file__).parent.parent.parent.parent / self._config_path

        if not path.exists():
            logger.warning(f"Config not found: {self._config_path}, using defaults")
            return

        raw = path.read_text(encoding="utf-8")
        raw = self._substitute_env(raw)
        config = yaml.safe_load(raw)

        # Load providers
        for provider_id, cfg in config.get("providers", {}).items():
            if not cfg.get("enabled", True):
                continue
            try:
                self._register_provider(provider_id, cfg)
            except Exception as e:
                logger.warning(f"Failed to register provider '{provider_id}': {e}")

        # Load routing rules
        routing_section = config.get("routing", {})
        self._routing = {k: v for k, v in routing_section.items() if k != "fallback_chain"}
        self._fallback_chain = routing_section.get("fallback_chain", [])

        logger.info(f"Loaded {len(self._providers)} LLM providers: {list(self._providers.keys())}")

    @staticmethod
    def _substitute_env(text: str) -> str:
        """Replace ${VAR_NAME} with environment variable values."""
        def replacer(match):
            var_name = match.group(1)
            return os.environ.get(var_name, "")
        return re.sub(r'\$\{(\w+)\}', replacer, text)

    def _register_provider(self, provider_id: str, cfg: dict):
        """Create and register a provider instance."""
        provider_type = ProviderType(cfg["provider"])

        provider_config = ProviderConfig(
            id=provider_id,
            name=cfg.get("name", provider_id),
            provider=provider_type,
            model=cfg["model"],
            api_key=cfg.get("api_key"),
            base_url=cfg.get("base_url"),
            max_tokens=cfg.get("max_tokens", 4096),
            temperature=cfg.get("temperature", 0.3),
        )

        if provider_type == ProviderType.ANTHROPIC:
            try:
                from .providers.implementations import AnthropicProvider
                provider = AnthropicProvider(provider_config)
            except ImportError:
                logger.warning(f"Anthropic SDK not installed, skipping provider '{provider_id}'")
                return
        elif provider_type == ProviderType.GOOGLE:
            try:
                from .providers.implementations import GoogleProvider
                provider = GoogleProvider(provider_config)
            except ImportError:
                logger.warning(f"Google genai SDK not installed, skipping provider '{provider_id}'")
                return
        else:
            try:
                from .providers.implementations import OpenAICompatProvider
                provider = OpenAICompatProvider(provider_config)
            except ImportError:
                logger.warning(f"OpenAI SDK not installed, skipping provider '{provider_id}'")
                return

        self._providers[provider_id] = provider

    def get_provider(self, task_type: Optional[TaskType] = None, provider_id: Optional[str] = None) -> BaseLLMProvider:
        """Get a provider by task type routing or direct ID."""
        # Direct provider selection
        if provider_id and provider_id in self._providers:
            return self._providers[provider_id]

        # Task-based routing
        if task_type:
            target = self._routing.get(task_type.value, self._fallback_chain[0] if self._fallback_chain else None)
            if target and target in self._providers:
                return self._providers[target]

            # Try fallback chain
            for fallback in self._fallback_chain:
                if fallback in self._providers:
                    return self._providers[fallback]

        # Return any available provider
        if self._providers:
            return next(iter(self._providers.values()))

        raise RuntimeError("No LLM provider available")

    async def chat(
        self,
        messages: list[Message],
        task_type: Optional[TaskType] = None,
        provider_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> ChatResponse:
        """Send a chat request through the appropriate provider."""
        provider = self.get_provider(task_type=task_type, provider_id=provider_id)
        logger.info(f"Chat via [{provider.provider_name}] model={provider.model_name}")
        return await provider.chat(messages, system_prompt=system_prompt, **kwargs)

    async def stream(
        self,
        messages: list[Message],
        task_type: Optional[TaskType] = None,
        provider_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        **kwargs,
    ):
        """Stream chat through the appropriate provider."""
        provider = self.get_provider(task_type=task_type, provider_id=provider_id)
        async for token in provider.stream(messages, system_prompt=system_prompt, **kwargs):
            yield token

    @property
    def available_providers(self) -> Dict[str, ProviderConfig]:
        return {pid: p.config for pid, p in self._providers.items()}

    def reload_config(self):
        """Hot-reload provider config."""
        self._providers.clear()
        self._load_config()


# Global instance
llm_manager = LLMManager()
