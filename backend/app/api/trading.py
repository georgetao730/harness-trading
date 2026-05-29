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
