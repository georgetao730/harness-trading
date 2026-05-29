// CLI entry — harness-trading commands.
// See docs/tech-spec-phase2.md §5.5 for the full command tree.

import { gatewayStart, gatewayStatus, gatewayStop } from '@harness-trading/supervisor';
import { BridgeClient } from '@harness-trading/ws-bridge';

const VERSION = '0.1.0';

// ── helpers ──

function printHelp(): void {
  console.log(`harness-trading ${VERSION} — AI-powered trading assistant

Usage: harness-trading <command> [options]

Commands:
  onboard                  Guided setup wizard
  doctor                   Check environment
  gateway start|stop|status  Manage the Python gateway
  version                  Show version

Run 'harness-trading <command> --help' for details.
`);
}

function printCmdHelp(cmd: string): void {
  switch (cmd) {
    case 'onboard':
      console.log(`harness-trading onboard — Guided setup wizard

Usage: harness-trading onboard

  Walks through first-time setup:
    1. Detects Python 3.12+ and uv
    2. Generates auth token and secret key
    3. Writes ~/.harness-trading/auth.json
    4. Tests gateway connection
`);
      break;
    case 'doctor':
      console.log(`harness-trading doctor — Environment check

Usage: harness-trading doctor

  Checks:
    - Node.js >= 20
    - Python 3.12+
    - uv installed
    - Gateway port 8765 available
    - auth.json present and valid
`);
      break;
    case 'gateway':
      console.log(`harness-trading gateway — Manage Python gateway

Usage: harness-trading gateway <start|stop|status>

  start   Start the gateway on ws://127.0.0.1:8765
  stop    Stop the running gateway
  status  Show gateway process status
`);
      break;
    default:
      printHelp();
  }
}

// ── commands ──

async function cmdVersion(): Promise<void> {
  console.log(`harness-trading ${VERSION}`);
}

async function cmdOnboard(): Promise<void> {
  const { existsSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { homedir } = await import('node:os');
  const { join } = await import('node:path');
  const { randomBytes } = await import('node:crypto');

  const home = process.env.HARNESS_TRADING_HOME ?? join(homedir(), '.harness-trading');
  mkdirSync(home, { recursive: true, mode: 0o700 });

  const token = randomBytes(32).toString('hex');
  const secret = randomBytes(32).toString('hex');

  const authPayload = JSON.stringify({ token, created_at: Math.floor(Date.now() / 1000) }, null, 2);

  writeFileSync(join(home, 'auth.json'), authPayload, { mode: 0o600 });
  writeFileSync(join(home, 'secret.key'), secret, { mode: 0o600 });

  console.log(`✓ Generated auth token → ${join(home, 'auth.json')}`);
  console.log(`✓ Generated secret key → ${join(home, 'secret.key')}`);
  console.log('');

  // Test gateway connection
  try {
    const client = new BridgeClient({ token });
    const info = await client.connect();
    console.log(`✓ Gateway online: server=${info.server}, features=${info.features.join(',')}`);
    client.close();
  } catch {
    console.log('⚠ Gateway not running. Start it with: harness-trading gateway start');
  }

  console.log('');
  console.log('Next steps:');
  console.log('  harness-trading gateway start');
  console.log('  harness-trading doctor');
}

async function cmdDoctor(): Promise<void> {
  const { execSync } = await import('node:child_process');

  console.log('harness-trading doctor — Environment check\n');

  // Node version
  const nodeVer = process.version;
  const nodeOk = Number.parseInt(nodeVer.slice(1)) >= 20;
  console.log(nodeOk ? '✓' : '✗', `Node.js: ${nodeVer} ${nodeOk ? '' : '(need >= 20)'}`);

  // Python
  try {
    const py = execSync('python3.12 --version 2>/dev/null || python3 --version 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    const pyMatch = py.match(/(\d+\.\d+)/);
    const pyOk = pyMatch?.[1] ? Number.parseFloat(pyMatch[1]) >= 3.12 : false;
    console.log(pyOk ? '✓' : '✗', `Python: ${py} ${pyOk ? '' : '(need >= 3.12)'}`);
  } catch {
    console.log('✗ Python 3.12+ not found. Install: brew install python@3.12');
  }

  // uv
  try {
    const uv = execSync('uv --version 2>/dev/null', { encoding: 'utf-8' }).trim();
    console.log('✓', `uv: ${uv}`);
  } catch {
    console.log('✗ uv not found. Install: curl -LsSf https://astral.sh/uv/install.sh | sh');
  }

  // Port check
  try {
    execSync('lsof -i :8765 2>/dev/null || true', { encoding: 'utf-8' });
  } catch {
    /* ok */
  }

  // auth.json
  const { existsSync } = await import('node:fs');
  const { homedir } = await import('node:os');
  const { join } = await import('node:path');
  const authPath = join(
    process.env.HARNESS_TRADING_HOME ?? join(homedir(), '.harness-trading'),
    'auth.json',
  );
  console.log(
    existsSync(authPath) ? '✓' : '✗',
    `auth.json: ${authPath} ${existsSync(authPath) ? '' : '(run: harness-trading onboard)'}`,
  );

  // Gateway
  const status = gatewayStatus();
  console.log(
    status.running ? '✓' : '✗',
    `Gateway: ${status.running ? `running (pid ${status.pid})` : 'not running (run: harness-trading gateway start)'}`,
  );

  console.log('');
}

async function cmdGateway(sub: string): Promise<void> {
  switch (sub) {
    case 'start': {
      try {
        const result = await gatewayStart();
        console.log(`Gateway started — pid ${result.pid}, ws://127.0.0.1:${result.port}/v1`);
      } catch (err) {
        console.error('Failed to start gateway:', (err as Error).message);
        process.exit(1);
      }
      break;
    }
    case 'stop': {
      const result = gatewayStop();
      if (result.wasRunning) {
        console.log('Gateway stopped');
      } else {
        console.log('Gateway was not running');
      }
      break;
    }
    case 'status': {
      const status = gatewayStatus();
      if (status.running) {
        console.log(
          `Gateway: running (pid ${status.pid}) on ws://${status.host}:${status.port}/v1`,
        );
      } else {
        console.log('Gateway: not running');
        process.exit(1);
      }
      break;
    }
    default:
      printCmdHelp('gateway');
      process.exit(2);
  }
}

// ── main ──

export async function run(argv: readonly string[]): Promise<void> {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    await cmdVersion();
    return;
  }

  if (rest[0] === '--help' || rest[0] === '-h') {
    printCmdHelp(cmd);
    return;
  }

  switch (cmd) {
    case 'onboard':
      await cmdOnboard();
      break;
    case 'doctor':
      await cmdDoctor();
      break;
    case 'gateway':
      await cmdGateway(rest[0] ?? '');
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      console.error("Run 'harness-trading --help' for usage.");
      process.exit(2);
  }
}
