"""Channel loader — reads config/channels.yaml and bootstraps channels at startup."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from loguru import logger

from .builtin.dingtalk_alert import DingTalkAlert
from .builtin.eastmoney_feed import EastMoneyFeed
from .paper_broker import PaperBroker
from .registry import channel_registry


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent.parent


def _load_config() -> dict[str, Any]:
    config_path = _project_root() / "config" / "channels.yaml"
    if not config_path.exists():
        logger.warning(f"channels.yaml not found at {config_path}")
        return {}
    return yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}


def _bootstrap_feeds(config: dict[str, Any]) -> int:
    """Instantiate and register feed channels."""
    count = 0
    feeds = config.get("feeds", {})
    for name, cfg in feeds.items():
        if not isinstance(cfg, dict):
            continue
        if not cfg.get("enabled", True):
            logger.info(f"Feed channel '{name}' disabled, skipping")
            continue

        if name == "eastmoney":
            interval = float(cfg.get("poll_interval", 5.0))
            channel = EastMoneyFeed(poll_interval=interval)
            channel_registry.register_feed(channel)
            count += 1
        else:
            logger.warning(f"Unknown feed channel: {name}")
    return count


def _bootstrap_alerts(config: dict[str, Any]) -> int:
    """Instantiate and register alert channels."""
    count = 0
    alerts = config.get("alerts", {})
    for name, cfg in alerts.items():
        if not isinstance(cfg, dict):
            continue
        if not cfg.get("enabled", True):
            logger.info(f"Alert channel '{name}' disabled, skipping")
            continue

        if name == "dingtalk":
            webhook = str(cfg.get("webhook_url", ""))
            channel = DingTalkAlert(webhook_url=webhook)
            channel_registry.register_alert(channel)
            count += 1
        else:
            logger.warning(f"Unknown alert channel: {name}")
    return count


def _bootstrap_brokers(config: dict[str, Any]) -> int:
    """Instantiate and register broker channels."""
    count = 0
    brokers = config.get("brokers", {})
    for name, cfg in brokers.items():
        if not isinstance(cfg, dict):
            continue
        if not cfg.get("enabled", True):
            logger.info(f"Broker channel '{name}' disabled, skipping")
            continue

        if name == "paper":
            from ..execution.paper_trading import PaperTradingEngine

            cash = float(cfg.get("initial_cash", 1_000_000.0))
            engine = PaperTradingEngine(initial_cash=cash)
            channel = PaperBroker(engine=engine)
            channel_registry.register_broker(channel)
            count += 1
        else:
            logger.warning(f"Unknown broker channel: {name}")
    return count


def bootstrap_channels() -> dict[str, int]:
    """Load channels.yaml and register all enabled channels.

    Returns counts: {"feeds": N, "alerts": N, "brokers": N}
    """
    config = _load_config()
    if not config:
        logger.info("No channels.yaml found, using defaults (paper broker only)")

    # Ensure paper broker is always registered even without config
    n_feeds = _bootstrap_feeds(config)
    n_alerts = _bootstrap_alerts(config)
    n_brokers = _bootstrap_brokers(config)

    # Fallback: always register paper broker if nothing registered
    if n_brokers == 0:
        from ..execution.paper_trading import paper_engine

        channel_registry.register_broker(PaperBroker(engine=paper_engine))
        n_brokers = 1
        logger.info("No broker config, registered default paper broker")

    summary = {"feeds": n_feeds, "alerts": n_alerts, "brokers": n_brokers}
    logger.info(f"Channels bootstrapped: {summary}")
    return summary
