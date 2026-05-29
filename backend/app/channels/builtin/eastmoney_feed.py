"""East Money Feed Channel — FeedChannel wrapping market_service."""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from typing import Any

from loguru import logger

from ..protocol import FeedChannel
from ...services.market_data import market_service


class EastMoneyFeed:
    """Polling-based feed channel backed by East Money / AKShare.

    Since East Money does not provide a true push stream, this channel
    implements a polling loop. Call stream() to receive periodic snapshots.
    """

    name = "eastmoney"

    def __init__(self, poll_interval: float = 5.0):
        self._poll_interval = poll_interval
        self._symbols: list[str] = []

    async def subscribe(self, symbols: list[str]) -> None:
        """Add symbols to the watch list."""
        for s in symbols:
            if s not in self._symbols:
                self._symbols.append(s)
        logger.info(f"EastMoneyFeed subscribed: {symbols}")

    async def unsubscribe(self, symbols: list[str]) -> None:
        """Remove symbols from the watch list."""
        for s in symbols:
            if s in self._symbols:
                self._symbols.remove(s)
        logger.info(f"EastMoneyFeed unsubscribed: {symbols}")

    async def stream(self) -> AsyncIterator[dict[str, Any]]:
        """Yield snapshots at poll_interval.

        Each event: {"type": "snapshot", "ts": ..., "quotes": [...], "indices": [...]}
        """
        while True:
            if not self._symbols:
                # Still yield indices even with no subscriptions
                pass

            try:
                indices = await market_service.get_indices()
                quotes = []
                for sym in self._symbols:
                    q = await market_service.get_quote(sym)
                    if q:
                        quotes.append({
                            "symbol": q.symbol,
                            "name": q.name,
                            "price": q.price,
                            "change_pct": q.change_pct,
                        })

                yield {
                    "type": "snapshot",
                    "ts": int(time.time() * 1000),
                    "indices": [
                        {"name": i.name, "code": i.code, "price": i.price, "change_pct": i.change_pct}
                        for i in indices
                    ],
                    "quotes": quotes,
                    "source": "eastmoney",
                }
            except Exception as e:
                logger.error(f"EastMoneyFeed stream error: {e}")
                yield {"type": "error", "error": str(e)}

            await asyncio.sleep(self._poll_interval)
