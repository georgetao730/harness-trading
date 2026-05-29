"""Technical Analysis Skill - Compute indicators from real K-line data"""

from typing import List, Optional

from loguru import logger

from .base import BaseSkill, SkillCategory, SkillResult, skill_registry
from ...services.market_data import market_service, KlineBar


def _ema(values: List[float], period: int) -> List[float]:
    if not values:
        return []
    k = 2 / (period + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def _sma(values: List[float], period: int) -> Optional[float]:
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def _rsi(closes: List[float], period: int) -> Optional[float]:
    if len(closes) <= period:
        return None
    gains, losses = 0.0, 0.0
    for i in range(1, period + 1):
        diff = closes[-i] - closes[-i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses -= diff
    avg_gain = gains / period
    avg_loss = losses / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - 100 / (1 + rs), 1)


def _macd(closes: List[float]) -> Optional[dict]:
    if len(closes) < 35:
        return None
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    dif = [a - b for a, b in zip(ema12[-len(ema26):], ema26)]
    dea = _ema(dif, 9)
    hist = (dif[-1] - dea[-1]) * 2
    # Cross detection on last two bars
    prev_diff = dif[-2] - dea[-2]
    curr_diff = dif[-1] - dea[-1]
    if prev_diff < 0 < curr_diff:
        signal = "golden_cross"
    elif prev_diff > 0 > curr_diff:
        signal = "death_cross"
    else:
        signal = "bullish" if curr_diff > 0 else "bearish"
    return {
        "dif": round(dif[-1], 3),
        "dea": round(dea[-1], 3),
        "histogram": round(hist, 3),
        "signal": signal,
    }


def _bollinger(closes: List[float], period: int = 20, k: float = 2.0) -> Optional[dict]:
    if len(closes) < period:
        return None
    window = closes[-period:]
    mid = sum(window) / period
    var = sum((x - mid) ** 2 for x in window) / period
    std = var ** 0.5
    upper = mid + k * std
    lower = mid - k * std
    last = closes[-1]
    if last >= upper:
        pos = "upper"
    elif last <= lower:
        pos = "lower"
    else:
        pos = "middle"
    return {
        "upper": round(upper, 2),
        "middle": round(mid, 2),
        "lower": round(lower, 2),
        "position": pos,
    }


def _ma_block(closes: List[float]) -> dict:
    ma5 = _sma(closes, 5)
    ma10 = _sma(closes, 10)
    ma20 = _sma(closes, 20)
    ma60 = _sma(closes, 60)
    trend = "unknown"
    if ma5 and ma20:
        trend = "bullish" if ma5 > ma20 else "bearish"
    return {
        "ma5": round(ma5, 2) if ma5 else None,
        "ma10": round(ma10, 2) if ma10 else None,
        "ma20": round(ma20, 2) if ma20 else None,
        "ma60": round(ma60, 2) if ma60 else None,
        "trend": trend,
    }


class TechnicalSkill(BaseSkill):
    """Computes technical indicators (MACD, RSI, Bollinger Bands, MA) from K-line data."""

    category = SkillCategory.TECHNICAL
    name = "technical"
    description = "基于实时 K 线计算技术指标：MACD、RSI、布林带、均线系统"

    async def execute(self, **kwargs) -> SkillResult:
        symbol = kwargs.get("symbol", "")
        indicator = kwargs.get("indicator", "all")
        if not symbol:
            return SkillResult(success=False, error="symbol is required")

        try:
            bars = await market_service.get_kline(symbol, period="daily", count=120)
            if not bars:
                return SkillResult(success=False, error=f"No K-line data for {symbol}")
            closes = [b.close for b in bars]

            if indicator == "macd":
                data = _macd(closes)
                return SkillResult(success=bool(data), data={"symbol": symbol, **(data or {})})
            if indicator == "rsi":
                return SkillResult(success=True, data={
                    "symbol": symbol,
                    "rsi6": _rsi(closes, 6),
                    "rsi14": _rsi(closes, 14),
                    "rsi24": _rsi(closes, 24),
                })
            if indicator == "bollinger":
                return SkillResult(success=True, data={"symbol": symbol, **(_bollinger(closes) or {})})
            if indicator == "ma":
                return SkillResult(success=True, data={"symbol": symbol, **_ma_block(closes)})

            # all
            indicators = {
                "symbol": symbol,
                "last_close": round(closes[-1], 2),
                "bar_count": len(closes),
                "macd": _macd(closes),
                "rsi": {
                    "rsi6": _rsi(closes, 6),
                    "rsi14": _rsi(closes, 14),
                    "rsi24": _rsi(closes, 24),
                },
                "bollinger": _bollinger(closes),
                "ma": _ma_block(closes),
            }
            logger.info(f"Computed technical indicators for {symbol} from {len(closes)} bars")
            return SkillResult(success=True, data=indicators)
        except Exception as e:
            logger.error(f"TechnicalSkill error: {e}")
            return SkillResult(success=False, error=str(e))


# Auto-register
skill_registry.register(TechnicalSkill())
