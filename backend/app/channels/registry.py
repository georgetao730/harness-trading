"""Channel registry — manages Feed/Alert/Broker channel instances.

Channels are configured in config/channels.yaml and activated at startup.
The registry provides lookup and lifecycle management.
"""

from __future__ import annotations

from typing import Any

from loguru import logger

from .protocol import AlertChannel, BrokerChannel, FeedChannel


class ChannelRegistry:
    """Central registry for all channel instances."""

    def __init__(self) -> None:
        self._feeds: dict[str, FeedChannel] = {}
        self._alerts: dict[str, AlertChannel] = {}
        self._brokers: dict[str, BrokerChannel] = {}

    # ── Feed ──

    def register_feed(self, channel: FeedChannel) -> None:
        self._feeds[channel.name] = channel
        logger.info(f"Registered feed channel: {channel.name}")

    def get_feed(self, name: str) -> FeedChannel | None:
        return self._feeds.get(name)

    def list_feeds(self) -> dict[str, str]:
        return {k: type(v).__name__ for k, v in self._feeds.items()}

    # ── Alert ──

    def register_alert(self, channel: AlertChannel) -> None:
        self._alerts[channel.name] = channel
        logger.info(f"Registered alert channel: {channel.name}")

    def get_alert(self, name: str) -> AlertChannel | None:
        return self._alerts.get(name)

    def list_alerts(self) -> dict[str, str]:
        return {k: type(v).__name__ for k, v in self._alerts.items()}

    async def broadcast_alert(self, title: str, body: str, level: str = "info") -> dict[str, bool]:
        """Send alert to all registered alert channels."""
        results: dict[str, bool] = {}
        for name, ch in self._alerts.items():
            try:
                results[name] = await ch.send(title, body, level)
            except Exception as e:
                logger.error(f"Alert channel {name} failed: {e}")
                results[name] = False
        return results

    # ── Broker ──

    def register_broker(self, channel: BrokerChannel) -> None:
        self._brokers[channel.name] = channel
        logger.info(f"Registered broker channel: {channel.name}")

    def get_broker(self, name: str | None = None) -> BrokerChannel | None:
        """Get broker by name, or return first/default broker."""
        if name:
            return self._brokers.get(name)
        if self._brokers:
            return next(iter(self._brokers.values()))
        return None

    def list_brokers(self) -> dict[str, str]:
        return {k: type(v).__name__ for k, v in self._brokers.items()}

    # ── Summary ──

    def snapshot(self) -> dict[str, Any]:
        return {
            "feeds": self.list_feeds(),
            "alerts": self.list_alerts(),
            "brokers": self.list_brokers(),
        }


# Global registry singleton
channel_registry = ChannelRegistry()
