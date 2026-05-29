"""Paper Trading - Simulated trading execution"""

import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from loguru import logger


@dataclass
class PaperOrder:
    id: str
    symbol: str
    action: str  # buy, sell
    order_type: str
    price: float
    quantity: int
    status: str = "pending"  # pending, filled, cancelled, rejected
    filled_price: Optional[float] = None
    filled_time: Optional[str] = None
    reason: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class PaperPosition:
    symbol: str
    shares: int
    avg_cost: float
    current_price: float
    market_value: float = 0.0
    unrealized_pnl: float = 0.0
    unrealized_pnl_pct: float = 0.0

    def __post_init__(self):
        self.market_value = self.shares * self.current_price
        self.unrealized_pnl = self.market_value - (self.shares * self.avg_cost)
        if self.shares > 0:
            self.unrealized_pnl_pct = (self.current_price - self.avg_cost) / self.avg_cost * 100


class PaperTradingEngine:
    """Simulated trading engine for testing strategies risk-free."""

    def __init__(self, initial_cash: float = 1000000.0):
        self.cash = initial_cash
        self.initial_cash = initial_cash
        self.positions: Dict[str, PaperPosition] = {}
        self.orders: List[PaperOrder] = []
        self.closed_trades: List[Dict] = []

    def place_order(self, symbol: str, action: str, price: float, quantity: int, reason: str = "") -> PaperOrder:
        """Place a simulated order."""
        order = PaperOrder(
            id=str(uuid.uuid4())[:8],
            symbol=symbol,
            action=action,
            order_type="limit",
            price=price,
            quantity=quantity,
            reason=reason,
        )
        self.orders.append(order)
        logger.info(f"Paper order: {action} {quantity} {symbol} @ {price}")
        return order

    def fill_order(self, order_id: str, fill_price: Optional[float] = None) -> PaperOrder:
        """Execute (fill) a paper order."""
        order = next((o for o in self.orders if o.id == order_id), None)
        if not order:
            raise ValueError(f"Order {order_id} not found")

        fill_price = fill_price or order.price
        order.status = "filled"
        order.filled_price = fill_price
        order.filled_time = datetime.now().isoformat()

        total = fill_price * order.quantity

        if order.action == "buy":
            if total > self.cash:
                raise ValueError(f"Insufficient funds: need {total}, have {self.cash}")
            self.cash -= total

            pos = self.positions.get(order.symbol)
            if pos:
                new_total_cost = pos.shares * pos.avg_cost + total
                new_shares = pos.shares + order.quantity
                pos.avg_cost = new_total_cost / new_shares
                pos.shares = new_shares
                pos.current_price = fill_price
                pos.__post_init__()
            else:
                self.positions[order.symbol] = PaperPosition(
                    symbol=order.symbol,
                    shares=order.quantity,
                    avg_cost=fill_price,
                    current_price=fill_price,
                )
        else:  # sell
            pos = self.positions.get(order.symbol)
            if not pos or pos.shares < order.quantity:
                raise ValueError(f"Insufficient shares: have {pos.shares if pos else 0}, need {order.quantity}")

            self.cash += total
            realized_pnl = (fill_price - pos.avg_cost) * order.quantity
            self.closed_trades.append({
                "symbol": order.symbol,
                "action": "sell",
                "buy_price": pos.avg_cost,
                "sell_price": fill_price,
                "quantity": order.quantity,
                "pnl": realized_pnl,
                "pnl_pct": (fill_price - pos.avg_cost) / pos.avg_cost * 100,
                "date": datetime.now().isoformat(),
            })

            pos.shares -= order.quantity
            if pos.shares == 0:
                del self.positions[order.symbol]
            else:
                pos.current_price = fill_price
                pos.__post_init__()

        logger.info(f"Filled {order.action} {order.quantity} {order.symbol} @ {fill_price}")
        return order

    def get_portfolio_summary(self) -> dict:
        total_positions_value = sum(p.market_value for p in self.positions.values())
        total_value = self.cash + total_positions_value
        total_pnl = total_value - self.initial_cash

        return {
            "cash": round(self.cash, 2),
            "positions_value": round(total_positions_value, 2),
            "total_value": round(total_value, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round(total_pnl / self.initial_cash * 100, 2),
            "position_count": len(self.positions),
            "trade_count": len([o for o in self.orders if o.status == "filled"]),
        }

    def update_market_prices(self, prices: Dict[str, float]):
        """Update current market prices for all positions."""
        for symbol, price in prices.items():
            if symbol in self.positions:
                self.positions[symbol].current_price = price
                self.positions[symbol].__post_init__()


# Global paper trading engine
paper_engine = PaperTradingEngine()
