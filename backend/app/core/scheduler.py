"""Scheduled Tasks — morning briefing, closing summary, periodic alerts.

Uses asyncio.create_task for scheduling. No extra dependencies.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, time
from typing import Any

from loguru import logger

from ..services.market_data import market_service


# ── Config ──

# A-share trading hours (Beijing time)
_MORNING_OPEN = time(9, 30)
_MORNING_CLOSE = time(11, 30)
_AFTERNOON_OPEN = time(13, 0)
_AFTERNOON_CLOSE = time(15, 0)

_BRIEFING_MINUTES_BEFORE = 5  # send morning briefing 5 min before open


# ── Task registry ──

_tasks: list[asyncio.Task[None]] = []
_enabled = True


def is_trading_time(now: datetime | None = None) -> bool:
    """Check if current time is within A-share trading hours."""
    t = (now or datetime.now()).time()
    return (_MORNING_OPEN <= t <= _MORNING_CLOSE) or (_AFTERNOON_OPEN <= t <= _AFTERNOON_CLOSE)


async def _generate_market_summary() -> str:
    """Generate a one-paragraph market summary for push notifications."""
    try:
        indices = await market_service.get_indices()
        lines = ["📊 市场概览"]
        for idx in indices[:4]:
            arrow = "🔴" if idx.change_pct < 0 else "🟢"
            lines.append(f"{arrow} {idx.name}: {idx.price:.2f} ({idx.change_pct:+.2f}%)")
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"Market summary failed: {e}")
        return "⚠️ 无法获取市场数据"


async def _generate_portfolio_summary() -> str:
    """Generate portfolio snapshot."""
    try:
        from ..execution.paper_trading import paper_engine

        s = paper_engine.get_portfolio_summary()
        pnl_emoji = "📈" if s["total_pnl"] >= 0 else "📉"
        lines = [
            "💰 持仓快照",
            f"总资产: {s['total_value']:,.0f}",
            f"现金: {s['cash']:,.0f}",
            f"{pnl_emoji} 总盈亏: {s['total_pnl']:+,.0f} ({s['total_pnl_pct']:+.2f}%)",
        ]
        if s["position_count"] > 0:
            lines.append(f"持仓数: {s['position_count']} 只")
        return "\n".join(lines)
    except Exception as e:
        logger.debug(f"Portfolio summary failed: {e}")
        return ""


async def _broadcast(title: str, body: str, level: str = "info") -> None:
    """Push to all alert channels."""
    try:
        from ..channels.registry import channel_registry
        await channel_registry.broadcast_alert(title, body, level)
    except Exception as e:
        logger.debug(f"Broadcast failed: {e}")


# ── Scheduled tasks ──

async def _morning_briefing() -> None:
    """Send pre-market briefing with indices and watchlist snapshot."""
    logger.info("Running morning briefing...")
    market = await _generate_market_summary()
    portfolio = await _generate_portfolio_summary()
    body = market
    if portfolio:
        body += "\n\n" + portfolio
    await _broadcast("🌅 开盘简报", body)


async def _closing_summary() -> None:
    """Send post-market closing summary."""
    logger.info("Running closing summary...")
    market = await _generate_market_summary()
    portfolio = await _generate_portfolio_summary()

    # Add journal stats
    journal_text = ""
    try:
        from ..db.database import new_session
        from ..db.models import TradeJournal
        from sqlalchemy import select

        async with new_session() as db:
            result = await db.execute(
                select(TradeJournal).where(TradeJournal.status == "closed")
                .order_by(TradeJournal.created_at.desc()).limit(10)
            )
            entries = result.scalars().all()
            if entries:
                today_pnl = sum(e.pnl or 0 for e in entries[:5])
                journal_text = f"\n\n📝 今日交易: {len(entries)} 笔, 盈亏 {today_pnl:+,.0f}"
    except Exception:
        pass

    body = market + (portfolio or "") + journal_text
    await _broadcast("🌆 收盘总结", body)


async def _portfolio_watchdog() -> None:
    """Check portfolio health during trading hours, alert on issues."""
    try:
        from ..execution.paper_trading import paper_engine
        from ..harness.pipeline import harness_pipeline

        s = paper_engine.get_portfolio_summary()
        total = s["total_value"]
        pnl_pct = s["total_pnl_pct"]

        # Alert on significant drawdown
        if pnl_pct < -3.0:
            await _broadcast(
                "⚠️ 持仓预警",
                f"当日回撤已超过 3% (当前 {pnl_pct:+.2f}%)，请关注风险",
                level="warning",
            )
    except Exception:
        pass


# ── Scheduler loop ──

async def _scheduler_loop() -> None:
    """Main loop that runs scheduled tasks at appropriate times."""
    last_briefing_date = ""
    last_closing_date = ""
    last_watchdog_minute = -1

    while _enabled:
        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        current_time = now.time()

        # Morning briefing: 9:25 (5 min before open)
        briefing_time = time(
            _MORNING_OPEN.hour,
            max(0, _MORNING_OPEN.minute - _BRIEFING_MINUTES_BEFORE),
        )
        if (current_time.hour == briefing_time.hour
                and current_time.minute == briefing_time.minute
                and last_briefing_date != today):
            await _morning_briefing()
            last_briefing_date = today

        # Closing summary: 15:05
        closing_time = time(15, 5)
        if (current_time.hour == closing_time.hour
                and current_time.minute == closing_time.minute
                and last_closing_date != today):
            await _closing_summary()
            last_closing_date = today

        # Portfolio watchdog: every 30 min during trading hours
        if is_trading_time(now) and now.minute % 30 == 0 and now.minute != last_watchdog_minute:
            await _portfolio_watchdog()
            last_watchdog_minute = now.minute

        await asyncio.sleep(55)  # Check every ~1 minute


async def start_scheduler() -> None:
    """Start the scheduled task loop."""
    global _enabled
    _enabled = True
    # Cancel existing tasks
    await stop_scheduler()

    task = asyncio.create_task(_scheduler_loop())
    _tasks.append(task)
    logger.info("Scheduler started (morning briefing + closing summary + watchdog)")


async def stop_scheduler() -> None:
    """Stop all scheduled tasks."""
    global _enabled
    _enabled = False
    for task in _tasks:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    _tasks.clear()
    logger.info("Scheduler stopped")
