"""Binance Broker Adapter — Paper trading with Binance market data.

BrokerAdapter for cryptocurrency paper trading. Uses Binance REST API
for realistic price fills. No API key required (paper trading only).

Key differences from stock brokers:
  - Commission: 0.1% (standard Binance spot fee)
  - No stamp tax, no minimum commission
  - Quantity is in base asset (e.g., 0.01 BTC)
  - Price is in quote asset (USDT)
  - Supports fractional quantities
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from loguru import logger

from .base import BrokerAdapter
from ..paper_trading import PaperTradingEngine
from ...services.binance_service import binance_service


class BinanceBrokerAdapter(BrokerAdapter):
    """Crypto paper broker using Binance market data for realistic fills.

    Supports:
      - Market/limit orders with Binance price feeds
      - Real-time PnL tracking
      - Binance-style fee structure (0.1%)
      - Position management with crypto-specific logic
    """

    name = "binance"
    broker_code = "BINANCE"

    def __init__(self, engine: PaperTradingEngine | None = None, initial_cash: float = 100_000.0):
        self._engine = engine or PaperTradingEngine(initial_cash=initial_cash)
        self._connected = False
        self._config: dict[str, Any] = {
            "initial_cash": initial_cash,
            "maker_fee": 0.001,    # 0.1%
            "taker_fee": 0.001,    # 0.1%
            "market": "crypto",
        }

    # ── Connection ──

    async def connect(self) -> bool:
        self._connected = True
        logger.info(f"BinanceBroker connected (cash={self._engine.cash})")
        return True

    async def disconnect(self) -> None:
        self._connected = False
        logger.info("BinanceBroker disconnected")

    async def status(self) -> dict[str, Any]:
        return {
            "connected": self._connected,
            "logged_in": True,
            "account_id": "binance-paper-001",
            "message": f"Binance Paper · USDT {self._engine.cash:,.0f}",
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
        """Submit a crypto paper order.

        For market orders (price=None), fetches current price from Binance.
        """
        fill_price = price

        # For market orders, get current Binance price
        if fill_price is None or fill_price == 0.0:
            try:
                fill_price = await binance_service.get_price(symbol) or 0.0
            except Exception as e:
                logger.warning(f"Failed to get price for {symbol}: {e}")
                fill_price = 0.0

        reason = kwargs.get("reason", "")

        # Place through paper engine
        order = self._engine.place_order(
            symbol=symbol,
            action=side,
            price=fill_price,
            quantity=quantity,
            reason=reason,
        )
        self._engine.fill_order(order.id, fill_price)

        # Apply Binance fee (0.1%)
        fee = fill_price * abs(quantity) * self._config["taker_fee"]
        if side == "buy":
            self._engine.cash -= fee
        elif side == "sell":
            self._engine.cash -= fee

        filled = next((o for o in self._engine.orders if o.id == order.id), None)
        return {
            "order_id": order.id,
            "status": filled.status if filled else "filled",
            "filled_price": filled.filled_price if filled else fill_price,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "fee": round(fee, 2),
            "message": f"Binance Paper {side} {quantity} {symbol} @ {fill_price} (fee={fee:.2f})",
        }

    async def cancel_order(self, order_id: str) -> bool:
        order = next((o for o in self._engine.orders if o.id == order_id), None)
        if order and order.status == "pending":
            order.status = "cancelled"
            return True
        return False

    # ── Queries ──

    async def get_positions(self) -> list[dict[str, Any]]:
        # Refresh prices from Binance
        try:
            symbols = list(self._engine.positions.keys())
            if symbols:
                prices = await binance_service.get_prices(symbols)
                self._engine.update_market_prices(prices)
        except Exception as e:
            logger.warning(f"Failed to update crypto prices: {e}")

        return [
            {
                "symbol": p.symbol,
                "shares": p.shares,
                "avg_cost": round(p.avg_cost, 6),
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

    async def get_trade_history(self) -> list[dict[str, Any]]:
        return [
            {**t, "pnl": round(t["pnl"], 2), "pnl_pct": round(t["pnl_pct"], 2)}
            for t in self._engine.closed_trades
        ]

    async def update_market_prices(self, prices: dict[str, float]) -> None:
        self._engine.update_market_prices(prices)
