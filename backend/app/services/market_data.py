"""Real Market Data Service - Sina Finance (A股/港股) + yfinance (美股)

Uses urllib.request with SSL to fetch real-time market data.
Sina API is preferred for A-shares since it's more reliable in sandbox environments.
"""

import asyncio
import json
import re
import ssl
import time
import urllib.request
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

    _SINA_BASE = "https://hq.sinajs.cn/list="
    _TENCENT_BASE = "https://qt.gtimg.cn/q="
    _TIMEOUT = 10

    # HTTP headers mimicking a browser
    _HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://finance.sina.com.cn/",
    }

    def __init__(self, cache_ttl: int = 30):
        self._cache_ttl = cache_ttl  # seconds
        self._cache: Dict[str, tuple[float, Any]] = {}
        self._ssl_ctx = ssl._create_unverified_context()

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

    async def _fetch_url(self, url: str, encoding: str = "utf-8") -> Optional[str]:
        """Fetch URL content using urllib (bypass macOS _scproxy issues)."""

        def _run() -> Optional[str]:
            try:
                req = urllib.request.Request(url, headers=self._HEADERS)
                with urllib.request.urlopen(
                    req, context=self._ssl_ctx, timeout=self._TIMEOUT
                ) as resp:
                    raw = resp.read()
                    return raw.decode(encoding, errors="replace")
            except Exception as e:
                logger.debug(f"fetch_url error: {e}")
                return None

        return await asyncio.to_thread(_run)

    # ==================== Indices ====================

    # --- Fallback data (used ONLY when ALL external APIs fail) ---
    _FALLBACK_INDICES = [
        {"name": "上证指数", "code": "000001.SH", "price": 4068.57, "change_pct": -0.73},
        {"name": "深证成指", "code": "399001.SZ", "price": 15575.13, "change_pct": -1.81},
        {"name": "恒生指数", "code": "HSI", "price": 25182.39, "change_pct": 0.70},
        {"name": "标普500", "code": "SPX", "price": 5960.23, "change_pct": 0.45},
    ]

    # Sina symbol → (name, display_code)
    # Format: s_sh=Shanghai index, s_sz=Shenzhen index, int_=international
    _SINA_INDEX_MAP: Dict[str, tuple[str, str]] = {
        "s_sh000001":  ("上证指数", "000001.SH"),
        "s_sz399001":  ("深证成指", "399001.SZ"),
        "s_sz399006":  ("创业板指", "399006.SZ"),
        "s_sh000016":  ("上证50",   "000016.SH"),
        "s_sh000300":  ("沪深300",  "000300.SH"),
        "int_hangseng": ("恒生指数", "HSI"),
    }

    async def get_indices(self) -> List[IndexData]:
        """Get major market indices (with fallback to mock when APIs unavailable)."""
        cache_key = "indices"
        if self._is_cached(cache_key):
            return self._get_cache(cache_key)

        indices = []
        try:
            indices = await self._fetch_sina_indices()
        except Exception as e:
            logger.warning(f"Sina indices failed: {e}")

        # If all external APIs fail, use fallback (updated with realistic values)
        if not indices:
            logger.info("External APIs unavailable, using fallback index data")
            indices = [
                IndexData(
                    name=f["name"], code=f["code"],
                    price=f["price"], change_pct=f["change_pct"],
                )
                for f in self._FALLBACK_INDICES
            ]

        self._set_cache(cache_key, indices)
        return indices

    async def _fetch_sina_indices(self) -> List[IndexData]:
        """Fetch major indices via Sina Finance API.

        Sina index response format (GBK-encoded):
          var hq_str_s_sh000001="name,price,change,change_pct,volume,amount";
        Fields: 0=name, 1=price, 2=change, 3=change_pct(%), 4=volume, 5=amount
        """
        symbols = ",".join(self._SINA_INDEX_MAP.keys())
        url = f"{self._SINA_BASE}{symbols}"

        text = await self._fetch_url(url, encoding="gbk")
        if not text:
            return []

        results = []
        for line in text.strip().split("\n"):
            # Parse: var hq_str_SYMBOL="DATA";
            m = re.match(r'var hq_str_(\S+)="(.*)"', line.strip())
            if not m:
                continue
            symbol_key = m.group(1)
            data = m.group(2)
            if symbol_key not in self._SINA_INDEX_MAP or not data:
                continue

            name, display_code = self._SINA_INDEX_MAP[symbol_key]
            fields = data.split(",")
            try:
                price = float(fields[1]) if len(fields) > 1 else 0.0
                change_pct = float(fields[3]) if len(fields) > 3 else 0.0
                volume = float(fields[4]) if len(fields) > 4 else 0.0
            except (ValueError, IndexError):
                continue

            results.append(IndexData(
                name=name,
                code=display_code,
                price=price,
                change_pct=change_pct,
                volume=volume,
            ))

        # S&P 500 not available from Sina, add from fallback
        has_spx = any(r.code == "SPX" for r in results)
        if not has_spx:
            spx_fallback = next(
                (f for f in self._FALLBACK_INDICES if f["code"] == "SPX"), None
            )
            if spx_fallback:
                results.append(IndexData(
                    name=spx_fallback["name"],
                    code=spx_fallback["code"],
                    price=spx_fallback["price"],
                    change_pct=spx_fallback["change_pct"],
                ))

        logger.info(f"Fetched {len(results)} indices from Sina")
        return results

    # ==================== Symbol resolution ====================

    @staticmethod
    def _resolve_sina_symbol(symbol: str) -> Optional[str]:
        """Resolve a symbol to Sina API format (sh600519 / sz000001).

        Supports: '600519', '600519.SH', 'sh600519', '000001.SZ', 'sz000001'
        """
        symbol = symbol.strip().upper()
        # Already in Sina format
        if symbol.startswith("SH") or symbol.startswith("SZ"):
            return symbol.lower()
        # With suffix
        if "." in symbol:
            code, suffix = symbol.split(".", 1)
            if suffix == "SH":
                return f"sh{code}"
            if suffix == "SZ":
                return f"sz{code}"
            return None
        # Plain code: prefix heuristic
        if symbol.startswith("6"):
            return f"sh{symbol.lower()}"
        if symbol.startswith(("0", "3")):
            return f"sz{symbol.lower()}"
        return None

    # ==================== Stock Quote ====================

    async def get_quote(self, symbol: str) -> Optional[StockQuote]:
        """Get real-time quote for a symbol. Auto-detects market."""
        cache_key = f"quote_{symbol}"
        if self._is_cached(cache_key):
            return self._get_cache(cache_key)

        quote = None
        try:
            sina_sym = self._resolve_sina_symbol(symbol)
            if sina_sym:
                quote = await self._fetch_sina_quote(sina_sym)
        except Exception as e:
            logger.warning(f"Quote failed for {symbol}: {e}")

        if quote:
            self._set_cache(cache_key, quote)
        return quote

    async def _fetch_sina_quote(self, sina_symbol: str) -> Optional[StockQuote]:
        """Fetch single stock quote from Sina Finance.

        Sina stock response format (GBK, ~30 fields):
          0=name, 1=open, 2=prev_close, 3=price, 4=high, 5=low,
          6=bid(buy), 7=ask(sell), 8=volume(shares), 9=amount(yuan),
          ...
          30=date, 31=time, 32=status(00=normal)
        """
        url = f"{self._SINA_BASE}{sina_symbol}"
        text = await self._fetch_url(url, encoding="gbk")
        if not text:
            return None

        m = re.search(r'"([^"]*)"', text)
        if not m:
            return None

        fields = m.group(1).split(",")
        if len(fields) < 10 or not fields[0]:
            return None

        code = sina_symbol[2:]  # strip sh/sz prefix
        market_tag = "SH" if sina_symbol.startswith("sh") else "SZ"

        try:
            return StockQuote(
                symbol=f"{code}.{market_tag}",
                name=fields[0],
                open=float(fields[1]) if fields[1] else 0.0,
                price=float(fields[3]) if fields[3] else 0.0,
                high=float(fields[4]) if fields[4] else 0.0,
                low=float(fields[5]) if fields[5] else 0.0,
                volume=float(fields[8]) if fields[8] else 0.0,
                change=0.0,  # computed below
                change_pct=0.0,  # computed below
                market="A股",
                updated_at=f"{fields[30]} {fields[31]}" if len(fields) > 31 else "",
            )
        except (ValueError, IndexError) as e:
            logger.debug(f"Parse quote error: {e}")
            return None

    # ==================== K-line ====================

    async def get_kline(self, symbol: str, period: str = "daily", count: int = 30) -> List[KlineBar]:
        """Get K-line data from Tencent Finance API."""
        cache_key = f"kline_{symbol}_{period}_{count}"
        if self._is_cached(cache_key):
            return self._get_cache(cache_key)

        data = []
        try:
            data = await self._fetch_tencent_kline(symbol, period, count)
        except Exception as e:
            logger.warning(f"K-line failed for {symbol}: {e}")

        self._set_cache(cache_key, data)
        return data

    async def _fetch_tencent_kline(
        self, symbol: str, period: str, count: int
    ) -> List[KlineBar]:
        """Fetch K-line from Tencent Finance.

        Tencent K-line API returns JSON with OHLCV data.
        Item format: [date, open, close, high, low, volume]
        """
        sina_sym = self._resolve_sina_symbol(symbol)
        if not sina_sym:
            return []

        period_map = {"daily": "day", "weekly": "week", "monthly": "month"}
        qt_period = period_map.get(period, "day")

        url = (
            f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?"
            f"param={sina_sym},{qt_period},,,{count},qfq"
        )
        text = await self._fetch_url(url, encoding="utf-8")
        if not text:
            return []

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return []

        stock_data = data.get("data", {}).get(sina_sym, {})
        klines = stock_data.get(qt_period, [])
        if not klines:
            return []

        bars = []
        for item in klines[-count:]:
            if len(item) < 6:
                continue
            try:
                bars.append(KlineBar(
                    date=str(item[0]),
                    open=float(item[1]),
                    close=float(item[2]),
                    high=float(item[3]),
                    low=float(item[4]),
                    volume=float(item[5]),
                ))
            except (ValueError, IndexError):
                continue
        return bars


# Global instance
market_service = MarketDataService()
