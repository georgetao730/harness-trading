"""Gateway WebSocket server — FastAPI endpoint implementing the Node ↔ Python bridge.

Endpoint: ws://127.0.0.1:18766/v1
Protocol: docs/node-python-bridge.md

Lifecycle per connection:
  1. Wait for hello frame (30s timeout) → auth
  2. Enter main loop: request/response, event push, ping/pong
  3. On disconnect: clean up
"""

from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from ..security import verify_token

from .dispatcher import dispatcher
from .errors import HarnessError
from .frame import BridgeFrame

router = APIRouter()
GATEWAY_VERSION = "0.1.0"

# Registered features (will grow as sprints progress)
GATEWAY_FEATURES = ["broker", "skill", "workflow", "eval", "knowledge"]


@router.websocket("/v1")
async def gateway_ws(ws: WebSocket) -> None:
    """Main ws entry point for the bridge protocol."""
    await ws.accept()
    conn_id = ws.client.host if ws.client else "unknown"
    logger.info(f"Gateway connection opened: {conn_id}")

    # ── 1. Hello / auth handshake (30s timeout) ──
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
    except asyncio.TimeoutError:
        await ws.send_json(
            BridgeFrame.error_response(
                corr="",
                code="AUTH_FAIL",
                message="No hello frame received within 30s",
            ).model_dump(exclude_none=True),
        )
        await ws.close(code=4408, reason="hello timeout")
        return

    try:
        frame = BridgeFrame.model_validate(json.loads(raw))
    except Exception:
        await ws.send_json(
            BridgeFrame.error_response(
                corr="",
                code="BAD_REQUEST",
                message="Invalid frame JSON",
            ).model_dump(exclude_none=True),
        )
        await ws.close(code=4400)
        return

    if frame.kind != "hello":
        await ws.send_json(
            BridgeFrame.error_response(
                corr=frame.id,
                code="BAD_REQUEST",
                message="First frame must be hello",
            ).model_dump(exclude_none=True),
        )
        await ws.close(code=4400)
        return

    # Auth check
    token = frame.auth or ""
    if not verify_token(token):
        await ws.send_json(
            BridgeFrame.error_response(
                corr=frame.id,
                code="AUTH_FAIL",
                message="Invalid or missing token",
            ).model_dump(exclude_none=True),
        )
        await ws.close(code=4401, reason="auth failed")
        logger.warning(f"Auth rejected for {conn_id}")
        return

    # Send hello response
    hello_resp = BridgeFrame.response(
        corr=frame.id,
        result={
            "server": GATEWAY_VERSION,
            "features": GATEWAY_FEATURES,
        },
    )
    await ws.send_json(hello_resp.model_dump(exclude_none=True))
    logger.info(f"Gateway authenticated: {conn_id}")

    # ── 2. Main loop ──
    try:
        while True:
            raw = await ws.receive_text()
            try:
                frame = BridgeFrame.model_validate(json.loads(raw))
            except Exception:
                await ws.send_json(
                    BridgeFrame.error_response(
                        corr="",
                        code="BAD_REQUEST",
                        message="Invalid frame JSON",
                    ).model_dump(exclude_none=True),
                )
                continue

            if frame.kind == "ping":
                pong = BridgeFrame.pong(corr=frame.id)
                await ws.send_json(pong.model_dump(exclude_none=True))

            elif frame.kind == "request":
                if frame.method == "task.cancel":
                    target = frame.params.get("target", "") if frame.params else ""
                    resp = await dispatcher.cancel_task(target)
                elif frame.method == "gateway.ping":
                    resp = BridgeFrame.response(
                        corr=frame.id,
                        result={"pong": True, "ts": int(time.time() * 1000)},
                    )
                else:
                    resp = await dispatcher.dispatch(frame)
                await ws.send_json(resp.model_dump(exclude_none=True))

            else:
                await ws.send_json(
                    BridgeFrame.error_response(
                        corr=frame.id,
                        code="BAD_REQUEST",
                        message=f"Unexpected frame kind: {frame.kind}",
                    ).model_dump(exclude_none=True),
                )

    except WebSocketDisconnect:
        logger.info(f"Gateway connection closed: {conn_id}")
    except Exception:
        logger.exception(f"Gateway error for {conn_id}")
