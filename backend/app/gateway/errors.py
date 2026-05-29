"""Gateway errors — HarnessError class + dispatcher catch-all.

Every business-layer error must be raised as HarnessError so the dispatcher
can produce a structured error frame with proper retryable semantics.
"""

from __future__ import annotations

from typing import Any


class HarnessError(Exception):
    """Structured error with code, message, optional data, and retryable flag.

    Raisers should use the error codes defined in docs/node-python-bridge.md §6.
    """

    def __init__(
        self,
        code: str,
        message: str,
        data: dict[str, Any] | None = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data or {}
        self.retryable = retryable
