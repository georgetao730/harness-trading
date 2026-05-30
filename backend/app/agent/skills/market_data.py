"""Market Data Skill - Fetch real-time and historical market data"""

from typing import Any, Dict, List, Optional
from loguru import logger

from .base import BaseSkill, SkillCategory, SkillResult, skill_registry
from ...services.market_data import market_service, IndexData, StockQuote, KlineBar


class MarketDataSkill(BaseSkill):
    """Fetches market data - indices, stock quotes, K-line data using AKShare + yfinance."""

    category = SkillCategory.MARKET_DATA
    name = "market_data"
    description = "获取实时行情数据、K线数据、指数数据"

    async def execute(self, **kwargs) -> SkillResult:
        symbol = kwargs.get("symbol", "")
        data_type = kwargs.get("data_type", "quote")

        try:
            if data_type == "indices":
                return await self._fetch_indices()
            elif data_type == "quote" and symbol:
                return await self._fetch_quote(symbol)
            elif data_type == "kline" and symbol:
                return await self._fetch_kline(symbol, kwargs.get("period", "daily"))
            else:
                return SkillResult(
                    success=False,
                    error=f"Unknown data_type: {data_type} or missing symbol",
                )
        except Exception as e:
            logger.error(f"MarketDataSkill error: {e}")
            return SkillResult(success=False, error=str(e))

    async def _fetch_indices(self) -> SkillResult:
        """Fetch major market indices from AKShare + yfinance."""
        try:
            indices = await market_service.get_indices()
            data = [
                {
                    "name": idx.name,
                    "code": idx.code,
                    "price": idx.price,
                    "change_pct": round(idx.change_pct, 2),
                    "volume": idx.volume,
                }
                for idx in indices
            ]
            logger.info(f"Fetched {len(data)} real indices")
            return SkillResult(success=True, data=data)
        except Exception as e:
            logger.error(f"_fetch_indices failed: {e}")
            return SkillResult(success=False, error=str(e))

    async def _fetch_quote(self, symbol: str) -> SkillResult:
        """Fetch real-time quote for a symbol."""
        try:
            quote = await market_service.get_quote(symbol)
            if quote is None:
                return SkillResult(success=False, error=f"No data for {symbol}")
            data = {
                "symbol": quote.symbol,
                "name": quote.name,
                "price": quote.price,
                "change": quote.change,
                "change_pct": quote.change_pct,
                "open": quote.open,
                "high": quote.high,
                "low": quote.low,
                "volume": quote.volume,
                "market": quote.market,
            }
            return SkillResult(success=True, data=data)
        except Exception as e:
            logger.error(f"_fetch_quote failed: {e}")
            return SkillResult(success=False, error=str(e))

    async def _fetch_kline(self, symbol: str, period: str = "daily") -> SkillResult:
        """Fetch K-line data."""
        try:
            bars = await market_service.get_kline(symbol, period)
            data = [
                {
                    "date": bar.date,
                    "open": bar.open,
                    "high": bar.high,
                    "low": bar.low,
                    "close": bar.close,
                    "volume": bar.volume,
                }
                for bar in bars
            ]
            return SkillResult(success=True, data=data, metadata={"count": len(data)})
        except Exception as e:
            logger.error(f"_fetch_kline failed: {e}")
            return SkillResult(success=False, error=str(e))


# Auto-register
skill_registry.register(MarketDataSkill())
skill_registry.alias("market-scan", "market_data")
skill_registry.alias("market_data_skill", "market_data")
