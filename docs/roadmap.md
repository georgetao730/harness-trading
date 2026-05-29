# harness-trading · Roadmap & Status

> **Last updated**: 2026-05-29 · **Current commit**: [`a8ffc14`](https://github.com/georgetao730/harness-trading/commit/a8ffc14) (`main`)
>
> Live status board for everyone working on the harness-trading agentic-quant scaffold. Read this first if you've just been added to the repo.

---

## TL;DR for new contributors

1. **What is this?** A "skill-shaped" agentic quant assistant — Node thin shell + Python thick core. The pitch is in the [README](../README.md); the architecture decision is "Plan B" in [tech-spec-phase2.md](./tech-spec-phase2.md).
2. **Where are we?** Sprint 0 (decision week) is **closed**. The repo currently holds a working monorepo skeleton — no real CLI logic yet.
3. **What can I pick up?** See [§4 Open work](#4--open-work-pick-from-here) below; tasks are tagged `good-first-task` / `M` / `L`.
4. **Where do I read?** This file → `tech-spec-phase2.md` → the protocol docs (`node-python-bridge.md`, `broker-adapter-protocol.md`) → the ADRs (`adr/phase2-decisions.md`).

---

## 1 · The North Star

We are building **the smallest agentic scaffold a quant trader actually wants to run on their laptop**:

- `npm i -g harness-trading` → `harness-trading onboard` → conversational quant workflows
- Skills (backtest / paper-trade / generate-strategy) are **markdown SKILL.md + a runner** — the same shape as Claude Code skills
- Channels (Feed / Alert / Surface / Broker) are first-class extension points
- A `HarnessToken` capability gate stands between any agent reasoning and a real broker order

Non-goals: enterprise multi-tenant trading platforms, low-latency HFT, replacing TradingView/QuantConnect. We're cosplaying **Claude Code for trading**, not Bloomberg.

Full vision in [tech-spec-phase2.md §1–§3](./tech-spec-phase2.md).

---

## 2 · Architecture in 5 lines

```
Node thin shell                 Python thick core
┌────────────────┐              ┌──────────────────────────────────┐
│ packages/cli   │  ws (JSON)   │ backend/app/gateway              │
│ packages/      │ ◄──────────► │ backend/app/{channels, skills_   │
│   ws-bridge    │   v1/        │   runtime, workflows, agents}    │
│ packages/      │              │ backend/app/security/token.py    │
│   supervisor   │              └──────────────────────────────────┘
│ packages/      │
│   agentic-hooks│
│ packages/web   │
└────────────────┘
```

- Wire protocol: [docs/node-python-bridge.md](./node-python-bridge.md)
- Broker plugin contract: [docs/broker-adapter-protocol.md](./broker-adapter-protocol.md)
- All cross-cutting decisions: [docs/adr/phase2-decisions.md](./adr/phase2-decisions.md)

---

## 3 · Sprint timeline (status snapshot)

| Sprint | Focus | Status | Exit criteria |
|---|---|---|---|
| **S0** | Decision week + monorepo scaffold + CI | ✅ **Done** (commit `a8ffc14`) | 7 ADRs Accepted; pnpm workspace builds; CI matrix runs |
| **S1** | Node CLI + Python Gateway, end-to-end ws handshake | 🟡 **Up next** | `harness-trading onboard` ➜ `gateway start` ➜ `harness-trading version` round-trips through ws |
| **S2** | Skills directory + Channels protocol layer + paper broker | ⏸ Planned | `skill list` shows on-disk skills; paper broker accepts orders gated by HarnessToken |
| **S3** | Workflows YAML runtime + agent adapters (Claude / Codex hooks) | ⏸ Planned | `workflow run validate` runs a 3-stage YAML; Claude Code hook fires UserPromptSubmit |
| **S4** | Web UI migration + eval harness + knowledge garden | ⏸ Planned | `frontend/` lives in `packages/web/`; `pnpm eval` runs replayable cases |
| **S5** | Live broker demo (1 real adapter, paper-protected) | ⏸ Planned | A community broker (e.g. Tiger / Longbridge) wrapper is published as a sibling npm pkg |

Each sprint is **2 weeks**; we're not in a hurry. Quality > speed.

---

## 4 · Open work — pick from here

> **Convention**: pick a task, comment on the GitHub issue (or open one), branch off `main` as `feat/<short>` or `fix/<short>`, open a PR. CI must pass. Squash-merge into `main`.

### S1 · CLI + Gateway end-to-end (current sprint)

| ID | Task | Size | Files | Skills needed |
|---|---|---|---|---|
| S1-01 | Implement `harness-trading onboard` (write `~/.harness-trading/auth.json` + `secret.key` + 0600 perms) | M | [packages/cli/src/](../packages/cli/src/) | Node fs / crypto |
| S1-02 | Implement `harness-trading doctor` (check py3.12, uv, port 8765 free) | S `good-first-task` | packages/cli/src/ | Node child_process |
| S1-03 | Implement `harness-trading gateway start\|stop\|status` (spawn uvicorn, PID file, healthcheck) | M | [packages/supervisor/src/](../packages/supervisor/src/) | Node subprocess management |
| S1-04 | Build ws-bridge client per [node-python-bridge.md](./node-python-bridge.md) §2-§4 (frame envelope, hello handshake, request/response, ping) | L | [packages/ws-bridge/src/](../packages/ws-bridge/src/) | WebSocket / async / typed messages |
| S1-05 | FastAPI Gateway server (mirror image of S1-04 on Python side) | L | `backend/app/gateway/` (new) | FastAPI + websockets |
| S1-06 | `auth.py` constant-time token compare + `~/.harness-trading/auth.json` reader | S | `backend/app/security/` (new) | Python hmac |
| S1-07 | Vitest tests for ws-bridge handshake + error codes | M | packages/ws-bridge/tests/ | Vitest |
| S1-08 | Pytest tests for Gateway dispatcher + auth | M | backend/tests/ | pytest-asyncio |
| S1-09 | First `agentic-hooks` adapter: Claude Code (`UserPromptSubmit`) | M | [packages/agentic-hooks/src/](../packages/agentic-hooks/src/) | Claude Code hooks reference |

### Cross-cutting (anyone, any sprint)

| ID | Task | Size |
|---|---|---|
| X-01 | Local first-run: `pnpm install` then `pnpm build` then `make test`; commit the resulting `pnpm-lock.yaml` so CI uses frozen lockfile | S `good-first-task` |
| X-02 | Add `prettier` action to GitHub PRs that comments biome diffs | S |
| X-03 | Write `CONTRIBUTING.md` (branching, PR template, conventional-commits) | S `good-first-task` |
| X-04 | Trim `backend/pyproject.toml` `dependencies` — move `openai` / `anthropic` / `google-genai` into `[llm]` extras | M |

---

## 5 · How to start locally (zero to first contribution)

```bash
# 1. clone
git clone git@github.com:georgetao730/harness-trading.git
cd harness-trading

# 2. install Node side
pnpm install                          # workspace root + all 6 packages

# 3. install Python side
brew install python@3.12              # ADR-0001: bring your own Python
pipx install uv                       # or: curl -LsSf https://astral.sh/uv/install.sh | sh
make install-py                       # uv sync, creates backend/.venv

# 4. one-shot CI replica
make ci                               # lint + typecheck + build + test (Node + Python)
```

If `make ci` is green on your machine, your branch should be green on GitHub Actions too.

---

## 6 · Decision log (what's locked, what's still open)

### Locked (do not relitigate without an ADR amendment)

- **Plan B over Plan A** — Node thin shell + Python core, not pure Node ([§4 of tech-spec-phase2.md](./tech-spec-phase2.md#4--方案对比与决策))
- **All 7 Sprint-0 questions** — see [adr/phase2-decisions.md](./adr/phase2-decisions.md) for ADR-0001 through ADR-0007
- **biome over eslint+prettier** — one tool, one config, fewer plugin debates
- **`docs/` lives in the OSS repo** — flipped from "internal-only" because we now need to onboard collaborators (this PR)

### Still open (raise an issue / discussion)

- Telemetry: do we ship anonymous usage telemetry by default? (lean: no, opt-in only)
- License: `MIT` is provisional; need an explicit `LICENSE` file at the repo root before public announcement
- Versioning policy: `0.x` semver-loose vs strict? (lean: 0.x = loose, 1.0 onward = strict semver)

---

## 7 · Sources of truth

| Topic | File |
|---|---|
| Vision / pitch | [README.md](../README.md) |
| 2-minute install | [QUICKSTART.md](../QUICKSTART.md) |
| Architecture | [docs/tech-spec-phase2.md](./tech-spec-phase2.md) |
| Wire protocol (Node ↔ Python) | [docs/node-python-bridge.md](./node-python-bridge.md) |
| Broker plugin contract | [docs/broker-adapter-protocol.md](./broker-adapter-protocol.md) |
| Decisions (immutable) | [docs/adr/phase2-decisions.md](./adr/phase2-decisions.md) |
| **This file** — current status | [docs/roadmap.md](./roadmap.md) |

---

## 8 · How this file is maintained

- **At every sprint boundary**: someone updates §3 status column + §4 task list + bumps "Last updated" + "Current commit".
- **At any meaningful merge**: tick off completed tasks in §4; if the merge changes a locked decision, write a follow-up ADR and link from §6.
- **Never** delete history — strike-through `~~done~~` is fine; we want the trail.

If you're picking up a task, also drop a one-line comment in §4 like `(WIP @yourhandle, 2026-06-02)` so others don't double-grab.

---

*Authored during Sprint 0 close-out. Welcome aboard. 🚀*
