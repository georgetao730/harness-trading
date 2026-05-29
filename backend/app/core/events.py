"""Event Bus - Publish/Subscribe for real-time updates"""

import asyncio
from typing import Any, Callable, Dict, List
from enum import Enum
from loguru import logger


class EventType(str, Enum):
    # Agent events
    AGENT_THINKING_START = "agent.thinking.start"
    AGENT_THINKING_STEP = "agent.thinking.step"
    AGENT_THINKING_DONE = "agent.thinking.done"
    AGENT_DECISION = "agent.decision"

    # Order events
    ORDER_CREATED = "order.created"
    ORDER_VALIDATED = "order.validated"
    ORDER_REJECTED = "order.rejected"
    ORDER_APPROVED = "order.approved"
    ORDER_EXECUTED = "order.executed"
    ORDER_CANCELLED = "order.cancelled"

    # Harness events
    CIRCUIT_BREAKER_TRIGGERED = "harness.circuit_breaker.triggered"
    CIRCUIT_BREAKER_RESET = "harness.circuit_breaker.reset"
    VALIDATION_FAILED = "harness.validation.failed"
    MODE_CHANGED = "harness.mode.changed"

    # Market events
    MARKET_DATA_UPDATED = "market.data.updated"
    POSITION_UPDATED = "position.updated"

    # System events
    SYSTEM_ERROR = "system.error"
    SYSTEM_WARNING = "system.warning"


EventHandler = Callable[[Dict[str, Any]], Any]


class EventBus:
    """Simple async event bus for internal communication."""

    def __init__(self):
        self._subscribers: Dict[str, List[EventHandler]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, event_type: EventType, handler: EventHandler):
        async with self._lock:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []
            self._subscribers[event_type].append(handler)
            logger.debug(f"Subscribed to {event_type}")

    async def publish(self, event_type: EventType, data: Dict[str, Any] = None):
        handlers = self._subscribers.get(event_type, [])
        if not handlers:
            return

        payload = data or {}
        logger.debug(f"Publishing {event_type}: {payload}")

        tasks = [handler(payload) for handler in handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Event handler error: {result}")


# Global event bus instance
event_bus = EventBus()
