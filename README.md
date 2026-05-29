# Harness Trading
<p align="center">
  <strong>A self-hostable AI quant assistant.</strong><br/>
  <em>Runs on your machine. Talks to your feeds and brokers through pluggable channels. Wraps every order in a Safety Harness.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/python-3.12%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12+">
  <img src="https://img.shields.io/badge/node-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 18+">
  <img src="https://img.shields.io/badge/docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker ready">
  <img src="https://img.shields.io/badge/status-experimental-orange?style=for-the-badge" alt="Status: experimental">
</p>

**Harness Trading** is *not* another closed-box AI trading bot. It is the **quant version of [openclaw](https://github.com/openclaw/openclaw)** — a personal AI assistant you install on your own machine, with the methodology backbone of [harness-env](https://github.com/) (Hooks · Skills · Workflows · Agents · Knowledge · Evals) applied to trading.

You bring keys; it brings primitives. **Channels** (feeds · alerts · surfaces · brokers) are first-class plug-ins. **Skills**, **Workflows** and **Agents** define how the assistant thinks and acts. A non-bypassable **Safety Harness** sits in front of every broker. Everything local-first — your data and decisions never leave your machine unless a channel you authorise asks them to.

> Trading involves risk. Harness Trading ships in **paper-trading-only** mode by default. Live broker adapters are on the roadmap and intentionally absent today.

---

## Why Harness Trading

|                              | Plain quant bot         | Closed AI trader        | **Harness Trading**            |
|------------------------------|-------------------------|-------------------------|--------------------------------|
| Install in 60s               | varies                  | SaaS only               | **`npm i -g harness-trading` *(Phase 2)*** |
| Local-first gateway          | rare                    | cloud-only              | **`ws://127.0.0.1` on your machine** |
| Customizable workflows       | hard-coded              | hidden                  | **YAML / Python, all yours**   |
| Pluggable channels           | n/a                     | n/a                     | **feeds · alerts · surfaces · brokers** |
| Pluggable skills             | rare                    | proprietary             | **drop-in modules**            |
| Multi-LLM routing            | single vendor           | single vendor           | **per-task router**            |
| Safety harness               | manual checks           | opaque                  | **non-bypassable validator chain**|
| Paper-first execution        | optional                | rarely first-class      | **default, hard-gated**        |

---

## Highlights

- **Install in 60 seconds** *(Phase 2)* — `npm i -g harness-trading && harness-trading onboard`. A Node shell sets up Python core, Local-first Gateway, daemon, dashboard, and channel credentials in one wizard.
- **Channels are first-class** — Feeds (Eastmoney / Tushare / Binance) · Alerts (DingTalk / Telegram / Email) · Surfaces (CLI / Web / iOS / Voice) · Brokers (Paper today; live as opt-in plugins, always behind the harness).
- **Pluggable Skills** — folder-shaped modules with `SKILL.md` (frontmatter: `when_to_use` / `when_to_skip` / `risk_class`) + `handler.py` + `schema.json`. Two ship today; directory-style protocol lands in Phase 2.
- **Composable Workflows** *(Phase 2)* — declarative pipelines for `strategy → backtest → paper → live`, with explicit user-confirm gates between stages.
- **Multi-LLM Router** — Anthropic / OpenAI / DeepSeek / Moonshot / Qwen / GLM / Google / local Ollama, with per-task routing in [`config/providers.yaml`](config/providers.yaml). Reasoning channel for hard decisions.
- **Safety Harness (non-bypassable)** — declarative validator chain + risk controller + circuit breaker + token-gated broker submit, configured in [`config/harness.yaml`](config/harness.yaml).
- **Three Execution Modes** — `dry_run` (log-only), `approval` (human-in-the-loop), `auto` (within risk envelope).
- **Cross-IDE hooks** *(Phase 2, separate npm package [`agentic-hooks`](docs/tech-spec-phase2.md#8-agentic-hooks-通用包独立-npm-发布))* — the same 6-event hook stack works in Claude Code / Codex / Cursor / Qoder; reusable by any Agentic project.

---

## Quick start

> **Phase 2 (planned)**: `npm i -g harness-trading && harness-trading onboard` — Node shell auto-provisions Python 3.12 + uv + backend, then wires LLM key / feeds / alerts / paper broker. See [docs/tech-spec-phase2.md](docs/tech-spec-phase2.md).
>
> **Phase 1 (today, what's actually shipped)**: Docker Compose.

Runtime: **Docker 24+** (recommended) or **Python 3.12+** & **Node 18+** for local dev.

```bash
git clone <this-repo> harness-trading && cd harness-trading
cp .env.example .env                 # then put DEEPSEEK_API_KEY=sk-... in .env
docker compose up -d                 # backend :8000 + frontend :3000
open http://localhost:3000
```

Full guide: [QUICKSTART.md](QUICKSTART.md).

---

## How it works

```
   User · CLI · Web Dashboard · iOS Node · Voice Wake
                       │
                       ▼
   ┌───────────────────────────────────────┐
   │ Node Shell  (Phase 2)                 │
   │   onboard · supervisor · ws-bridge    │
   │   agentic-hooks · Next.js host        │
   └───────────────────┬───────────────────┘
                       │ ws://127.0.0.1 (local-first)
                       ▼
   ┌───────────────────────────────────────┐
   │ Python Core  (today + Phase 2)        │
   │   Agent · Skills · Workflows*         │
   │   Knowledge* · Multi-LLM Router       │
   └───────────────────┬───────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
      Feeds         Alerts         Brokers
   (Eastmoney    (DingTalk      (Paper · Live*)
    Tushare …)    Telegram …)
                       │
                       ▼
        ┌─────────────────────────────┐
        │  Safety Harness  (always)   │  ← config/harness.yaml
        │  price · qty · type · time  │
        │  freq · risk · breaker      │
        └─────────────────────────────┘
```

`*` Workflows / Knowledge / Live brokers land in Phase 2; Node Shell is the openclaw-shaped delivery layer that turns the whole stack into a one-line install.

---

## Architecture

| Layer       | Stack |
|-------------|-------|
| **Node Shell** *(Phase 2)* | npm pkg `harness-trading` · CLI · supervisor · ws-bridge · `agentic-hooks` · Next.js host |
| Backend     | FastAPI · Python 3.12 · asyncio · Loguru · Pydantic Settings + YAML |
| LLM         | OpenAI SDK · Anthropic SDK · Google GenAI · DeepSeek / Moonshot / Qwen / GLM (OpenAI-compatible) · Ollama |
| Market      | Eastmoney HTTP API (A-shares) via `curl` subprocess; 30s in-memory cache; mock fallback |
| Frontend    | Next.js 16 · React 19 · Tailwind CSS 4 · Recharts · Lucide · TypeScript |
| Persistence | SQLAlchemy + SQLite (default) / Postgres (production) — *Phase 2* |
| Deploy      | npm global *(Phase 2)* · Docker Compose *(today)* |

> Persistence (SQLAlchemy / Postgres) and task queues are intentionally **process-local** today; both land in Phase 2.

---

## Extension points

Four first-class extension surfaces — three that ship Phase 2's directory-style protocol, one (Channels) that's already partially live.

### Built-in skills today

| Skill | File | Purpose |
|-------|------|---------|
| `market_data` | [`backend/app/agent/skills/market_data.py`](backend/app/agent/skills/market_data.py) | Real-time quotes, indices, K-line |
| `technical`   | [`backend/app/agent/skills/technical.py`](backend/app/agent/skills/technical.py)     | MA / MACD / RSI / Bollinger indicators |

Each skill subclasses [`BaseSkill`](backend/app/agent/skills/base.py) and is auto-registered into the agent's tool list at startup.

### Phase 2: directory-style skill / workflow / agent / channel protocol

```
skills/<your_skill>/
├── SKILL.md          # frontmatter: when_to_use / when_to_skip / risk_class
├── handler.py        # @skill-decorated async run()
└── schema.json       # input/output JSON schema

workflows/<your_workflow>.md           # stages + user-confirm gates
agents/<your_agent>.md                 # role + allowed_skills + llm_routing
backend/app/channels/<type>/<name>/    # feed / alert / broker plugin
```

Channels (feeds · alerts · surfaces · brokers) are first-class — onboard wizard wires them up; the Safety Harness sits between the agent and any broker channel.

Detailed protocol: [docs/tech-spec-phase2.md](docs/tech-spec-phase2.md).

---

## Multi-LLM Routing

Per-task routing lives in [`config/providers.yaml`](config/providers.yaml). Switch the model behind `trading_decision` / `market_analysis` / `news_summary` / `chat` independently. Disable any provider by setting `enabled: false`. Local Ollama is a first-class citizen.

```yaml
routing:
  trading_decision: secondary    # DeepSeek by default
  market_analysis:  vision       # OpenAI GPT-4o for charts
  news_summary:     local        # Ollama for sensitive corpora
  chat:             primary      # Claude for the dashboard chat
```

---

## Safety Harness

All orders flow through a declarative validator chain before execution. Configured in [`config/harness.yaml`](config/harness.yaml).

| Check                | Default behaviour |
|----------------------|-------------------|
| Price deviation      | reject if > 3% from mark |
| Quantity sanity      | reject oversized lots |
| Order type           | limit-only; market orders blocked |
| Trading hours        | block outside session |
| Frequency limit      | 5 orders / 30 min |
| Risk controller      | daily loss cap · concentration · per-order cap · max leverage |
| Circuit breaker      | trips on threshold breach; manual reset required |

The harness runs in every mode — `dry_run` still records the full validation trace, so you can audit why an order *would* have passed or failed.

---

## API at a glance

### Agent — `/api/agent`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/chat` | Send a message to the agent |
| GET  | `/mode` | Read current execution mode |
| POST | `/mode` | Switch mode (`dry_run` / `approval` / `auto`) |
| GET  | `/skills` | List registered skills |
| WS   | `/ws` | Streaming channel (backend ready, frontend Phase 2) |

### Trading — `/api/trading`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/order` | Submit an order through the harness |
| GET  | `/portfolio` | Paper portfolio snapshot |
| GET  | `/orders` | Order history |
| GET  | `/market/indices` | Major index quotes |
| GET  | `/market/quote` | Single-symbol quote |
| GET  | `/market/kline` | K-line data |

### Harness — `/api/harness`

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/status` | Harness health + counters |
| GET  | `/config` | Live harness config |
| POST | `/mode` | Switch execution mode |
| POST | `/circuit-breaker/trigger` | Manually trip the breaker |
| POST | `/circuit-breaker/reset`   | Reset after a trip |

Interactive docs: `http://localhost:8000/docs`.

---

## Roadmap

**Phase 1 — *current*** · pluggable skills · safety harness · paper trading · multi-LLM routing · web dashboard

**Phase 2 — assistant** · `npm i -g harness-trading` global package · onboard wizard · local-first Gateway · `agentic-hooks` standalone npm package · directory-style skills with `SKILL.md` · 4 workflows (`strategy-spec / backtest / paper-trade / live-trade`) · 5 agent roles · channels first-class (feeds · alerts · surfaces · brokers) · persistence (SQLAlchemy + SQLite/Postgres) · L1/L2/L3 eval harness · knowledge layer · macOS menu-bar app *(optional)*

**Phase 3 — production** · live broker adapters · multi-strategy orchestration · portfolio-level risk · observability (metrics + traces) · multi-user / RBAC · audit ledger

Tech Spec for Phase 2: [docs/tech-spec-phase2.md](docs/tech-spec-phase2.md).

---

## Project structure

Today (Phase 1):

```
harness-trading/
├── backend/                       # FastAPI + agent runtime
│   └── app/
│       ├── agent/skills/          # pluggable skills (extension point)
│       ├── api/                   # /api/agent · /api/trading · /api/harness
│       ├── core/                  # config + event bus
│       ├── execution/             # paper_trading.py
│       ├── harness/               # validator chain · risk · circuit breaker
│       ├── llm/                   # multi-provider router
│       └── services/              # market_data
├── frontend/                      # Next.js 16 dashboard
├── config/
│   ├── harness.yaml               # safety rules
│   └── providers.yaml             # LLM routing
├── docker-compose.yml
└── .env.example
```

Phase 2 introduces a Node shell (`packages/{cli,supervisor,ws-bridge,agentic-hooks,web}/`) alongside the Python core, plus root-level `skills/ workflows/ agents/ knowledge/ hooks/` directories — see [docs/tech-spec-phase2.md §4](docs/tech-spec-phase2.md#4-目录布局phase-2-落地形态).

---

## Disclaimer

This project is for **research and educational use only**. It does not constitute investment advice. Trading involves risk; you can lose money. Do **not** wire real capital through this system without thoroughly understanding every layer, and never bypass the safety harness in production. The maintainers accept no liability for losses incurred by use of this software.

## License

MIT — see [LICENSE](LICENSE).
