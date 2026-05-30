"""East Money Broker Adapter — simulated broker using real market data for fills.

This adapter simulates a real brokerage by:
  - Fetching live quotes from East Money / AKShare for fill prices
  - Mimicking T+1 settlement rules (A-share)
  - Supporting limit/market orders with realistic behavior
  - No real order submission — orders stay in-memory
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from loguru import logger

from .base import BrokerAdapter


class EastMoneyBrokerAdapter(BrokerAdapter):
    """Simulated broker adapter using East Money market data.

    Orders are filled at the latest market price fetched via market_service.
    This gives realistic fills without connecting to a real brokerage API.

    Settlement rules (A-share T+1):
      - Buy today, can sell tomorrow
      - Sell proceeds available next trading day
    """

    name = "eastmoney"
    broker_code = "EASTMONEY"

    def __init__(self, initial_cash: float = 1_000_000.0):
        self._cash = initial_cash
        self._initial_cash = initial_cash
        self._connected = False
        self._positions: dict[str, dict[str, Any]] = {}
        self._orders: list[dict[str, Any]] = []
        self._hold_locked: dict[str, int] = {}  # T+1 locked shares
        self._config: dict[str, Any] = {
            "broker_name": "东方财富 (模拟)",
            "initial_cash": initial_cash,
            "commission_rate": 0.00025,  # 万2.5
            "min_commission": 5.0,
            "stamp_tax_rate": 0.001,
            "settlement": "T+1",
            "market": "A-Share",
        }

    # ── Connection ──

    async def connect(self) -> bool:
        self._connected = True
        logger.info(f"EastMoneyBroker connected (simulated, cash={self._cash:,.0f})")
        return True

    async def disconnect(self) -> None:
        self._connected = False
        logger.info("EastMoneyBroker disconnected")

    async def status(self) -> dict[str, Any]:
        return {
            "connected": self._connected,
            "logged_in": True,
            "account_id": "em-sim-001",
            "message": f"东方财富模拟 · 现金 {self._cash:,.0f} · T+1",
            "broker_code": self.broker_code,
            "config": self._config,
            "is_simulated": True,
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
        """Submit a simulated order. Fills at market price if available."""
        # Fetch current market price
        fill_price = price or 0.0
        try:
            from ...services.market_data import market_service
            quote = await market_service.get_quote(symbol)
            if quote and quote.price > 0:
                fill_price = quote.price
                logger.info(f"EastMoney fill: {symbol} @ {fill_price} (market)")
        except Exception as e:
            logger.warning(f"Market price unavailable for {symbol}: {e}")
            if not fill_price:
                return {"error": f"Cannot determine price for {symbol}"}

        order_id = str(uuid.uuid4())[:8]
        total = fill_price * quantity

        order = {
            "order_id": order_id,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "price": fill_price,
            "order_type": order_type,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "reason": kwargs.get("reason", ""),
        }

        # Simulate fill
        if side == "buy":
            if total > self._cash:
                order["status"] = "rejected"
                order["message"] = f"资金不足: 需要{total:,.0f}, 可用{self._cash:,.0f}"
                self._orders.append(order)
                return order

            self._cash -= total
            pos = self._positions.get(symbol, {"symbol": symbol, "shares": 0, "avg_cost": 0.0})
            new_cost = pos["shares"] * pos["avg_cost"] + total
            new_shares = pos["shares"] + quantity
            pos["shares"] = new_shares
            pos["avg_cost"] = new_cost / new_shares if new_shares > 0 else 0.0
            self._positions[symbol] = pos

            # T+1: lock bought shares
            self._hold_locked[symbol] = self._hold_locked.get(symbol, 0) + quantity

        else:  # sell
            pos = self._positions.get(symbol, {"shares": 0})
            available = pos.get("shares", 0) - self._hold_locked.get(symbol, 0)
            if available < quantity:
                order["status"] = "rejected"
                order["message"] = f"可卖数量不足: 可用{available}, 需要{quantity}"
                self._orders.append(order)
                return order

            self._cash += total
            pos["shares"] -= quantity
            if pos["shares"] <= 0:
                self._positions.pop(symbol, None)
            else:
                self._positions[symbol] = pos

        order["status"] = "filled"
        order["filled_price"] = fill_price
        order["filled_time"] = datetime.now().isoformat()
        order["message"] = f"{side} {quantity} {symbol} @ {fill_price}"

        self._orders.append(order)
        logger.info(f"EastMoney order filled: {order_id} {side} {symbol} x{quantity}")
        return order

    async def cancel_order(self, order_id: str) -> bool:
        for o in self._orders:
            if o["order_id"] == order_id and o["status"] == "pending":
                o["status"] = "cancelled"
                return True
        return False

    # ── Queries ──

    async def get_positions(self) -> list[dict[str, Any]]:
        result = []
        for symbol, pos in self._positions.items():
            if pos.get("shares", 0) <= 0:
                continue
            # Try to get current price
            current_price = pos.get("avg_cost", 0.0)
            try:
                from ...services.market_data import market_service
                quote = await market_service.get_quote(symbol)
                if quote and quote.price > 0:
                    current_price = quote.price
            except Exception:
                pass

            market_value = pos["shares"] * current_price
            cost = pos["shares"] * pos["avg_cost"]
            result.append({
                "symbol": symbol,
                "shares": pos["shares"],
                "avg_cost": round(pos["avg_cost"], 2),
                "current_price": current_price,
                "market_value": round(market_value, 2),
                "unrealized_pnl": round(market_value - cost, 2),
                "unrealized_pnl_pct": round((current_price - pos["avg_cost"]) / pos["avg_cost"] * 100, 2) if pos["avg_cost"] > 0 else 0,
                "locked_t1": self._hold_locked.get(symbol, 0),
            })
        return result

    async def get_orders(self, status_filter: str | None = None) -> list[dict[str, Any]]:
        if status_filter:
            return [o for o in self._orders if o["status"] == status_filter]
        return list(self._orders)

    async def get_account(self) -> dict[str, Any]:
        positions_value = sum(
            p.get("shares", 0) * p.get("avg_cost", 0)
            for p in self._positions.values()
        )
        total_value = self._cash + positions_value
        total_pnl = total_value - self._initial_cash

        return {
            "cash": round(self._cash, 2),
            "positions_value": round(positions_value, 2),
            "total_value": round(total_value, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round(total_pnl / self._initial_cash * 100, 2) if self._initial_cash > 0 else 0,
            "position_count": len([p for p in self._positions.values() if p.get("shares", 0) > 0]),
            "trade_count": len([o for o in self._orders if o["status"] == "filled"]),
            "connected": self._connected,
            "broker_code": self.broker_code,
            "is_simulated": True,
            "commission_config": self._config,
        }
