"""Gateway frame models — Pydantic schemas matching the Node ↔ Python bridge protocol.

See docs/node-python-bridge.md §2 for the wire format.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# --- Envelope kinds ---
FrameKind = Literal["request", "response", "event", "error", "ping", "pong", "hello"]


class BridgeFrame(BaseModel):
    """Top-level envelope for all ws frames."""

    v: int = Field(default=1, description="Protocol version")
    id: str = Field(description="ULID, client-generated per request; server-generated for events")
    kind: FrameKind = Field(description="Frame kind")
    ts: int = Field(default=0, description="Unix ms timestamp")
    method: Optional[str] = Field(default=None, description="Method name (required for request/event)")
    params: Optional[dict[str, Any]] = Field(default=None, description="Request/event payload")
    result: Optional[dict[str, Any]] = Field(default=None, description="Response payload")
    error: Optional[dict[str, Any]] = Field(default=None, description="Error payload")
    auth: Optional[str] = Field(default=None, description="Bearer token (hello frame only)")
    corr: Optional[str] = Field(default=None, description="Correlation id, linking response to request")

    # ── convenience builders ──

    @classmethod
    def response(cls, *, corr: str, result: Optional[dict[str, Any]] = None) -> BridgeFrame:
        """Build a response frame."""
        return cls(
            kind="response",
            id=corr,
            corr=corr,
            result=result or {},
        )

    @classmethod
    def error_response(
        cls,
        *,
        corr: str,
        code: str,
        message: str,
        data: Optional[dict[str, Any]] = None,
        retryable: bool = False,
    ) -> BridgeFrame:
        """Build an error response frame."""
        return cls(
            kind="error",
            id=corr,
            corr=corr,
            error={
                "code": code,
                "message": message,
                "data": data or {},
                "retryable": retryable,
            },
        )

    @classmethod
    def event(cls, *, method: str, params: dict[str, Any]) -> BridgeFrame:
        """Build a server-pushed event frame."""
        import ulid

        return cls(
            kind="event",
            id=str(ulid.ULID()),
            method=method,
            params=params,
        )

    @classmethod
    def pong(cls, *, corr: str) -> BridgeFrame:
        """Build a pong response to a ping."""
        return cls(kind="pong", id=corr, corr=corr)
