// Supervisor entry. Real implementation arrives in Sprint 1.
// Responsibilities: spawn `uv run uvicorn backend.app.gateway.server:app`,
// health-check the WebSocket port, restart on crash, expose status.
export const SUPERVISOR_VERSION = '0.0.1';
