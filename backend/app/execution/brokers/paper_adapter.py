"""Paper Broker Adapter — full BrokerAdapter backed by PaperTradingEngine."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from loguru import logger

from .base import BrokerAdapter
from ..paper_trading import PaperTradingEngine


class PaperBrokerAdapter(BrokerAdapter):
    """Paper trading broker adapter with connection lifecycle management.

    Supports:
      - Dry-run trading with HarnessToken safety gate
      - Real-time position/order tracking
      - Simulated fills at market price
      - Portfolio performance metrics
    """

    name = "paper"
    broker_code = "PAPER"

    def __init__(self, engine: PaperTradingEngine | None = None, initial_cash: float = 1_000_000.0):
        self._engine = engine or PaperTradingEngine(initial_cash=initial_cash)
        self._connected = False
        self._config: dict[str, Any] = {
            "initial_cash": initial_cash,
            "commission_rate": 0.0003,  # 万三
            "min_commission": 5.0,       # 最低5元
            "stamp_tax_rate": 0.001,     # 印花税 (卖出时)
        }

    # ── Connection ──

    async def connect(self) -> bool:
        self._connected = True
        logger.info(f"PaperBroker connected (cash={self._engine.cash})")
        return True

    async def disconnect(self) -> None:
        self._connected = False
        logger.info("PaperBroker disconnected")

    async def status(self) -> dict[str, Any]:
        return {
            "connected": self._connected,
            "logged_in": True,
            "account_id": "paper-001",
            "message": f"Paper trading · 现金 {self._engine.cash:,.0f}",
            "broker_code": self.broker_code,
            "config": self._config,
        }

    # ── Trading ──

    async def submit_order(
        self,
        symbol: str,
        side: str,
        quantity: int,
        price: float | None = None,
        *,
        order_type: str = "limit",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Submit a paper order. Auto-fills immediately."""
        fill_price = price or 0.0
        reason = kwargs.get("reason", "")

        order = self._engine.place_order(
            symbol=symbol,
            action=side,
            price=fill_price,
            quantity=quantity,
            reason=reason,
        )
        self._engine.fill_order(order.id, fill_price)

        filled = next((o for o in self._engine.orders if o.id == order.id), None)
        return {
            "order_id": order.id,
            "status": filled.status if filled else "filled",
            "filled_price": filled.filled_price if filled else fill_price,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "message": f"Paper {side} {quantity} {symbol} @ {fill_price}",
        }

    async def cancel_order(self, order_id: str) -> bool:
        order = next((o for o in self._engine.orders if o.id == order_id), None)
        if order and order.status == "pending":
            order.status = "cancelled"
            return True
        return False

    # ── Queries ──

    async def get_positions(self) -> list[dict[str, Any]]:
        return [
            {
                "symbol": p.symbol,
                "shares": p.shares,
                "avg_cost": round(p.avg_cost, 2),
                "current_price": p.current_price,
                "market_value": round(p.market_value, 2),
                "unrealized_pnl": round(p.unrealized_pnl, 2),
                "unrealized_pnl_pct": round(p.unrealized_pnl_pct, 2),
            }
            for p in self._engine.positions.values()
        ]

    async def get_orders(self, status_filter: str | None = None) -> list[dict[str, Any]]:
        orders = self._engine.orders
        if status_filter:
            orders = [o for o in orders if o.status == status_filter]
        return [
            {
                "id": o.id,
                "symbol": o.symbol,
                "action": o.action,
                "price": o.price,
                "quantity": o.quantity,
                "status": o.status,
                "filled_price": o.filled_price,
                "created_at": o.created_at,
                "reason": o.reason,
            }
            for o in orders
        ]

    async def get_account(self) -> dict[str, Any]:
        summary = self._engine.get_portfolio_summary()
        summary["commission_config"] = self._config
        summary["connected"] = self._connected
        summary["broker_code"] = self.broker_code
        return summary

    # ── Extra: trade history ──

    async def get_trade_history(self) -> list[dict[str, Any]]:
        """Return closed trades with PnL."""
        return [
            {
                **t,
                "pnl": round(t["pnl"], 2),
                "pnl_pct": round(t["pnl_pct"], 2),
            }
            for t in self._engine.closed_trades
        ]

    # ── Extra: update market prices ──

    async def update_market_prices(self, prices: dict[str, float]) -> None:
        """Update current prices for all positions (affects PnL)."""
        self._engine.update_market_prices(prices)
