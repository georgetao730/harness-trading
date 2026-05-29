# Quickstart

Get from zero to a running Harness Trading scaffold in under five minutes. Everything below assumes a Unix-like shell (macOS / Linux / WSL2).

> Need the high-level picture first? Read [README.md](README.md) — it explains why Harness Trading is a *scaffold*, not a closed bot.

---

## 1. Prerequisites

| Tool   | Min version | Notes |
|--------|-------------|-------|
| Docker | 24+         | Recommended path. `docker compose` v2 syntax. |
| Python | 3.12+       | Only if you skip Docker and run the backend locally. |
| Node   | 18+         | Only if you skip Docker and run the frontend locally. |
| npm    | 9+          | Ships with Node. |

---

## 2. 30-second start (Docker)

```bash
git clone <this-repo> harness-trading && cd harness-trading
cp .env.example .env
# edit .env, set at least one LLM key — DeepSeek is the default routing target
echo "DEEPSEEK_API_KEY=sk-your-deepseek-key" >> .env
docker compose up -d
docker compose logs -f                # optional: tail logs
```

✅ **Verify**

```bash
curl http://localhost:8000/api/health
# {"status":"ok","app":"Harness Trading","env":"development"}
```

Open `http://localhost:3000` — you should see the Dashboard with three panels: agent chat (left), market overview (center), safety harness console (right).

> Prefer running locally without Docker? See [Local dev](#10-local-dev-without-docker) at the bottom.

---

## 3. Talk to your trading agent

In the left-hand chat panel, send:

```
Analyse 600519 (Kweichow Moutai) and tell me whether momentum is bullish.
```

The agent will route the request through [`config/providers.yaml`](config/providers.yaml) (DeepSeek by default), call the `market_data` and `technical` skills, and reply with a structured analysis.

✅ **Verify** — the response should reference recent price, an MA / MACD / RSI snapshot, and a textual conclusion.

---

## 4. Submit your first paper order

The default mode is `dry_run`, so the order is **logged but not executed**. Time-of-day check is on by default; if you are outside Chinese trading hours, set `time_check.enabled: false` in [`config/harness.yaml`](config/harness.yaml) and restart the backend.

```bash
curl -X POST http://localhost:8000/api/trading/order \
  -H "Content-Type: application/json" \
  -d '{
    "symbol":  "600519",
    "action":  "buy",
    "price":   1800.00,
    "quantity": 100,
    "reason":  "Momentum signal from agent"
  }'
```

✅ **Verify** — response includes a full validation trace:

```json
{
  "status": "dry_run_logged",
  "approval": {
    "approved": true,
    "mode": "dry_run",
    "final_action": "dry_run_log",
    "validation_results": [
      {"check": "price_check",     "status": "pass"},
      {"check": "quantity_check",  "status": "pass"},
      {"check": "order_type_check","status": "pass"},
      {"check": "time_check",      "status": "pass"},
      {"check": "frequency_limit", "status": "pass"}
    ]
  },
  "message": "Dry run: order recorded but not executed"
}
```

---

## 5. Switch execution modes

| Mode       | Behaviour |
|------------|-----------|
| `dry_run`  | Agent decides, harness validates, **nothing is executed** — logs only. |
| `approval` | Orders queue for human approval before paper execution. |
| `auto`     | Within the risk envelope, paper-execute automatically. High-risk orders are auto-promoted to `approval`. |

From the dashboard top bar, click the mode toggle. Or via API:

```bash
curl -X POST http://localhost:8000/api/agent/mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"approval"}'
```

✅ **Verify** — `GET /api/agent/mode` returns the new mode.

---

## 6. Trip and reset the circuit breaker

Demo the kill-switch:

```bash
curl -X POST "http://localhost:8000/api/harness/circuit-breaker/trigger?reason=demo"
# every subsequent order will be rejected up-front
curl -X POST http://localhost:8000/api/harness/circuit-breaker/reset
```

✅ **Verify** — between trigger and reset, any `POST /api/trading/order` returns `circuit_breaker_open`.

---

## 7. Customize your safety harness

Edit [`config/harness.yaml`](config/harness.yaml) and restart the backend.

```yaml
validator_chain:
  price_check:
    enabled: true
    max_deviation_pct: 5.0          # widen price tolerance
  frequency_limit:
    max_orders_per_window: 10
    window_minutes: 30

risk_controller:
  daily_loss_limit_pct: 8.0
  single_order_amount_limit: 200000
```

✅ **Verify** — `GET /api/harness/config` reflects the new values; submitting an order with 4% price deviation now passes (was previously rejected at 3%).

---

## 8. Switch your LLM model

Per-task routing lives in [`config/providers.yaml`](config/providers.yaml). Three common patterns:

**All on OpenAI GPT-4o:**

```yaml
routing:
  trading_decision: vision
  market_analysis:  vision
  news_summary:     vision
  chat:             vision
```

**Local Ollama for sensitive workloads:**

```bash
ollama pull qwen2.5:32b
```

```yaml
providers:
  local:
    enabled: true
routing:
  trading_decision: local
  chat:             local
```

**DeepSeek-only (no other keys needed):**

```yaml
providers:
  primary:   { enabled: false }
  vision:    { enabled: false }
  long_ctx:  { enabled: false }
  secondary: { enabled: true  }    # DeepSeek
routing:
  trading_decision: secondary
  market_analysis:  secondary
  news_summary:     secondary
  chat:             secondary
```

Restart the backend after edits; `GET /api/agent/skills` confirms providers are healthy.

---

## 9. What's next: extend the scaffold

The fun part. Two extension points are first-class today; two more land in Phase 2.

| Extension point        | Today                                                                 | Phase 2 |
|------------------------|-----------------------------------------------------------------------|---------|
| **Add your own skill** | Subclass [`BaseSkill`](backend/app/agent/skills/base.py); drop a `.py` under [`backend/app/agent/skills/`](backend/app/agent/skills/); restart. | `make skill new NAME=...` scaffolds `SKILL.md` + handler + schema; auto-injection into agent prompt. |
| **Tune LLM routing**   | Edit [`config/providers.yaml`](config/providers.yaml).                | Per-skill routing overrides; cost / latency-aware fallback. |
| **Define a workflow**  | *(Phase 2)*                                                           | YAML-driven `strategy → backtest → paper → live` pipelines under `workflows/`. |
| **Persist state**      | *(Phase 2)*                                                           | SQLAlchemy + Redis; durable orders / positions / agent memory. |

See the **Roadmap** section of [README.md](README.md#roadmap) for the full plan and links to the upcoming Phase 2 Tech Spec.

---

## 10. Local dev without Docker

```bash
# backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# frontend (in another shell)
cd frontend
npm install
npm run dev
```

✅ **Verify** — same as §2.

---

## FAQ

**Q: Frontend shows "Backend not available".**
The backend isn't running, or port 8000 is taken. `curl http://localhost:8000/api/health` to confirm; check `docker compose logs backend` if using Docker.

**Q: Chat replies "AI service unavailable".**
LLM config issue. Check (1) at least one API key in `.env`, (2) the chosen provider has `enabled: true` in `providers.yaml`, (3) network reachability to the provider's endpoint.

**Q: No market data showing.**
Index list falls back to mock data on Eastmoney outage; per-symbol quotes / K-lines return empty on outage. If even mocks are missing, check the browser console and backend logs.

**Q: Eastmoney times out on macOS.**
The market service uses a `curl` subprocess to bypass macOS proxy quirks, so this should be rare. If it persists, the system auto-degrades to mock data — no action needed for development.

**Q: How do I trade real money?**
You can't, today. There is **no live broker adapter** yet — that lands in Phase 3. All execution flows through `paper_trading.py`. Even when live broker support arrives, **never bypass the safety harness** in production.

---

## Disclaimer

For research and educational use only. Not investment advice. Trading involves risk and you can lose money. Do not wire real capital through this system without thoroughly understanding every layer.
