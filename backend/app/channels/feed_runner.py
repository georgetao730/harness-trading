"""Feed Runner — starts feed channels as background tasks, pushing events via EventBus."""

from __future__ import annotations

import asyncio
from typing import Any

from loguru import logger

from ..core.events import EventType, event_bus
from .registry import channel_registry


async def _run_feed(name: str, poll_interval: float = 5.0) -> None:
    """Background task that consumes a feed channel stream and publishes events."""
    feed = channel_registry.get_feed(name)
    if feed is None:
        logger.warning(f"Feed {name} not found in registry, skipping")
        return

    logger.info(f"Feed runner started: {name} (interval={poll_interval}s)")

    # Subscribe to a default set of indices
    try:
        await feed.subscribe(["000001.SH", "399001.SZ", "399006.SZ"])
    except Exception as e:
        logger.warning(f"Feed {name} subscribe failed: {e}")

    # Auto-subscribe to watchlist symbols
    try:
        from ...db.database import new_session
        from ...db.models import WatchlistItem
        from sqlalchemy import select

        async with new_session() as db:
            result = await db.execute(select(WatchlistItem.symbol))
            watchlist_symbols = [row[0] for row in result.all()]
            if watchlist_symbols:
                await feed.subscribe(watchlist_symbols)
                logger.info(f"Feed {name} auto-subscribed watchlist: {watchlist_symbols}")
    except Exception as e:
        logger.debug(f"Watchlist auto-subscribe skipped: {e}")

    try:
        async for tick in feed.stream():
            await event_bus.publish(EventType.MARKET_DATA_UPDATED, {
                "source": name,
                "data": tick,
            })
    except asyncio.CancelledError:
        logger.info(f"Feed runner cancelled: {name}")
    except Exception as e:
        logger.error(f"Feed runner {name} error: {e}")


# Track running tasks
_feed_tasks: dict[str, asyncio.Task[None]] = {}


async def start_feed_streams() -> dict[str, bool]:
    """Start all registered feed channels as background tasks.

    Returns {"feed_name": True/False} for each feed.
    """
    feeds = channel_registry.list_feeds()
    results: dict[str, bool] = {}

    for name in feeds:
        if name in _feed_tasks and not _feed_tasks[name].done():
            logger.info(f"Feed {name} already running")
            results[name] = True
            continue

        task = asyncio.create_task(_run_feed(name, poll_interval=5.0))
        _feed_tasks[name] = task
        results[name] = True

    return results


async def stop_feed_streams() -> None:
    """Cancel all running feed background tasks."""
    for name, task in list(_feed_tasks.items()):
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        logger.info(f"Feed runner stopped: {name}")
    _feed_tasks.clear()


def feed_status() -> dict[str, Any]:
    """Return feed runner status."""
    return {
        name: {
            "running": not task.done(),
            "cancelled": task.cancelled(),
        }
        for name, task in _feed_tasks.items()
    }
