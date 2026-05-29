"""OpenAI-compatible provider (OpenAI, DeepSeek, Qwen, GLM, Moonshot, Ollama)"""

from typing import AsyncIterator, List, Optional
from loguru import logger

from ..base import BaseLLMProvider, ChatResponse, Message, ProviderConfig


class OpenAICompatProvider(BaseLLMProvider):
    """Provider for any OpenAI-compatible API (covers 80% of providers)."""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        from openai import AsyncOpenAI
        self._client = AsyncOpenAI(
            api_key=config.api_key or "not-needed",
            base_url=config.base_url or "https://api.openai.com/v1",
        )

    async def chat(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> ChatResponse:
        formatted = self._format_messages(messages, system_prompt)
        logger.debug(f"[{self.provider_name}] Chat: {self.model_name}")

        response = await self._client.chat.completions.create(
            model=self.config.model,
            messages=formatted,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
        )

        choice = response.choices[0]
        return ChatResponse(
            content=choice.message.content or "",
            model=response.model,
            provider=self.provider_name,
            usage={
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            },
            finish_reason=choice.finish_reason or "stop",
        )

    async def stream(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> AsyncIterator[str]:
        formatted = self._format_messages(messages, system_prompt)

        stream = await self._client.chat.completions.create(
            model=self.config.model,
            messages=formatted,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def _format_messages(self, messages: List[Message], system_prompt: Optional[str] = None) -> list:
        formatted = []
        if system_prompt:
            formatted.append({"role": "system", "content": system_prompt})
        for msg in messages:
            formatted.append({"role": msg.role, "content": msg.content})
        return formatted


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider via Messages API."""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        from anthropic import AsyncAnthropic
        self._client = AsyncAnthropic(api_key=config.api_key)

    async def chat(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> ChatResponse:
        logger.debug(f"[anthropic] Chat: {self.model_name}")

        # Convert messages for Anthropic format
        formatted = []
        for msg in messages:
            if msg.role != "system":
                formatted.append({"role": msg.role, "content": msg.content})

        response = await self._client.messages.create(
            model=self.config.model,
            messages=formatted,
            system=system_prompt or "",
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
        )

        text = ""
        for block in response.content:
            if block.type == "text":
                text += block.text

        return ChatResponse(
            content=text,
            model=response.model,
            provider="anthropic",
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )

    async def stream(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> AsyncIterator[str]:
        formatted = []
        for msg in messages:
            if msg.role != "system":
                formatted.append({"role": msg.role, "content": msg.content})

        async with self._client.messages.stream(
            model=self.config.model,
            messages=formatted,
            system=system_prompt or "",
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
        ) as stream:
            async for text in stream.text_stream:
                yield text


class GoogleProvider(BaseLLMProvider):
    """Google Gemini provider."""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        from google import genai
        self._client = genai.Client(api_key=config.api_key)

    async def chat(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> ChatResponse:
        logger.debug(f"[google] Chat: {self.model_name}")
        from google.genai import types

        config_gen = types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
        )

        contents = []
        for msg in messages:
            contents.append(
                types.Content(
                    role="user" if msg.role == "user" else "model",
                    parts=[types.Part.from_text(text=msg.content)],
                )
            )

        response = await self._client.aio.models.generate_content(
            model=self.config.model,
            contents=contents,
            config=config_gen,
        )

        return ChatResponse(
            content=response.text or "",
            model=self.config.model,
            provider="google",
        )

    async def stream(
        self,
        messages: List[Message],
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> AsyncIterator[str]:
        from google.genai import types

        config_gen = types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
        )

        contents = []
        for msg in messages:
            contents.append(
                types.Content(
                    role="user" if msg.role == "user" else "model",
                    parts=[types.Part.from_text(text=msg.content)],
                )
            )

        async for chunk in await self._client.aio.models.generate_content_stream(
            model=self.config.model,
            contents=contents,
            config=config_gen,
        ):
            if chunk.text:
                yield chunk.text
