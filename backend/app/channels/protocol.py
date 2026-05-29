"""Channels protocol — pluggable data/execution/alert pipelines.

Phase 2 architecture:
  FeedChannel   → real-time market data streams
  AlertChannel  → push notifications (dingtalk, slack, etc.)
  BrokerChannel → order execution with HarnessToken safety gate

NOTE: Because the environment may run Python 3.9, all type hints use
Optional[T] instead of T | None in Pydantic model fields.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Protocol, runtime_checkable


# ── Feed Channel ──

@runtime_checkable
class FeedChannel(Protocol):
    """Real-time market data feed."""

    name: str

    async def subscribe(self, symbols: list[str]) -> None:
        """Subscribe to tick/quote updates for given symbols."""
        ...

    async def unsubscribe(self, symbols: list[str]) -> None:
        """Stop receiving updates for symbols."""
        ...

    async def stream(self) -> AsyncIterator[dict[str, Any]]:
        """Yield tick events as they arrive."""
        ...
        yield {}  # pragma: no cover


# ── Alert Channel ──

@runtime_checkable
class AlertChannel(Protocol):
    """Push notifications for trade signals, risk alerts, status."""

    name: str

    async def send(self, title: str, body: str, level: str = "info") -> bool:
        """Send an alert. Returns True on success."""
        ...


# ── Broker Channel ──

@runtime_checkable
class BrokerChannel(Protocol):
    """Order execution channel with mandatory HarnessToken safety gate.

    Every trade-submit call MUST include a valid HarnessToken.
    The token is validated server-side by the Paper Broker or external
    broker before execution.
    """

    name: str

    async def submit(
        self,
        symbol: str,
        side: str,  # buy | sell
        quantity: int,
        price: float | None = None,
        *,
        harness_token: str,
    ) -> dict[str, Any]:
        """Submit an order.

        Args:
            symbol: Stock code
            side: 'buy' or 'sell'
            quantity: Number of shares
            price: Limit price (None = market order)
            harness_token: Base64-encoded HarnessToken (required)

        Returns:
            {"order_id": "...", "status": "filled|rejected", "filled_price": 0.0, ...}
        """
        ...

    async def cancel(self, order_id: str) -> bool:
        """Cancel an open order."""
        ...

    async def get_positions(self) -> list[dict[str, Any]]:
        """List current holdings."""
        ...

    async def get_orders(self) -> list[dict[str, Any]]:
        """List open/filled orders."""
        ...

    async def get_account(self) -> dict[str, Any]:
        """Return account summary (balance, pnl, etc.)."""
        ...
