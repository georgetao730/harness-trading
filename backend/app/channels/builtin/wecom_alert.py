"""WeChat Work (企业微信) Alert Channel — push notifications via bot webhook."""

from __future__ import annotations

import httpx
from loguru import logger


class WeComAlert:
    """Push alerts to a WeChat Work group bot via webhook.

    Config:
      webhook_url: WeCom bot webhook URL with key parameter
    """

    name = "wecom"

    def __init__(self, webhook_url: str = ""):
        self._webhook_url = webhook_url
        self._client: httpx.AsyncClient | None = None

    async def send(self, title: str, body: str, level: str = "info") -> bool:
        """Send markdown message to WeChat Work group."""
        if not self._webhook_url:
            logger.info(f"[WeCom] {level.upper()}: {title} — {body}")
            return True

        icon = {"info": "📊", "warning": "⚠️", "error": "🚨"}.get(level, "📌")
        color_info = {
            "info": 'info',
            "warning": 'warning',
            "error": 'warning',
        }.get(level, 'info')

        markdown = (
            f"# {icon} {title}\n"
            f'> Harness Trading · <font color="{color_info}">{level.upper()}</font>\n\n'
            f"{body}\n"
        )

        payload = {
            "msgtype": "markdown",
            "markdown": {"content": markdown},
        }

        try:
            if self._client is None:
                self._client = httpx.AsyncClient(timeout=10.0)
            resp = await self._client.post(self._webhook_url, json=payload)
            ok = resp.status_code == 200
            if not ok:
                logger.warning(f"WeCom send failed: HTTP {resp.status_code}")
            return ok
        except Exception as e:
            logger.error(f"WeCom send error: {e}")
            return False
