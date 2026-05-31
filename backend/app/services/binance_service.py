"""Binance Service — Real-time crypto market data via Binance REST API.

Public endpoints (no API key required):
  - GET /api/v3/ticker/price     — latest price for a symbol
  - GET /api/v3/ticker/24hr      — 24hr stats (price, change, volume)
  - GET /api/v3/klines           — candlestick data
  - GET /api/v3/exchangeInfo     — trading pairs, filters
"""

from __future__ import annotations

import asyncio
import json
import ssl
import time
import urllib.request
from typing import Any

from loguru import logger

from ..services.market_data import KlineBar


# Top crypto pairs monitored by default
DEFAULT_CRYPTO_PAIRS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
    "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT",
]

# Human-readable names for common pairs
CRYPTO_NAMES: dict[str, str] = {
    "BTCUSDT": "Bitcoin",
    "ETHUSDT": "Ethereum",
    "BNBUSDT": "BNB",
    "SOLUSDT": "Solana",
    "XRPUSDT": "Ripple",
    "ADAUSDT": "Cardano",
    "DOGEUSDT": "Dogecoin",
    "AVAXUSDT": "Avalanche",
    "DOTUSDT": "Polkadot",
    "LINKUSDT": "Chainlink",
}


class BinanceService:
    """Lightweight Binance REST client for public market data."""

    BASE_URL = "https://api.binance.com"
    CACHE_TTL = 10  # seconds

    def __init__(self):
        self._cache: dict[str, tuple[float, Any]] = {}

    def _cached(self, key: str) -> Any | None:
        ts, val = self._cache.get(key, (0, None))
        if time.time() - ts < self.CACHE_TTL:
            return val
        return None

    def _set_cache(self, key: str, val: Any) -> None:
        self._cache[key] = (time.time(), val)

    async def _fetch(self, path: str) -> dict | list | None:
        """Fetch JSON from Binance REST API."""

        def _run():
            url = f"{self.BASE_URL}{path}"
            ctx = ssl.create_default_context()
            ctx.check_hostname = True
            ctx.verify_mode = ssl.CERT_REQUIRED
            req = urllib.request.Request(url, headers={
                "Accept": "application/json",
                "User-Agent": "HarnessTrading/1.0",
            })
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))

        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            logger.warning(f"Binance API error ({path}): {e}")
            return None

    # ── Tickers ──

    async def get_price(self, symbol: str) -> float | None:
        """Get latest price for a symbol. e.g. 'BTCUSDT'."""
        cached = self._cached(f"price_{symbol}")
        if cached is not None:
            return cached

        data = await self._fetch(f"/api/v3/ticker/price?symbol={symbol}")
        if isinstance(data, dict) and "price" in data:
            price = float(data["price"])
            self._set_cache(f"price_{symbol}", price)
            return price
        return None

    async def get_prices(self, symbols: list[str]) -> dict[str, float]:
        """Batch get prices for multiple symbols."""
        cached: dict[str, float] = {}
        to_fetch: list[str] = []
        for s in symbols:
            p = self._cached(f"price_{s}")
            if p is not None:
                cached[s] = p
            else:
                to_fetch.append(s)

        if not to_fetch:
            return cached

        # Binance supports batch via [] brackets
        symbol_param = ",".join(f'"{s}"' for s in to_fetch)
        data = await self._fetch(f"/api/v3/ticker/price?symbols=[{symbol_param}]")
        if isinstance(data, list):
            for item in data:
                s = item["symbol"]
                p = float(item["price"])
                self._set_cache(f"price_{s}", p)
                cached[s] = p
        return cached

    async def get_24hr(self, symbol: str) -> dict[str, Any] | None:
        """Get 24hr ticker statistics."""
        cached = self._cached(f"24hr_{symbol}")
        if cached is not None:
            return cached

        data = await self._fetch(f"/api/v3/ticker/24hr?symbol={symbol}")
        if isinstance(data, dict):
            result = {
                "symbol": data["symbol"],
                "price": float(data["lastPrice"]),
                "change": float(data["priceChange"]),
                "change_pct": float(data["priceChangePercent"]),
                "high": float(data["highPrice"]),
                "low": float(data["lowPrice"]),
                "volume": float(data["volume"]),
                "quote_volume": float(data["quoteVolume"]),
            }
            self._set_cache(f"24hr_{symbol}", result)
            return result
        return None

    async def get_24hr_batch(self, symbols: list[str]) -> dict[str, dict[str, Any]]:
        """Batch get 24hr stats for multiple symbols."""
        cached: dict[str, dict[str, Any]] = {}
        to_fetch: list[str] = []
        for s in symbols:
            c = self._cached(f"24hr_{s}")
            if c is not None:
                cached[s] = c
            else:
                to_fetch.append(s)

        if not to_fetch:
            return cached

        symbol_param = ",".join(f'"{s}"' for s in to_fetch)
        data = await self._fetch(f"/api/v3/ticker/24hr?symbols=[{symbol_param}]")
        if isinstance(data, list):
            for item in data:
                s = item["symbol"]
                result = {
                    "symbol": s,
                    "price": float(item["lastPrice"]),
                    "change": float(item["priceChange"]),
                    "change_pct": float(item["priceChangePercent"]),
                    "high": float(item["highPrice"]),
                    "low": float(item["lowPrice"]),
                    "volume": float(item["volume"]),
                    "quote_volume": float(item["quoteVolume"]),
                }
                self._set_cache(f"24hr_{s}", result)
                cached[s] = result
        return cached

    # ── Klines ──

    async def get_klines(
        self,
        symbol: str,
        interval: str = "1d",
        limit: int = 60,
    ) -> list[KlineBar]:
        """Get kline/candlestick data.

        Intervals: 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M
        """
        cache_key = f"klines_{symbol}_{interval}_{limit}"
        cached = self._cached(cache_key)
        if cached is not None:
            return cached

        data = await self._fetch(
            f"/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
        )
        if not isinstance(data, list):
            return []

        bars = []
        for item in data:
            bars.append(KlineBar(
                date=time.strftime("%Y-%m-%d", time.gmtime(item[0] / 1000)),
                open=float(item[1]),
                high=float(item[2]),
                low=float(item[3]),
                close=float(item[4]),
                volume=float(item[5]),
            ))
        self._set_cache(cache_key, bars)
        return bars

    # ── Exchange Info ──

    async def get_exchange_info(self) -> list[dict[str, Any]]:
        """Get all trading pairs information."""
        cached = self._cached("exchange_info")
        if cached is not None:
            return cached

        data = await self._fetch("/api/v3/exchangeInfo")
        if isinstance(data, dict) and "symbols" in data:
            symbols = data["symbols"]
            self._set_cache("exchange_info", symbols)
            return symbols
        return []

    async def get_usdt_pairs(self) -> list[str]:
        """Get all USDT trading pairs."""
        symbols = await self.get_exchange_info()
        return [
            s["symbol"] for s in symbols
            if s.get("quoteAsset") == "USDT" and s.get("status") == "TRADING"
        ]


# Singleton
binance_service = BinanceService()
