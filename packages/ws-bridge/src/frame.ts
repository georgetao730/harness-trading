// Frame types matching the Node ↔ Python bridge protocol.
// See docs/node-python-bridge.md §2 for the wire format.

export type FrameKind = 'request' | 'response' | 'event' | 'error' | 'ping' | 'pong' | 'hello';

export interface BridgeFrame {
  v: number; // protocol version, == 1
  id: string; // ULID
  kind: FrameKind;
  ts?: number; // unix ms
  method?: string; // required for request / event
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    data?: Record<string, unknown>;
    retryable?: boolean;
  };
  auth?: string; // hello frame only
  corr?: string; // correlation id
}

// ── Builders ──

let _ulidCounter = 0;

/** Generate a simple ULID-like id (26 chars, timestamp-prefixed). */
export function ulid(): string {
  const ts = Date.now().toString(32).padStart(10, '0');
  const rand = Math.random().toString(32).slice(2, 12);
  const count = (++_ulidCounter % 10000).toString(32).padStart(4, '0');
  return `${ts}${rand}${count}`;
}

export function helloFrame(auth: string, client = 'cli', ver = '0.1.0'): BridgeFrame {
  return {
    v: 1,
    id: ulid(),
    kind: 'hello',
    ts: Date.now(),
    auth,
    params: { client, ver },
  };
}

export function requestFrame(method: string, params?: Record<string, unknown>): BridgeFrame {
  const frame: BridgeFrame = {
    v: 1,
    id: ulid(),
    kind: 'request',
    ts: Date.now(),
    method,
  };
  if (params !== undefined) frame.params = params;
  return frame;
}

export function pingFrame(): BridgeFrame {
  return {
    v: 1,
    id: ulid(),
    kind: 'ping',
    ts: Date.now(),
  };
}

export function cancelFrame(targetId: string): BridgeFrame {
  return requestFrame('task.cancel', { target: targetId });
}
