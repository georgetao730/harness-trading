"""Trading API Routes - Orders, portfolio, market data"""

from fastapi import APIRouter, Query
from loguru import logger

from ..harness.engine import OrderIntent
from ..harness.pipeline import harness_pipeline
from ..execution.paper_trading import paper_engine
from ..services.market_data import market_service

router = APIRouter(prefix="/api/trading", tags=["trading"])


@router.post("/order")
async def place_order(data: dict):
    """Place a trade order through the safety harness."""
    intent = OrderIntent(
        symbol=data["symbol"],
        action=data["action"],
        order_type=data.get("order_type", "limit"),
        price=data["price"],
        quantity=data["quantity"],
        reason=data.get("reason", ""),
    )

    # Pull latest market price so the price-deviation check has something to
    # compare against. Failure to fetch is treated as "no reference price"
    # (the price check will simply pass) rather than blocking the order.
    market_data = None
    try:
        quote = await market_service.get_quote(intent.symbol)
        if quote and quote.price > 0:
            market_data = {"price": quote.price}
    except Exception as e:
        logger.warning(f"Quote lookup failed for {intent.symbol}: {e}")

    # Run through harness
    approval = await harness_pipeline.process_order(intent, market_data=market_data)

    if approval.final_action == "execute":
        # Auto-execute via paper trading
        order = paper_engine.place_order(
            symbol=intent.symbol,
            action=intent.action,
            price=intent.price,
            quantity=intent.quantity,
            reason=intent.reason,
        )
        paper_engine.fill_order(order.id)

        # Auto-create / update trade journal
        await _sync_journal(intent)

        return {
            "status": "executed",
            "order_id": order.id,
            "approval": {
                "approved": approval.approved,
                "mode": approval.mode.value,
                "final_action": approval.final_action,
            },
        }

    elif approval.final_action == "dry_run_log":
        logger.info(f"Dry run: {intent.action} {intent.symbol} x{intent.quantity}")
        return {
            "status": "dry_run_logged",
            "approval": {
                "approved": True,
                "mode": approval.mode.value,
                "final_action": approval.final_action,
                "validation_results": [
                    {"check": r.check_name, "status": r.status.value, "message": r.message}
                    for r in approval.validation_results
                ],
            },
            "message": "演习模式：订单已记录但未执行",
        }

    elif approval.final_action == "queue_for_approval":
        return {
            "status": "pending_approval",
            "approval": {
                "approved": False,
                "mode": approval.mode.value,
                "final_action": approval.final_action,
                "risk_warnings": approval.risk_warnings,
            },
            "message": "订单已加入审批队列，等待人工确认",
        }

    else:  # reject
        return {
            "status": "rejected",
            "approval": {
                "approved": False,
                "mode": approval.mode.value,
                "final_action": approval.final_action,
                "validation_results": [
                    {"check": r.check_name, "status": r.status.value, "message": r.message}
                    for r in approval.validation_results
                ],
            },
            "message": "订单被安全校验链拦截",
        }


@router.get("/portfolio")
async def get_portfolio():
    """Get paper trading portfolio summary."""
    summary = paper_engine.get_portfolio_summary()
    positions = [
        {
            "symbol": p.symbol,
            "shares": p.shares,
            "avg_cost": round(p.avg_cost, 2),
            "current_price": round(p.current_price, 2),
            "market_value": round(p.market_value, 2),
            "unrealized_pnl": round(p.unrealized_pnl, 2),
            "unrealized_pnl_pct": round(p.unrealized_pnl_pct, 2),
        }
        for p in paper_engine.positions.values()
    ]
    return {"summary": summary, "positions": positions}


@router.get("/orders")
async def get_orders():
    """Get all paper trading orders."""
    return {
        "orders": [
            {
                "id": o.id,
                "symbol": o.symbol,
                "action": o.action,
                "price": o.price,
                "quantity": o.quantity,
                "status": o.status,
                "filled_price": o.filled_price,
                "reason": o.reason,
                "created_at": o.created_at,
            }
            for o in paper_engine.orders
        ]
    }


@router.get("/broker/status")
async def get_broker_status():
    """Get active broker connection status and capabilities."""
    from ..channels.registry import channel_registry
    from ..execution.brokers import BrokerAdapter

    broker = channel_registry.get_broker()
    if broker is None:
        return {"status": "no_broker", "message": "没有已注册的券商通道"}

    # Try to get richer status if it's a BrokerAdapter
    if isinstance(broker, BrokerAdapter):
        status = await broker.status()
        return {
            "status": "connected" if status.get("connected") else "disconnected",
            "broker": status,
        }

    # Fallback for plain BrokerChannel
    account = await broker.get_account() if hasattr(broker, 'get_account') else {}
    return {
        "status": "connected",
        "broker": {
            "name": getattr(broker, 'name', 'unknown'),
            "account": account,
        },
    }


@router.get("/stats")
async def get_trading_stats():
    """Get comprehensive trading performance statistics."""
    summary = paper_engine.get_portfolio_summary()

    # Win rate from closed trades
    closed = paper_engine.closed_trades
    winning = sum(1 for t in closed if t.get("pnl", 0) > 0)
    total_closed = len(closed)
    win_rate = round(winning / total_closed * 100, 1) if total_closed > 0 else 0.0

    # Average win / loss
    wins = [t["pnl"] for t in closed if t.get("pnl", 0) > 0]
    losses = [t["pnl"] for t in closed if t.get("pnl", 0) < 0]
    avg_win = round(sum(wins) / len(wins), 2) if wins else 0.0
    avg_loss = round(abs(sum(losses) / len(losses)), 2) if losses else 0.0

    # Profit factor
    total_gain = sum(wins) if wins else 0.0
    total_loss = abs(sum(losses)) if losses else 0.0
    profit_factor = round(total_gain / total_loss, 2) if total_loss > 0 else (999.0 if total_gain > 0 else 0.0)

    # Daily PnL from journal
    daily_pnl = await _get_daily_pnl()

    return {
        **summary,
        "win_rate": win_rate,
        "total_trades": total_closed,
        "winning_trades": winning,
        "losing_trades": total_closed - winning,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "profit_factor": profit_factor,
        "daily_pnl": daily_pnl,
        "initial_cash": paper_engine.initial_cash,
    }


async def _get_daily_pnl() -> list[dict]:
    """Get recent daily PnL from trade journal."""
    try:
        from ..db.database import new_session
        from ..db.models import TradeJournal
        from sqlalchemy import select, func
        from datetime import datetime, timedelta

        async with new_session() as db:
            seven_days = datetime.now() - timedelta(days=7)
            result = await db.execute(
                select(TradeJournal)
                .where(
                    TradeJournal.status == "closed",
                    TradeJournal.pnl.isnot(None),
                    TradeJournal.exit_date >= seven_days,
                )
                .order_by(TradeJournal.exit_date.desc())
                .limit(50)
            )
            trades = result.scalars().all()

        # Group by date
        by_date: dict = {}
        for t in trades:
            if t.exit_date:
                day = t.exit_date.strftime("%m-%d")
                by_date.setdefault(day, {"date": day, "pnl": 0.0, "trades": 0})
                by_date[day]["pnl"] += t.pnl or 0
                by_date[day]["trades"] += 1

        return sorted(by_date.values(), key=lambda x: x["date"])
    except Exception:
        return []


# ==================== Market Data Endpoints ====================

@router.get("/market/indices")
async def get_market_indices():
    """Get major market indices (上证, 深证, 恒生, 标普500)."""
    indices = await market_service.get_indices()
    return {
        "indices": [
            {
                "name": idx.name,
                "code": idx.code,
                "price": idx.price,
                "change_pct": idx.change_pct,
                "volume": idx.volume,
            }
            for idx in indices
        ]
    }


@router.get("/market/quote")
async def get_stock_quote(symbol: str = Query(..., description="股票代码，如 600519.SH / 00700.HK / AAPL")):
    """Get real-time stock quote."""
    quote = await market_service.get_quote(symbol)
    if quote is None:
        return {"error": f"无法获取 {symbol} 的行情数据", "symbol": symbol}
    return {
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


@router.get("/market/kline")
async def get_kline(
    symbol: str = Query(..., description="股票代码"),
    period: str = Query("daily", description="周期: daily/weekly/monthly"),
    count: int = Query(30, description="返回条数"),
):
    """Get K-line data."""
    bars = await market_service.get_kline(symbol, period, count)
    return {
        "symbol": symbol,
        "period": period,
        "data": [
            {
                "date": bar.date,
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
            }
            for bar in bars
        ],
    }


# ── Journal sync helper ──

async def _sync_journal(intent) -> None:
    """Auto-create/update trade journal entries when orders are filled."""
    import uuid
    from datetime import datetime
    from ..db.database import new_session
    from ..db.models import TradeJournal
    from sqlalchemy import select

    try:
        async with new_session() as db:
            if intent.action == "buy":
                # Open a new journal entry
                jid = str(uuid.uuid4())[:12]
                entry = TradeJournal(
                    journal_id=jid,
                    symbol=intent.symbol,
                    direction="long" if intent.action == "buy" else "short",
                    entry_date=datetime.now(),
                    entry_price=intent.price,
                    entry_quantity=intent.quantity,
                    entry_reason=intent.reason or "",
                    status="open",
                )
                db.add(entry)
                logger.info(f"Journal auto-created: {jid} buy {intent.symbol}")
            elif intent.action == "sell":
                # Close the latest open journal for this symbol
                result = await db.execute(
                    select(TradeJournal)
                    .where(TradeJournal.symbol == intent.symbol, TradeJournal.status == "open")
                    .order_by(TradeJournal.created_at.desc())
                    .limit(1)
                )
                entry = result.scalar_one_or_none()
                if entry and entry.entry_price:
                    entry.exit_price = intent.price
                    entry.exit_date = datetime.now()
                    entry.exit_reason = intent.reason or ""
                    entry.status = "closed"
                    entry.pnl = (intent.price - entry.entry_price) * (entry.entry_quantity or intent.quantity)
                    entry.pnl_pct = round((intent.price - entry.entry_price) / entry.entry_price * 100, 2)
                    entry.updated_at = datetime.now()
                    logger.info(f"Journal auto-closed: {entry.journal_id} PnL={entry.pnl:.2f}")
                else:
                    # No open position → create a direct close entry
                    jid = str(uuid.uuid4())[:12]
                    entry = TradeJournal(
                        journal_id=jid,
                        symbol=intent.symbol,
                        direction="long",
                        entry_date=datetime.now(),
                        entry_price=0,
                        entry_quantity=0,
                        exit_date=datetime.now(),
                        exit_price=intent.price,
                        exit_reason=intent.reason or "手动卖出",
                        status="closed",
                    )
                    db.add(entry)
    except Exception as e:
        logger.warning(f"Journal sync failed: {e}")
