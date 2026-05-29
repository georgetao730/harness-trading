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

## 2. 30-second start

```bash
git clone <this-repo> harness-trading && cd harness-trading
cp .env.example .env
# edit .env, set at least one LLM key — DeepSeek is the default routing target
echo "DEEPSEEK_API_KEY=sk-your-deepseek-key" >> .env

# Terminal 1: backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 18766

# Terminal 2: frontend
cd frontend
npm install
npm run dev -- --webpack -p 3000
```

✅ **Verify**

```bash
curl http://localhost:18766/api/health
# {"status":"ok","app":"Harness Trading","env":"development"}
```

Open `http://localhost:3000` — you should see the Dashboard with three panels: agent chat (left), market overview (center), safety harness console (right).

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
curl -X POST http://localhost:18766/api/trading/order \
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
curl -X POST http://localhost:18766/api/agent/mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"approval"}'
```

✅ **Verify** — `GET /api/agent/mode` returns the new mode.

---

## 6. Trip and reset the circuit breaker

Demo the kill-switch:

```bash
curl -X POST "http://localhost:18766/api/harness/circuit-breaker/trigger?reason=demo"
# every subsequent order will be rejected up-front
curl -X POST http://localhost:18766/api/harness/circuit-breaker/reset
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

The fun part. Most extension points are first-class today.

| Extension point        | How |
|------------------------|-----|
| **Run a workflow**     | `POST /api/agent/workflows/run` with `{"workflow":"backtest","inputs":{...}}`. 4 workflows ship built-in. See [workflows/](workflows/). |
| **Add your own skill** | Drop a folder under `skills/` with `SKILL.md` + `handler.py` + `schema.json`; restart. |
| **Search knowledge**   | `GET /api/agent/knowledge/search?q=风控` — BM25 full-text search across indexed entries. |
| **Run eval suite**     | `POST /api/agent/workflows/run` with eval workflow, or use the eval harness programmatically. |
| **Tune LLM routing**   | Edit [`config/providers.yaml`](config/providers.yaml). Per-task routing with fallback chain. |
| **Persist state**      | *(planned)* SQLAlchemy + Redis for durable orders / positions / agent memory. |

See the **Roadmap** section of [README.md](README.md#roadmap) for the full plan.

---

## 10. Docker (alternative)

```bash
docker compose up -d                 # backend :18766 + frontend :3000
docker compose logs -f               # optional: tail logs
```

✅ **Verify** — same as §2.

---

## FAQ

**Q: Frontend shows "Backend not available".**
The backend isn't running, or port 18766 is taken. `curl http://localhost:18766/api/health` to confirm.

**Q: Chat replies "AI service unavailable".**
LLM config issue. Check (1) at least one API key in `.env`, (2) the chosen provider has `enabled: true` in `providers.yaml`, (3) network reachability to the provider's endpoint.

**Q: No market data showing.**
Market data comes from Sina Finance + Tencent APIs. If the APIs are unreachable, the system falls back to reasonable default values. Check the backend logs for details.

**Q: Frontend build error (Turbopack panic).**
Chinese characters in the project path cause Turbopack to crash. Use `npm run dev -- --webpack` to force Webpack instead.

**Q: How do I trade real money?**
You can't, today. There is **no live broker adapter** yet — that lands in Phase 3. All execution flows through `paper_trading.py`. Even when live broker support arrives, **never bypass the safety harness** in production.

---

## Disclaimer

For research and educational use only. Not investment advice. Trading involves risk and you can lose money. Do not wire real capital through this system without thoroughly understanding every layer.
