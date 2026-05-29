"""market-scan handler — real-time market data via East Money."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from loguru import logger


@dataclass
class SkillResult:
    success: bool
    data: Any = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


async def run(ctx: Any, inputs: dict[str, Any]) -> SkillResult:  # noqa: ARG001
    """Execute market-scan skill.

    Args:
        ctx: Skill context (provides feed channels, cache, etc.)
        inputs: {"data_type": "indices|quote|kline", "symbol": "...", "period": "daily"}
    """
    from backend.app.services.market_data import market_service

    data_type = inputs.get("data_type", "quote")
    symbol = inputs.get("symbol", "")

    try:
        if data_type == "indices":
            indices = await market_service.get_indices()
            data = [
                {
                    "name": idx.name,
                    "code": idx.code,
                    "price": idx.price,
                    "change_pct": round(idx.change_pct, 2),
                }
                for idx in indices
            ]
            return SkillResult(success=True, data=data, metadata={"count": len(data)})

        if data_type == "quote":
            if not symbol:
                return SkillResult(success=False, error="symbol is required for quote")
            quote = await market_service.get_quote(symbol)
            if quote is None:
                return SkillResult(success=False, error=f"No data for {symbol}")
            return SkillResult(success=True, data={
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
            })

        if data_type == "kline":
            if not symbol:
                return SkillResult(success=False, error="symbol is required for kline")
            period = inputs.get("period", "daily")
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

        return SkillResult(success=False, error=f"Unknown data_type: {data_type}")

    except Exception as e:
        logger.error(f"market-scan error: {e}")
        return SkillResult(success=False, error=str(e))
