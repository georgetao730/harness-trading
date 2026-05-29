"""DingTalk Alert Channel — push notifications via DingTalk webhook."""

from __future__ import annotations

import json

import httpx
from loguru import logger


class DingTalkAlert:
    """Push alerts to a DingTalk group robot via webhook.

    Config:
      webhook_url: DingTalk robot webhook URL (full URL with access_token)
    """

    name = "dingtalk"

    def __init__(self, webhook_url: str = ""):
        self._webhook_url = webhook_url
        self._client: httpx.AsyncClient | None = None

    async def send(self, title: str, body: str, level: str = "info") -> bool:
        """Send a markdown message to the DingTalk group.

        Falls back to logging if webhook_url is not configured.
        """
        if not self._webhook_url:
            logger.info(f"[DingTalk] {level.upper()}: {title} — {body}")
            return True

        icon = {"info": "📊", "warning": "⚠️", "error": "🚨"}.get(level, "📌")
        text = f"## {icon} {title}\n\n{body}\n\n---\n*Harness Trading · {level}*"

        payload = {
            "msgtype": "markdown",
            "markdown": {"title": title, "text": text},
        }

        try:
            if self._client is None:
                self._client = httpx.AsyncClient(timeout=10.0)
            resp = await self._client.post(self._webhook_url, json=payload)
            ok = resp.status_code == 200
            if not ok:
                logger.warning(f"DingTalk send failed: HTTP {resp.status_code}")
            return ok
        except Exception as e:
            logger.error(f"DingTalk send error: {e}")
            return False
