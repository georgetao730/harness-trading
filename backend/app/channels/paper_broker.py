"""Paper Broker — BrokerChannel backed by PaperTradingEngine with HarnessToken gate.

This wraps the existing PaperTradingEngine as a BrokerChannel, adding
mandatory HarnessToken verification on every submit() call.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
import uuid

from loguru import logger

from .protocol import BrokerChannel
from ..execution.paper_trading import PaperTradingEngine
from ..security.harness import verify_harness_token_or_raise


class PaperBroker:
    """BrokerChannel implementation backed by in-memory paper trading engine.

    Safety model:
      1. Every submit() call MUST carry a valid HarnessToken.
      2. Token is verified (signature, expiry < 60s, action="submit").
      3. Only after token passes → order is placed on PaperTradingEngine.
    """

    name = "paper"

    def __init__(self, engine: PaperTradingEngine | None = None):
        self._engine = engine or PaperTradingEngine()

    # ── BrokerChannel methods ──

    async def submit(
        self,
        symbol: str,
        side: str,
        quantity: int,
        price: float | None = None,
        *,
        harness_token: str,
    ) -> dict[str, Any]:
        """Submit a paper order with mandatory HarnessToken verification.

        Returns:
            dict with order_id, status, filled_price, message
        """
        # 1. Verify HarnessToken (raises on failure)
        token_payload = verify_harness_token_or_raise(harness_token, expected_action="submit")

        logger.info(
            f"PaperBroker submit: {side} {quantity} {symbol} @ {price or 'market'} "
            f"(token_ts={token_payload.get('ts')}, nonce={token_payload.get('nonce')})"
        )

        # 2. Place paper order
        order = self._engine.place_order(
            symbol=symbol,
            action=side,
            price=price or 0.0,
            quantity=quantity,
            reason=token_payload.get("reason", ""),
        )

        # 3. Auto-fill (paper trading always fills immediately)
        self._engine.fill_order(order.id)
        filled_order = next((o for o in self._engine.orders if o.id == order.id), None)

        return {
            "order_id": order.id,
            "status": filled_order.status if filled_order else "filled",
            "filled_price": filled_order.filled_price if filled_order else price,
            "message": f"Paper {side} {quantity} {symbol} executed",
        }

    async def cancel(self, order_id: str) -> bool:
        """Cancel an open paper order."""
        order = next((o for o in self._engine.orders if o.id == order_id), None)
        if order and order.status == "pending":
            order.status = "cancelled"
            logger.info(f"PaperBroker cancelled: {order_id}")
            return True
        return False

    async def get_positions(self) -> list[dict[str, Any]]:
        """List paper positions."""
        return [
            {
                "symbol": p.symbol,
                "shares": p.shares,
                "avg_cost": p.avg_cost,
                "current_price": p.current_price,
                "market_value": p.market_value,
                "unrealized_pnl": p.unrealized_pnl,
                "unrealized_pnl_pct": round(p.unrealized_pnl_pct, 2),
            }
            for p in self._engine.positions.values()
        ]

    async def get_orders(self) -> list[dict[str, Any]]:
        """List paper orders."""
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
            }
            for o in self._engine.orders
        ]

    async def get_account(self) -> dict[str, Any]:
        """Return paper account summary."""
        return self._engine.get_portfolio_summary()
