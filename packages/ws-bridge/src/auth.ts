// Read auth token from ~/.harness-trading/auth.json.
// See ADR-0005 for the token strategy.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface AuthPayload {
  token: string;
  created_at: number;
}

const AUTH_DIR = process.env.HARNESS_TRADING_HOME ?? join(homedir(), '.harness-trading');
const AUTH_PATH = join(AUTH_DIR, 'auth.json');

let _cachedToken: string | null | undefined;

/** Read the gateway token from auth.json. Returns null if not found. */
export function readToken(): string | null {
  // Return cached token if available (avoids re-reads within same process)
  if (_cachedToken !== undefined) return _cachedToken;

  try {
    const raw = readFileSync(AUTH_PATH, 'utf-8');
    const payload = JSON.parse(raw) as AuthPayload;
    _cachedToken = payload.token || null;
    return _cachedToken;
  } catch {
    _cachedToken = null;
    return null;
  }
}

/** Invalidate the cached token (force re-read on next call). */
export function invalidateTokenCache(): void {
  _cachedToken = undefined;
}

/** Get the auth.json path. */
export function authFilePath(): string {
  return AUTH_PATH;
}
