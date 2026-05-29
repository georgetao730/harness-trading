"""Harness Workflow Launcher — shared CLI for agentic-hooks adapters.

Usage:
  python harness_launcher.py <workflow_name> [--inputs '{"key":"value"}']

Each AI coding agent (Claude Code, Codex, Cursor, Qoder) wraps this
launcher as an agent-side tool so its LLM can trigger Harness workflows.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

import websockets

GATEWAY_URL = os.environ.get("HARNESS_GATEWAY_URL", "ws://localhost:18766/gateway")


def _load_inputs(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    if raw.startswith("@"):
        # Read from file
        return json.loads(Path(raw[1:]).read_text())
    return json.loads(raw)


def _format_result(result: dict[str, Any]) -> str:
    """Format the gateway response for agent-friendly output."""
    if result.get("success"):
        data = result.get("data", {})
        status = data.get("status", "unknown")

        lines = [f"Workflow completed: {status}"]
        for stage in data.get("stages", []):
            icon = "✅" if stage["status"] == "ok" else "❌" if stage["status"] == "failed" else "⏭️"
            lines.append(f"  {icon} {stage['title']}: {stage['status']}")
            if stage.get("error"):
                lines.append(f"     Error: {stage['error']}")
        return "\n".join(lines)
    else:
        return f"Workflow failed: {result.get('error', 'Unknown error')}"


async def run_workflow(workflow_name: str, inputs: dict[str, Any]) -> str:
    """Connect to the Harness gateway over WebSocket and run a workflow."""
    async with websockets.connect(GATEWAY_URL) as ws:  # type: ignore[attr-defined]
        # Handshake
        handshake = await asyncio.wait_for(ws.recv(), timeout=5)
        print(f"[harness-launcher] Connected: {handshake}", file=sys.stderr)

        # Send workflow.run request
        request = {
            "id": "wf-1",
            "method": "workflow.run",
            "params": {
                "workflow": workflow_name,
                "inputs": inputs,
            },
        }
        await ws.send(json.dumps(request))

        # Wait for response
        raw = await asyncio.wait_for(ws.recv(), timeout=120)
        response = json.loads(raw)

        if "error" in response:
            return f"Error: {response['error'].get('message', response['error'])}"

        return _format_result(response)


async def list_workflows() -> str:
    """List available workflows from the gateway."""
    async with websockets.connect(GATEWAY_URL) as ws:  # type: ignore[attr-defined]
        handshake = await asyncio.wait_for(ws.recv(), timeout=5)
        print(f"[harness-launcher] Connected: {handshake}", file=sys.stderr)

        request = {"id": "wf-list", "method": "workflows.list", "params": {}}
        await ws.send(json.dumps(request))

        raw = await asyncio.wait_for(ws.recv(), timeout=10)
        response = json.loads(raw)

        if "error" in response:
            return f"Error: {response['error']}"

        wf_list = response.get("data", {})
        if not wf_list:
            return "No workflows registered."

        lines = ["Available workflows:"]
        for name, display in wf_list.items():
            lines.append(f"  - {name}: {display}")
        return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: harness_launcher.py <workflow_name> [--inputs '{\"key\":\"value\"}'|--list]")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "--list":
        result = asyncio.run(list_workflows())
        print(result)
        return

    workflow_name = cmd
    inputs = {}

    if len(sys.argv) >= 3 and sys.argv[2] == "--inputs":
        inputs = _load_inputs(sys.argv[3] if len(sys.argv) > 3 else None)

    result = asyncio.run(run_workflow(workflow_name, inputs))
    print(result)


if __name__ == "__main__":
    main()
