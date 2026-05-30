"""Tests for Gateway Dispatcher — method registration, dispatch, error handling."""

import asyncio

import pytest

from app.gateway.dispatcher import Dispatcher
from app.gateway.frame import BridgeFrame
from app.gateway.errors import HarnessError


def _make_request(method: str, params: dict | None = None, req_id: str = "req-1") -> BridgeFrame:
    """Build a request frame (no built-in classmethod for requests)."""
    return BridgeFrame(
        kind="request",
        id=req_id,
        method=method,
        params=params or {},
    )


def _make_request_no_method(req_id: str = "req-1") -> BridgeFrame:
    """Build a request frame missing the method field."""
    return BridgeFrame(kind="request", id=req_id)


class TestDispatcher:
    """Test method registration and dispatch."""

    def test_register_and_dispatch(self):
        dispatcher = Dispatcher()

        async def echo_handler(params: dict) -> dict:
            return {"echo": params.get("msg", "")}

        dispatcher.register("echo", echo_handler)

        frame = _make_request("echo", {"msg": "hello"})
        result_frame = asyncio.run(dispatcher.dispatch(frame))

        assert result_frame.kind == "response"
        assert result_frame.id == frame.id
        assert result_frame.result["echo"] == "hello"

    def test_method_not_found(self):
        dispatcher = Dispatcher()
        frame = _make_request("unknown.method")

        result_frame = asyncio.run(dispatcher.dispatch(frame))

        assert result_frame.kind == "error"
        assert result_frame.error["code"] == "METHOD_NOT_FOUND"

    def test_missing_method_field(self):
        dispatcher = Dispatcher()
        frame = _make_request_no_method()

        result_frame = asyncio.run(dispatcher.dispatch(frame))

        assert result_frame.kind == "error"
        assert result_frame.error["code"] == "BAD_REQUEST"

    def test_handler_harness_error(self):
        dispatcher = Dispatcher()

        async def bad_handler(params: dict) -> dict:
            raise HarnessError(code="RISK_TRIGGERED", message="Risk limit exceeded")

        dispatcher.register("risky", bad_handler)

        frame = _make_request("risky")
        result_frame = asyncio.run(dispatcher.dispatch(frame))

        assert result_frame.kind == "error"
        assert result_frame.error["code"] == "RISK_TRIGGERED"
        assert result_frame.error["message"] == "Risk limit exceeded"

    def test_handler_runtime_exception(self):
        dispatcher = Dispatcher()

        async def crash_handler(params: dict) -> dict:
            raise RuntimeError("Something went wrong")

        dispatcher.register("crash", crash_handler)

        frame = _make_request("crash")
        result_frame = asyncio.run(dispatcher.dispatch(frame))

        assert result_frame.kind == "error"
        assert result_frame.error["code"] == "INTERNAL"

    def test_is_registered(self):
        dispatcher = Dispatcher()
        assert not dispatcher.is_registered("test")

        async def noop(params: dict) -> dict:
            return {}

        dispatcher.register("test", noop)
        assert dispatcher.is_registered("test")

    def test_response_frame_has_correct_corr(self):
        dispatcher = Dispatcher()

        async def handler(params: dict) -> dict:
            return {"result": "ok"}

        dispatcher.register("test", handler)

        frame = _make_request("test", req_id="corr-123")
        result_frame = asyncio.run(dispatcher.dispatch(frame))

        assert result_frame.id == "corr-123"
        assert result_frame.kind == "response"


class TestBridgeFrame:
    """Test frame construction via classmethods."""

    def test_response_frame(self):
        frame = BridgeFrame.response(corr="req-1", result={"data": 42})
        assert frame.kind == "response"
        assert frame.id == "req-1"
        assert frame.result == {"data": 42}

    def test_error_response_frame(self):
        frame = BridgeFrame.error_response(
            corr="req-2", code="TIMEOUT", message="Handler timed out", retryable=True,
        )
        assert frame.kind == "error"
        assert frame.id == "req-2"
        assert frame.error["code"] == "TIMEOUT"
        assert frame.error["retryable"] is True

    def test_event_frame(self):
        frame = BridgeFrame.event(method="market.tick", params={"symbol": "600519"})
        assert frame.kind == "event"
        assert frame.method == "market.tick"
        assert frame.params["symbol"] == "600519"
        assert frame.id  # should be non-empty ULID

    def test_pong_frame(self):
        frame = BridgeFrame.pong(corr="ping-1")
        assert frame.kind == "pong"
        assert frame.id == "ping-1"
        assert frame.corr == "ping-1"

    def test_request_frame_manual(self):
        """Request frames are built manually (no classmethod)."""
        frame = BridgeFrame(kind="request", id="abc", method="skill.invoke", params={"a": 1})
        assert frame.kind == "request"
        assert frame.method == "skill.invoke"
        assert frame.params == {"a": 1}

    def test_frame_to_dict_and_back(self):
        original = BridgeFrame.response(corr="abc", result={"x": 1})
        d = original.model_dump()
        restored = BridgeFrame.model_validate(d)
        assert restored.kind == original.kind
        assert restored.result == original.result
        assert restored.id == original.id
