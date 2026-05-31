"""Binance Feed Channel — Real-time crypto market data via Binance REST API.

Polls Binance 24hr ticker endpoints for price updates. Supports subscribing
to any Binance spot trading pair (e.g., BTCUSDT, ETHUSDT).
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from typing import Any

from loguru import logger

from ..protocol import FeedChannel
from ...services.binance_service import binance_service, DEFAULT_CRYPTO_PAIRS, CRYPTO_NAMES


class BinanceFeed:
    """Polling-based feed channel for Binance spot market data.

    Uses Binance REST API (public endpoints, no API key needed).
    Call stream() to receive periodic price snapshots.
    """

    name = "binance"

    def __init__(self, poll_interval: float = 10.0):
        self._poll_interval = poll_interval
        self._symbols: list[str] = list(DEFAULT_CRYPTO_PAIRS)

    async def subscribe(self, symbols: list[str]) -> None:
        """Add crypto symbols to the watch list."""
        for s in symbols:
            if s not in self._symbols:
                self._symbols.append(s)
        logger.info(f"BinanceFeed subscribed: {symbols}")

    async def unsubscribe(self, symbols: list[str]) -> None:
        """Remove crypto symbols from the watch list."""
        for s in symbols:
            if s in self._symbols:
                self._symbols.remove(s)
        logger.info(f"BinanceFeed unsubscribed: {symbols}")

    async def stream(self) -> AsyncIterator[dict[str, Any]]:
        """Yield crypto price snapshots at poll_interval.

        Each event:
            {"type": "crypto_snapshot", "ts": ..., "quotes": [...], "indices": [...]}
        """
        while True:
            try:
                data = await binance_service.get_24hr_batch(self._symbols)
                quotes = []
                indices = []

                for sym in self._symbols:
                    item = data.get(sym)
                    if item is None:
                        continue
                    name = CRYPTO_NAMES.get(sym, sym)
                    quote = {
                        "symbol": sym,
                        "name": name,
                        "price": item["price"],
                        "change_pct": item["change_pct"],
                        "change": item["change"],
                        "high": item["high"],
                        "low": item["low"],
                        "volume": item["volume"],
                        "quote_volume": item["quote_volume"],
                    }
                    quotes.append(quote)
                    # Top 10 pairs are treated as "indices" for market overview
                    if sym in DEFAULT_CRYPTO_PAIRS[:5]:
                        indices.append({
                            "name": name,
                            "code": sym,
                            "price": item["price"],
                            "change_pct": item["change_pct"],
                        })

                yield {
                    "type": "crypto_snapshot",
                    "ts": int(time.time() * 1000),
                    "quotes": quotes,
                    "indices": indices,
                }

            except Exception as e:
                logger.error(f"BinanceFeed stream error: {e}")

            await asyncio.sleep(self._poll_interval)
