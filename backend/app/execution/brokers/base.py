"""Broker Adapter Base — abstract interface for real/simulated broker connections.

All broker adapters implement the BrokerChannel protocol and add:
  - Connection lifecycle: connect / disconnect / status
  - Market data integration for realistic fills
  - Account/position/order queries
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any


class BrokerAdapter(ABC):
    """Abstract base for broker adapters (paper, eastmoney, huatai, etc.)."""

    # Set by subclass
    name: str = "base"
    broker_code: str = "BASE"

    # ── Connection ──

    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to the broker. Returns True on success."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Close the broker connection."""
        ...

    @abstractmethod
    async def status(self) -> dict[str, Any]:
        """Return connection and account status.

        Returns:
            {"connected": bool, "logged_in": bool, "account_id": str, "message": str}
        """
        ...

    # ── Trading ──

    @abstractmethod
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
        """Submit an order. Returns order dict with order_id."""
        ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an open order."""
        ...

    # ── Queries ──

    @abstractmethod
    async def get_positions(self) -> list[dict[str, Any]]:
        """List current positions."""
        ...

    @abstractmethod
    async def get_orders(self, status_filter: str | None = None) -> list[dict[str, Any]]:
        """List orders, optionally filtered by status."""
        ...

    @abstractmethod
    async def get_account(self) -> dict[str, Any]:
        """Return account summary."""
        ...

    # ── Stream ──

    async def stream_orders(self) -> AsyncIterator[dict[str, Any]]:
        """Yield order updates (status changes, fills). Optional."""
        return
        yield {}  # pragma: no cover
