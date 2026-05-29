"""LLM Provider Adapter - Multi-provider unified interface"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Optional
from enum import Enum


class ProviderType(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    DEEPSEEK = "deepseek"
    QWEN = "qwen"
    GLM = "glm"
    MOONSHOT = "moonshot"
    OLLAMA = "ollama"
    OPENAI_COMPAT = "openai_compat"


class TaskType(str, Enum):
    TRADING_DECISION = "trading_decision"
    MARKET_ANALYSIS = "market_analysis"
    NEWS_SUMMARY = "news_summary"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    CHART_ANALYSIS = "chart_analysis"
    REPORT_READING = "report_reading"
    PRIVATE_DATA = "private_data"
    CHAT = "chat"
    REASONING = "reasoning"  # chain-of-thought, multi-step reasoning tasks


@dataclass
class Message:
    role: str  # system, user, assistant
    content: str


@dataclass
class ChatResponse:
    content: str
    model: str
    provider: str
    usage: Dict[str, int] = field(default_factory=dict)
    finish_reason: str = "stop"


@dataclass
class ProviderConfig:
    id: str
    name: str
    provider: ProviderType
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.3
    enabled: bool = True


class BaseLLMProvider(ABC):
    """Abstract base for all LLM providers."""

    def __init__(self, config: ProviderConfig):
        self.config = config

    @abstractmethod
    async def chat(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> ChatResponse:
        """Send a chat completion request."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> AsyncIterator[str]:
        """Stream chat completion tokens."""
        ...

    @property
    def model_name(self) -> str:
        return self.config.model

    @property
    def provider_name(self) -> str:
        return self.config.provider.value
