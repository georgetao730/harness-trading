// Supervisor — spawns and manages the Python Gateway process.
//
// Responsibilities:
//   - `gateway start`  → spawn `uv run uvicorn app.main:app --host 127.0.0.1 --port <port>`
//   - `gateway stop`   → kill the PID
//   - `gateway status` → check if process is alive + ws health

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SUPERVISOR_VERSION = '0.1.0';

const HARNESS_HOME = process.env.HARNESS_TRADING_HOME ?? join(homedir(), '.harness-trading');
const PID_DIR = join(HARNESS_HOME, 'pids');
const PID_FILE = join(PID_DIR, 'gateway.pid');

const DEFAULT_PORT = 8765;
const DEFAULT_HOST = '127.0.0.1';

// ── helpers ──

function ensurePidDir(): void {
  const { mkdirSync } = require('node:fs');
  mkdirSync(PID_DIR, { recursive: true, mode: 0o700 });
}

function readPid(): number | null {
  try {
    const raw = readFileSync(PID_FILE, 'utf-8').trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function writePid(pid: number): void {
  ensurePidDir();
  writeFileSync(PID_FILE, String(pid), 'utf-8');
}

function deletePid(): void {
  try {
    unlinkSync(PID_FILE);
  } catch {
    /* ok */
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = existence check
    return true;
  } catch {
    return false;
  }
}

function findUvPath(): string {
  // try common locations
  const candidates = [
    join(homedir(), '.local', 'bin', 'uv'),
    join(homedir(), '.cargo', 'bin', 'uv'),
    '/usr/local/bin/uv',
    '/opt/homebrew/bin/uv',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'uv'; // fallback: hope it's on PATH
}

// ── gateway commands ──

export interface GatewayStartOptions {
  port?: number;
  host?: string;
  backendDir?: string;
}

export async function gatewayStart(
  opts: GatewayStartOptions = {},
): Promise<{ pid: number; port: number }> {
  const port = opts.port ?? DEFAULT_PORT;
  const host = opts.host ?? DEFAULT_HOST;
  const backendDir = opts.backendDir ?? join(process.cwd(), 'backend');

  // Check if already running
  const existingPid = readPid();
  if (existingPid && isProcessAlive(existingPid)) {
    throw new Error(`Gateway already running (pid ${existingPid})`);
  }

  const uvPath = findUvPath();
  const args = [
    'run',
    'uvicorn',
    'app.main:app',
    '--host',
    host,
    '--port',
    String(port),
    '--reload',
  ];

  const child = spawn(uvPath, args, {
    cwd: backendDir,
    stdio: 'pipe',
    detached: false,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk));

  child.on('exit', (code) => {
    deletePid();
    if (code !== 0 && code !== null) {
      console.error(`Gateway exited with code ${code}`);
    }
  });

  if (!child.pid) {
    throw new Error('Failed to start gateway (no PID)');
  }

  writePid(child.pid);

  // Wait briefly for startup
  await new Promise((resolve) => setTimeout(resolve, 2000));
  if (!isProcessAlive(child.pid)) {
    deletePid();
    throw new Error('Gateway failed to start (process died)');
  }

  return { pid: child.pid, port };
}

export function gatewayStop(): { stopped: boolean; wasRunning: boolean } {
  const pid = readPid();
  if (!pid) return { stopped: true, wasRunning: false };
  if (!isProcessAlive(pid)) {
    deletePid();
    return { stopped: true, wasRunning: false };
  }

  try {
    process.kill(pid, 'SIGTERM');
    deletePid();
    return { stopped: true, wasRunning: true };
  } catch {
    return { stopped: false, wasRunning: true };
  }
}

export interface GatewayStatusResult {
  running: boolean;
  pid: number | null;
  port: number;
  host: string;
}

export function gatewayStatus(): GatewayStatusResult {
  const pid = readPid();
  const alive = pid !== null && isProcessAlive(pid);
  if (!alive && pid !== null) deletePid();

  return {
    running: alive,
    pid: alive ? pid! : null,
    port: DEFAULT_PORT,
    host: DEFAULT_HOST,
  };
}
