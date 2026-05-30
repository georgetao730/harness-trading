# harness-trading · Roadmap & Status

> **Last updated**: 2026-05-29 · **Current branch**: `main`
>
> Live status board for the harness-trading agentic-quant platform.

---

## TL;DR

1. **What is this?** An AI-powered agentic trading assistant — Next.js frontend + FastAPI backend, skill-shaped workflows, eval harness, BM25 knowledge garden.
2. **Where are we?** Phase 2 complete. Frontend (10+ pages) and backend fully functional. Channels management, Skills visualization, Agent roles, Dashboard KPIs, Knowledge RAG — all live. Community-ready.
3. **Phase 1 (MVP)**: ✅ 10/10 complete — backend + market data + safety harness.
4. **Phase 2 (补齐)**: ✅ 7/7 complete — tests, persistence, knowledge frontend, settings, workflow aliases, CI/CD, docker.
5. **Phase 3 (联调与生产)**: 🟡 In progress — Node packages, broker adapters, channels, production quality.

---

## 1 · Architecture Overview

```
Frontend (Next.js)                Backend (FastAPI, port 18766)
┌──────────────────────┐          ┌──────────────────────────────────────┐
│ src/components/      │  HTTP    │ app/api/       REST endpoints        │
│  agent/              │ ◄──────► │ app/gateway/   WS bridge (Node↔Py)   │
│  charts/             │          │ app/agent/     Skills + Roles        │
│  dashboard/          │          │ app/workflows/ YAML-driven engine     │
│  harness/            │          │ app/eval/      L1/L2/L3 assertions   │
│  knowledge/          │          │ app/knowledge/ BM25 full-text search │
│  portfolio/          │          │ app/harness/   Validator + CB        │
│  settings/           │          │ app/llm/       Multi-provider router │
│  workflow/           │          │ app/db/        SQLAlchemy + aiosqlite│
│                       │          │ app/channels/  Feed/Alert/Broker     │
└──────────────────────┘          └──────────────────────────────────────┘
```

- Wire protocol: [docs/node-python-bridge.md](./node-python-bridge.md)
- Broker plugin contract: [docs/broker-adapter-protocol.md](./broker-adapter-protocol.md)

---

## 2 · Sprint Timeline

| Sprint | Focus | Status | Exit Criteria |
|---|---|---|---|
| **S0** | Decision week + monorepo scaffold | ✅ Done | 7 ADRs Accepted; pnpm workspace builds |
| **S1-S3** | Backend core: Gateway, Skills, Workflows, Agents, LLM routing | ✅ Done | 4 workflows, 5 agent roles, real market data via Sina/Tencent |
| **S4** | Eval Harness + Knowledge Garden + Web Dashboard | ✅ Done | BM25 search, 10 frontend pages all API-connected |
| **Phase 2 补齐** | Tests, Persistence, Knowledge/Settings Frontend, CI/CD, Docker | ✅ Done | 51 pytest cases, SQLAlchemy 5 tables, GitHub Actions, Docker compose |
| **S5** | Frontend Polish + Community Ready | ✅ Done | Channels CRUD, Skills viz & create, Agent roles, Dashboard KPIs, Watchlist, Journal, Theme toggle |
| **S6** | Node package integration + real broker adapter | 🟡 In progress | CLI ↔ Gateway round-trip; 1 real broker demo |
| **S7** | Channels live + production quality | ⏸ Planned | Real-time market feeds, auth, rate limiting, logging |

---

## 3 · Phase 3: Remaining Work

### P3-01: Node Package Integration (🔴 L)

Make `packages/cli` + `packages/ws-bridge` + `packages/supervisor` production-ready:

| ID | Task | Size | Status |
|---|---|---|---|
| N-01 | ws-bridge client ↔ Python Gateway handshake validated | M | 🟡 Skeleton exists |
| N-02 | `harness-trading gateway start` spawns uvicorn | M | 🟡 Skeleton exists |
| N-03 | `harness-trading doctor` checks env | S | ❌ Not started |
| N-04 | End-to-end: CLI → ws-bridge → Gateway → Skill → response | L | ❌ Not started |

### P3-02: Real Broker Adapter (🔴 L)

| ID | Task | Size | Status |
|---|---|---|---|
| B-01 | Implement broker adapter protocol per spec | L | ❌ Not started |
| B-02 | Paper broker: log trades to DB, update portfolio | M | 🟡 Basic skeleton exists |
| B-03 | 1 real broker demo (Longbridge or Tiger) | L | ❌ Not started |

### P3-03: Channels Live (🟡 M)

| ID | Task | Size | Status |
|---|---|---|---|
| C-01 | Market data feed channel (WebSocket push) | M | 🟡 Architecture exists, no real push |
| C-02 | Alert channel web UI config + test send (飞书/钉钉/企微) | M | ✅ Done |
| C-03 | Channel status monitoring in frontend | S | ✅ Done |

### P3-04: Agent Chat Streaming (🟡 M)

| ID | Task | Size | Status |
|---|---|---|---|
| A-01 | Replace simulated thinking steps with real skill execution logs | M | 🟡 Still simulated |
| A-02 | Server-Sent Events (SSE) for token streaming | S | 🟡 WebSocket exists but uses sleep(0.8) |

### P3-05: Content & Quality (🟢 S)

| ID | Task | Size | Status |
|---|---|---|---|
| Q-01 | Expand knowledge docs (3 → 10+) | S | ✅ 9 docs |
| Q-02 | Expand eval suites (1 → 4+) | S | 🟡 1 suite |
| Q-03 | Safety center logs: replace hardcoded with real events | S | 🟡 Hardcoded |
| Q-04 | Add LICENSE file | S | ✅ Done |
| Q-05 | Update roadmap (this file) | S | ✅ Done |

### P3-06: Production Readiness (🟢 M)

| ID | Task | Size | Status |
|---|---|---|---|
| P-01 | API authentication / rate limiting | M | ❌ |
| P-02 | Structured logging to file | S | ❌ |
| P-03 | SQLite backup/restore tooling | S | ❌ |
| P-04 | Environment-specific config profiles | S | ❌ |

---

## 4 · File Map

| Topic | File |
|---|---|
| Vision / pitch | [README.md](../README.md) |
| 2-minute install | [QUICKSTART.md](../QUICKSTART.md) |
| Architecture spec | [docs/broker-adapter-protocol.md](./broker-adapter-protocol.md) |
| Wire protocol | [docs/node-python-bridge.md](./node-python-bridge.md) |
| Broker protocol | [docs/broker-adapter-protocol.md](./broker-adapter-protocol.md) |
| ADRs | [docs/adr/phase2-decisions.md](./adr/phase2-decisions.md) |
| License | [LICENSE](../LICENSE) |
| **This file** | [docs/roadmap.md](./roadmap.md) |

---

## 5 · How to Start

```bash
# Backend (Python)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 18766 --reload

# Frontend (Next.js)
cd frontend
npm install
npx next dev --webpack -p 3000

# Tests
cd backend && python -m pytest tests/ -v    # 51 tests
cd frontend && npx tsc --noEmit             # typecheck
```

---

*Last updated: 2026-05-29 · S5 complete, S6 in progress.*
