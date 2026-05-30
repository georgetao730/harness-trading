// WebSocket client for the Node ↔ Python bridge.
// See docs/node-python-bridge.md for the full protocol.

import type { WebSocket } from 'ws';

import { readToken } from './auth';
import { type BridgeFrame, helloFrame, pingFrame, requestFrame, ulid } from './frame';

export type { BridgeFrame };

export interface BridgeClientOptions {
  /** Gateway URL, default: ws://127.0.0.1:18766/v1 */
  url?: string;
  /** Auth token. If not provided, reads from ~/.harness-trading/auth.json */
  token?: string;
  /** Client identifier (cli / web / hook) */
  client?: string;
  /** Client version */
  version?: string;
  /** Ping interval in ms (default 30_000) */
  pingIntervalMs?: number;
  /** Request timeout in ms (default 60_000) */
  requestTimeoutMs?: number;
}

interface PendingRequest {
  resolve: (frame: BridgeFrame) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Typed event emitter hook for server-pushed events. */
export type EventHandler = (method: string, params: Record<string, unknown>) => void;

export class BridgeClient {
  private _ws: WebSocket | null = null;
  private _url: string;
  private _token: string;
  private _client: string;
  private _version: string;
  private _pingMs: number;
  private _timeoutMs: number;

  private _pending: Map<string, PendingRequest> = new Map();
  private _pingTimer: ReturnType<typeof setInterval> | null = null;
  private _eventHandlers: Set<EventHandler> = new Set();
  private _closed = false;

  constructor(options: BridgeClientOptions = {}) {
    this._url = options.url ?? 'ws://127.0.0.1:18766/v1';
    this._token = options.token ?? readToken() ?? '';
    this._client = options.client ?? 'cli';
    this._version = options.version ?? '0.1.0';
    this._pingMs = options.pingIntervalMs ?? 30_000;
    this._timeoutMs = options.requestTimeoutMs ?? 60_000;
  }

  // ── lifecycle ──

  async connect(): Promise<{ server: string; features: string[] }> {
    const { default: WebSocketImpl } = await import('ws');
    return new Promise((resolve, reject) => {
      const ws = new WebSocketImpl(this._url);
      this._ws = ws;

      ws.on('open', () => {
        // Send hello
        const hello = helloFrame(this._token, this._client, this._version);
        ws.send(JSON.stringify(hello));
      });

      ws.on('message', (raw: Buffer) => {
        let frame: BridgeFrame;
        try {
          frame = JSON.parse(raw.toString()) as BridgeFrame;
        } catch {
          return;
        }
        this._handleFrame(frame);
      });

      ws.on('error', (err: Error) => {
        if (!this._resolved) reject(err);
      });

      ws.on('close', () => {
        this._stopPing();
        this._rejectAll(new Error('Connection closed'));
      });

      // hello response handler
      const helloHandler = (frame: BridgeFrame) => {
        if (frame.kind === 'response' && frame.result) {
          this._off('hello', helloHandler);
          this._resolved = true;
          this._startPing();
          resolve({
            server: (frame.result.server as string) ?? 'unknown',
            features: (frame.result.features as string[]) ?? [],
          });
        } else if (frame.kind === 'error') {
          this._off('hello', helloHandler);
          reject(new Error(frame.error?.message ?? 'Auth failed'));
        }
      };
      this._on('hello', helloHandler);
    });
  }

  close(): void {
    this._closed = true;
    this._stopPing();
    this._rejectAll(new Error('Client closed'));
    this._ws?.close();
    this._ws = null;
  }

  // ── request / response ──

  async call(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this._ws) throw new Error('Not connected');

    const frame = requestFrame(method, params);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(frame.id);
        reject(new Error(`Request timeout: ${method}`));
      }, this._timeoutMs);

      this._pending.set(frame.id, {
        resolve: (f: BridgeFrame) => resolve(f.result ?? {}),
        reject,
        timer,
      });

      try {
        const sock = this._ws;
        if (!sock) throw new Error("Not connected");
        sock.send(JSON.stringify(frame));
      } catch (err) {
        clearTimeout(timer);
        this._pending.delete(frame.id);
        reject(err);
      }
    });
  }

  // ── events ──

  onEvent(handler: EventHandler): () => void {
    this._eventHandlers.add(handler);
    return () => {
      this._eventHandlers.delete(handler);
    };
  }

  get connected(): boolean {
    return this._ws !== null && this._ws.readyState === 1 /* OPEN */;
  }

  // ── internals ──

  private _resolved = false;
  private _helloHandlers: Array<(frame: BridgeFrame) => void> = [];

  private _on(_tag: string, handler: (frame: BridgeFrame) => void) {
    this._helloHandlers.push(handler);
  }

  private _off(_tag: string, handler: (frame: BridgeFrame) => void) {
    this._helloHandlers = this._helloHandlers.filter((h) => h !== handler);
  }

  private _handleFrame(frame: BridgeFrame): void {
    // hello-phase handlers
    for (const h of this._helloHandlers) {
      h(frame);
    }

    // pending request
    const corr = frame.corr ?? frame.id;
    const pending = this._pending.get(corr);
    if (pending) {
      clearTimeout(pending.timer);
      this._pending.delete(corr);
      if (frame.kind === 'error') {
        pending.reject(new Error(frame.error?.message ?? 'Unknown error'));
      } else {
        pending.resolve(frame);
      }
      return;
    }

    // server-pushed events
    if (frame.kind === 'event' && frame.method) {
      for (const handler of this._eventHandlers) {
        handler(frame.method, (frame.params ?? {}) as Record<string, unknown>);
      }
    }
  }

  private _startPing(): void {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      if (this.connected && this._ws) {
        this._ws.send(JSON.stringify(pingFrame()));
      }
    }, this._pingMs);
  }

  private _stopPing(): void {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  private _rejectAll(err: Error): void {
    for (const [, pending] of this._pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this._pending.clear();
  }
}

/** Quick one-shot: connect, call a method, return result, close. */
export async function callOnce(
  method: string,
  params?: Record<string, unknown>,
  options?: BridgeClientOptions,
): Promise<Record<string, unknown>> {
  const client = new BridgeClient(options);
  try {
    await client.connect();
    return await client.call(method, params);
  } finally {
    client.close();
  }
}
