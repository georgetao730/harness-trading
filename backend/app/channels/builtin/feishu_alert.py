"""Feishu (Lark) Alert Channel — push notifications via Feishu bot webhook."""

from __future__ import annotations

import httpx
from loguru import logger


class FeishuAlert:
    """Push alerts to a Feishu group bot via webhook.

    Config:
      webhook_url: Feishu bot webhook URL (full URL)
    """

    name = "feishu"

    def __init__(self, webhook_url: str = ""):
        self._webhook_url = webhook_url
        self._client: httpx.AsyncClient | None = None

    async def send(self, title: str, body: str, level: str = "info") -> bool:
        """Send interactive card message to Feishu group."""
        if not self._webhook_url:
            logger.info(f"[Feishu] {level.upper()}: {title} — {body}")
            return True

        color_map = {"info": "blue", "warning": "yellow", "error": "red"}
        icon_map = {"info": "📊", "warning": "⚠️", "error": "🚨"}

        payload = {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {
                        "tag": "plain_text",
                        "content": f"{icon_map.get(level, '📌')} {title}",
                    },
                    "template": color_map.get(level, "blue"),
                },
                "elements": [
                    {
                        "tag": "markdown",
                        "content": body,
                    },
                    {
                        "tag": "hr",
                    },
                    {
                        "tag": "note",
                        "elements": [
                            {
                                "tag": "plain_text",
                                "content": f"Harness Trading · {level}",
                            },
                        ],
                    },
                ],
            },
        }

        try:
            if self._client is None:
                self._client = httpx.AsyncClient(timeout=10.0)
            resp = await self._client.post(self._webhook_url, json=payload)
            ok = resp.status_code == 200
            if not ok:
                logger.warning(f"Feishu send failed: HTTP {resp.status_code} body={resp.text[:200]}")
            return ok
        except Exception as e:
            logger.error(f"Feishu send error: {e}")
            return False
