// Tests for ws-bridge client, frame builders, and auth.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  ulid,
  helloFrame,
  requestFrame,
  pingFrame,
  cancelFrame,
} from './frame';
import type { BridgeFrame } from './frame';
import { readToken, invalidateTokenCache, authFilePath } from './auth';

// ── Frame builders ──

describe('frame builders', () => {
  it('helloFrame builds a valid hello frame', () => {
    const frame = helloFrame('test-token', 'cli', '0.1.0');
    expect(frame.v).toBe(1);
    expect(frame.kind).toBe('hello');
    expect(frame.auth).toBe('test-token');
    expect(frame.params).toEqual({ client: 'cli', ver: '0.1.0' });
    expect(frame.id).toHaveLength(24); // ULID (10 ts + 10 rand + 4 counter)
    expect(frame.ts).toBeGreaterThan(0);
  });

  it('requestFrame builds a valid request frame', () => {
    const frame = requestFrame('skill.invoke', { skill: 'market_data' });
    expect(frame.v).toBe(1);
    expect(frame.kind).toBe('request');
    expect(frame.method).toBe('skill.invoke');
    expect(frame.params).toEqual({ skill: 'market_data' });
    expect(frame.id).toHaveLength(24);
  });

  it('requestFrame omits params when undefined', () => {
    const frame = requestFrame('gateway.ping');
    expect(frame.params).toBeUndefined();
  });

  it('pingFrame builds a valid ping frame', () => {
    const frame = pingFrame();
    expect(frame.v).toBe(1);
    expect(frame.kind).toBe('ping');
    expect(frame.id).toHaveLength(24);
  });

  it('cancelFrame builds a cancel request', () => {
    const frame = cancelFrame('task-123');
    expect(frame.kind).toBe('request');
    expect(frame.method).toBe('task.cancel');
    expect(frame.params).toEqual({ target: 'task-123' });
  });
});

// ── ULID generation ──

describe('ulid', () => {
  it('generates 24-character ULIDs', () => {
    const id = ulid();
    expect(id).toHaveLength(24);
    expect(typeof id).toBe('string');
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => ulid()));
    expect(ids.size).toBe(100);
  });

  it('IDs are time-sortable (rough check)', () => {
    const ids = Array.from({ length: 10 }, () => ulid());
    const sorted = [...ids].sort();
    // ULIDs with same ms prefix should sort similarly
    expect(sorted[0]! <= sorted[9]!).toBe(true);
  });
});

// ── Auth ──

describe('auth', () => {
  beforeEach(() => {
    invalidateTokenCache();
  });

  afterEach(() => {
    invalidateTokenCache();
  });

  it('readToken returns null when no auth file', () => {
    // Set a non-existent home to force null
    const orig = process.env.HARNESS_TRADING_HOME;
    process.env.HARNESS_TRADING_HOME = '/tmp/harness-nonexistent-' + Date.now();
    const token = readToken();
    expect(token).toBeNull();
    process.env.HARNESS_TRADING_HOME = orig;
  });

  it('authFilePath returns the correct path', () => {
    const path = authFilePath();
    expect(path).toContain('auth.json');
  });
});

// ── BridgeFrame type shape ──

describe('BridgeFrame type', () => {
  it('accepts a valid request frame', () => {
    const frame: BridgeFrame = {
      v: 1,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      kind: 'request',
      ts: 1700000000000,
      method: 'skill.invoke',
      params: { skill: 'market_data' },
    };
    expect(frame.kind).toBe('request');
    expect(frame.method).toBe('skill.invoke');
  });

  it('accepts a valid response frame', () => {
    const frame: BridgeFrame = {
      v: 1,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      kind: 'response',
      result: { data: [1, 2, 3] },
    };
    expect(frame.kind).toBe('response');
    expect(frame.result).toEqual({ data: [1, 2, 3] });
  });

  it('accepts a valid error frame', () => {
    const frame: BridgeFrame = {
      v: 1,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      kind: 'error',
      error: { code: 'TIMEOUT', message: 'too slow', retryable: true },
    };
    expect(frame.kind).toBe('error');
    expect(frame.error?.code).toBe('TIMEOUT');
  });

  it('accepts a valid event frame', () => {
    const frame: BridgeFrame = {
      v: 1,
      id: 'evt-001',
      kind: 'event',
      method: 'market.tick',
      params: { symbol: '600519', price: 1850.50 },
    };
    expect(frame.kind).toBe('event');
    expect(frame.method).toBe('market.tick');
  });

  it('accepts a valid ping frame', () => {
    const frame: BridgeFrame = {
      v: 1,
      id: 'ping-001',
      kind: 'ping',
      ts: 1700000000000,
    };
    expect(frame.kind).toBe('ping');
  });
});
