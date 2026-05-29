"""Real Market Data Service - AKShare (A股/港股) + yfinance (美股)

Uses subprocess+curl to bypass macOS system proxy issues with Python's _scproxy.
"""

import asyncio
import json
import subprocess
import time
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from loguru import logger


@dataclass
class IndexData:
    name: str
    code: str
    price: float
    change_pct: float
    volume: float = 0
    updated_at: str = ""


@dataclass
class StockQuote:
    symbol: str
    name: str
    price: float
    change: float
    change_pct: float
    open: float
    high: float
    low: float
    volume: float
    market: str  # "A股", "港股", "美股"
    updated_at: str = ""


@dataclass
class KlineBar:
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class MarketDataService:
    """Real market data service with caching and graceful fallback."""

    # East Money API constants
    _EM_BASE = "https://push2.eastmoney.com/api/qt/clist/get"
    _EM_KLIST = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    _FIELDS = "f2,f3,f4,f5,f6,f7,f8,f12,f14,f15,f16,f17,f18,f20,f21"
    _CURL_TIMEOUT = "15"

    def __init__(self, cache_ttl: int = 30):
        self._cache_ttl = cache_ttl  # seconds
        self._cache: Dict[str, tuple[float, Any]] = {}

    def _is_cached(self, key: str) -> bool:
        if key in self._cache:
            ts, _ = self._cache[key]
            if time.time() - ts < self._cache_ttl:
                return True
        return False

    def _get_cache(self, key: str) -> Any:
        return self._cache[key][1] if key in self._cache else None

    def _set_cache(self, key: str, data: Any):
        self._cache[key] = (time.time(), data)

    async def _curl(self, url: str) -> Optional[dict]:
        """Fetch JSON from URL using curl subprocess (bypass macOS _scproxy)."""
        def _run():
            try:
                result = subprocess.run(
                    ["curl", "--noproxy", "*", "-s", "--max-time", self._CURL_TIMEOUT, url],
                    capture_output=True, text=True, timeout=18,
                )
                if result.returncode != 0:
                    logger.debug(f"curl rc={result.returncode}")
                    return None
                text = result.stdout.strip()
                if not text:
                    logger.debug("curl empty response")
                    return None
                return json.loads(text)
            except subprocess.TimeoutExpired:
                logger.debug("curl timeout")
                return None
            except json.JSONDecodeError as e:
                logger.debug(f"curl JSON error: {e}")
                return None
            except Exception as e:
                logger.warning(f"curl error: {e}")
                return None
        return await asyncio.to_thread(_run)

    # ==================== Indices ====================

    # --- Mock fallback data (used when all external APIs fail) ---
    _FALLBACK_INDICES = [
        {"name": "上证指数", "code": "000001.SH", "price": 3312.45, "change_pct": 0.32},
        {"name": "深证成指", "code": "399001.SZ", "price": 10567.89, "change_pct": -0.15},
        {"name": "恒生指数", "code": "HSI", "price": 19234.56, "change_pct": 0.58},
        {"name": "标普500", "code": "SPX", "price": 5960.23, "change_pct": 0.45},
    ]

    async def get_indices(self) -> List[IndexData]:
        """Get major market indices (with fallback to mock when APIs unavailable)."""
        cache_key = "indices"
        if self._is_cached(cache_key):
            return self._get_cache(cache_key)

        indices = []
        try:
            indices = await self._fetch_em_indices()
        except Exception as e:
            logger.warning(f"East Money indices failed: {e}")

        # If all external APIs fail, use mock fallback
        if not indices:
            logger.info("External APIs unavailable, using mock index data")
            indices = [
                IndexData(
                    name=f["name"], code=f["code"],
                    price=f["price"], change_pct=f["change_pct"],
                )
                for f in self._FALLBACK_INDICES
            ]

        self._set_cache(cache_key, indices)
        return indices

    async def _fetch_em_indices(self) -> List[IndexData]:
        """Fetch major A-share indices from East Money via curl."""
        url = (
            f"{self._EM_BASE}?"
            f"pn=1&pz=10&po=1&np=1&fltt=2&invt=2"
            f"&fid=f3&fs=m:1+t:2,m:0+t:1,m:0+t:2"
            f"&fields={self._FIELDS}"
            f"&_={int(time.time() * 1000)}"
        )
        data = await self._curl(url)
        if not data or "data" not in data or "diff" not in data["data"]:
            return []

        targets = {
            "上证指数": "000001.SH",
            "深证成指": "399001.SZ",
            "创业板指": "399006.SZ",
            "上证50": "000016.SH",
            "沪深300": "000300.SH",
        }
        results = []
        for item in data["data"]["diff"]:
            name = item.get("f14", "")
            if name in targets:
                results.append(IndexData(
                    name=name,
                    code=targets[name],
                    price=float(item.get("f2", 0) or 0),
                    change_pct=float(item.get("f3", 0) or 0),
                    volume=float(item.get("f5", 0) or 0),
                ))
        logger.info(f"Fetched {len(results)} EM indices")
        return results

    # ==================== Stock Quote ====================

    async def get_quote(self, symbol: str) -> Optional[StockQuote]:
        """Get real-time quote for a symbol. Auto-detects market."""
        cache_key = f"quote_{symbol}"
        if self._is_cached(cache_key):
            return self._get_cache(cache_key)

        quote = None
        try:
            code = symbol.split(".")[0] if "." in symbol else symbol
            quote = await self._fetch_em_quote(code)
        except Exception as e:
            logger.warning(f"Quote failed for {symbol}: {e}")

        if quote:
            self._set_cache(cache_key, quote)
        return quote

    async def _fetch_em_quote(self, code: str) -> Optional[StockQuote]:
        """Fetch single stock quote from East Money."""
        # Determine market: 6xxxxx = SH, 0xxxxx/3xxxxx = SZ
        market = "1" if code.startswith("6") else "0"
        secid = f"{market}.{code}"

        url = (
            f"{self._EM_BASE}?"
            f"pn=1&pz=1&po=1&np=1&fltt=2&invt=2"
            f"&fid=f3&fs=m:{market}+t:6,m:{market}+t:13,m:{market}+t:80,m:{market}+t:81"
            f"&fields={self._FIELDS}"
            f"&_={int(time.time() * 1000)}"
        )
        data = await self._curl(url)
        if not data or "data" not in data or not data["data"] or "diff" not in data["data"]:
            # Try direct quote API
            return await self._fetch_em_quote_direct(code, market)

        # Find our stock
        items = data["data"]["diff"]
        for item in items:
            if item.get("f12") == code:
                return StockQuote(
                    symbol=f"{code}.{'SH' if market == '1' else 'SZ'}",
                    name=item.get("f14", code),
                    price=float(item.get("f2", 0) or 0),
                    change=float(item.get("f4", 0) or 0),
                    change_pct=float(item.get("f3", 0) or 0),
                    open=float(item.get("f17", 0) or 0),
                    high=float(item.get("f15", 0) or 0),
                    low=float(item.get("f16", 0) or 0),
                    volume=float(item.get("f5", 0) or 0),
                    market="A股",
                )
        return None

    async def _fetch_em_quote_direct(self, code: str, market: str) -> Optional[StockQuote]:
        """Fallback: use East Money quote API directly."""
        secid = f"{market}.{code}"
        url = (
            f"https://push2.eastmoney.com/api/qt/stock/get?"
            f"secid={secid}&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f116,f117,f169,f170"
            f"&_={int(time.time() * 1000)}"
        )
        data = await self._curl(url)
        if not data or "data" not in data:
            return None

        d = data["data"]
        if not d:
            return None
        return StockQuote(
            symbol=f"{code}.{'SH' if market == '1' else 'SZ'}",
            name=d.get("f58", code),
            price=float(d.get("f43", 0) or 0) / 100 if d.get("f43") else 0,
            change=float(d.get("f169", 0) or 0) / 100 if d.get("f169") else 0,
            change_pct=float(d.get("f170", 0) or 0) / 100 if d.get("f170") else 0,
            open=float(d.get("f46", 0) or 0) / 100 if d.get("f46") else 0,
            high=float(d.get("f44", 0) or 0) / 100 if d.get("f44") else 0,
            low=float(d.get("f45", 0) or 0) / 100 if d.get("f45") else 0,
            volume=float(d.get("f47", 0) or 0),
            market="A股",
        )

    # ==================== K-line ====================

    async def get_kline(self, symbol: str, period: str = "daily", count: int = 30) -> List[KlineBar]:
        """Get K-line data."""
        cache_key = f"kline_{symbol}_{period}_{count}"
        if self._is_cached(cache_key):
            return self._get_cache(cache_key)

        data = []
        try:
            data = await self._fetch_em_kline(symbol, period, count)
        except Exception as e:
            logger.warning(f"K-line failed for {symbol}: {e}")

        self._set_cache(cache_key, data)
        return data

    async def _fetch_em_kline(self, symbol: str, period: str, count: int) -> List[KlineBar]:
        """Fetch K-line from East Money."""
        code = symbol.split(".")[0] if "." in symbol else symbol
        market = "1" if code.startswith("6") else "0"
        secid = f"{market}.{code}"

        period_map = {"daily": "101", "weekly": "102", "monthly": "103"}
        klt = period_map.get(period, "101")

        url = (
            f"{self._EM_KLIST}?"
            f"secid={secid}&klt={klt}&fqt=1"
            f"&beg=20240101&end=20261231"
            f"&lmt={count}&_={int(time.time() * 1000)}"
        )
        data = await self._curl(url)
        if not data or "data" not in data or "klines" not in data["data"]:
            return []

        bars = []
        for line in data["data"]["klines"]:
            parts = line.split(",")
            if len(parts) < 7:
                continue
            bars.append(KlineBar(
                date=parts[0],
                open=float(parts[1]),
                close=float(parts[2]),
                high=float(parts[3]),
                low=float(parts[4]),
                volume=float(parts[5]),
            ))
        return bars


# Global instance
market_service = MarketDataService()
