"""Gateway dispatcher — method registry + asyncio dispatch.

All business methods (skill.invoke, workflow.run, etc.) register here.
The dispatcher maps incoming request method names to handler coroutines.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from loguru import logger

from .errors import HarnessError
from .frame import BridgeFrame

# Handler signature: async def handler(params: dict) -> dict
Handler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


class Dispatcher:
    """Method registry that routes incoming request frames to handlers."""

    def __init__(self) -> None:
        self._handlers: dict[str, Handler] = {}
        self._running_tasks: dict[str, asyncio.Task[dict[str, Any]]] = {}

    def register(self, method: str, handler: Handler) -> None:
        """Register a handler for a method name."""
        if method in self._handlers:
            logger.warning(f"Overwriting handler for method: {method}")
        self._handlers[method] = handler
        logger.debug(f"Registered dispatch handler: {method}")

    def is_registered(self, method: str) -> bool:
        return method in self._handlers

    async def dispatch(self, frame: BridgeFrame) -> BridgeFrame:
        """Route a request frame to its handler, return a response/error frame."""
        method = frame.method
        if method is None:
            return BridgeFrame.error_response(
                corr=frame.id,
                code="BAD_REQUEST",
                message="Missing method field",
            )

        handler = self._handlers.get(method)
        if handler is None:
            return BridgeFrame.error_response(
                corr=frame.id,
                code="METHOD_NOT_FOUND",
                message=f"Unknown method: {method}",
            )

        try:
            result = await asyncio.wait_for(
                handler(frame.params or {}),
                timeout=60.0,
            )
        except asyncio.TimeoutError:
            return BridgeFrame.error_response(
                corr=frame.id,
                code="TIMEOUT",
                message="Handler timed out",
                retryable=True,
            )
        except HarnessError as exc:
            return BridgeFrame.error_response(
                corr=frame.id,
                code=exc.code,
                message=exc.message,
                data=exc.data,
                retryable=exc.retryable,
            )
        except Exception:
            logger.exception(f"Unhandled error in method {method}")
            return BridgeFrame.error_response(
                corr=frame.id,
                code="INTERNAL",
                message="Internal server error",
                retryable=False,
            )

        return BridgeFrame.response(corr=frame.id, result=result)

    async def cancel_task(self, target_id: str) -> BridgeFrame:
        """Cancel a running task by its request id."""
        task = self._running_tasks.pop(target_id, None)
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            return BridgeFrame.response(
                corr=target_id,
                result={"cancelled": True},
            )
        return BridgeFrame.error_response(
            corr=target_id,
            code="METHOD_NOT_FOUND",
            message=f"No running task for id: {target_id}",
        )


# Global dispatcher instance
dispatcher = Dispatcher()
