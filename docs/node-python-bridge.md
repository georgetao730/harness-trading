# Node ↔ Python Bridge Protocol (v0.1)

> Status: **Draft** · Owner: harness-trading core · Depends on: [tech-spec-phase2.md](./tech-spec-phase2.md), [ADR-0005](./adr/phase2-decisions.md#adr-0005--auth-token-策略)

Node 薄壳（packages/ws-bridge）与 Python 厚核（backend/app/gateway）之间的通信契约。**唯一传输通道**：本地 WebSocket（loopback `127.0.0.1`，禁止暴露公网）。所有 stdout 调试日志走另外的 sidechannel，本协议只跑结构化业务帧。

---

## 1 · 总览

```
┌──────────────┐                ┌────────────────────┐
│ Node side    │  ws://127.0.0.1:<port>/v1            │ Python side
│ (CLI / Web / │ ───────────►  │ (FastAPI + websockets │
│  Hook / IDE) │                │  + asyncio dispatcher)│
└──────────────┘                └────────────────────┘
        ▲                                 │
        └──── events / responses ◄────────┘
```

- **协议版本**：URL path 后缀显式版本号 `/v1`；breaking change 升 `/v2` 双跑
- **编码**：JSON UTF-8 文本帧；不使用 binary frame
- **大小限制**：单帧 ≤ 1 MiB；超过的负载（如回测明细）走 HTTP `GET /v1/artifact/<id>` 拉取
- **并发**：单连接全双工，Python 侧每连接独立 asyncio 任务组

---

## 2 · 帧结构（统一信封）

```jsonc
{
  "v": 1,                    // protocol version, == 1 for /v1
  "id": "01HXY...",          // ULID, 客户端为每条 request 生成；event 由服务端生成
  "kind": "request",         // request | response | event | error | ping | pong
  "ts": 1716998400123,       // unix ms, 客户端本地时钟
  "method": "skill.invoke",  // request 必填；event 必填（事件名）
  "params": { ... },         // request / event 负载
  "result": { ... },         // response 负载（仅 kind=response）
  "error": { ... },          // 错误负载（仅 kind=error），见 §6
  "auth": "<token>",         // 仅握手帧；后续帧不再重复
  "corr": "01HXY..."         // response / error / 部分 event 必填，关联到原 request id
}
```

### 2.1 字段约束

| 字段 | 类型 | 必填场景 |
|---|---|---|
| `v` | int | always |
| `id` | string (ULID) | always |
| `kind` | enum | always |
| `ts` | int | always |
| `method` | string | request, event |
| `params` | object | request, event |
| `result` | object | response |
| `error` | object | error |
| `auth` | string | 仅首帧 `kind=hello` |
| `corr` | string | response / error / 异步 event 中 `method=task.progress` 等关联型 |

### 2.2 ULID 而非 UUID

- 单调递增、按时间排序方便日志检索
- 26 字符 base32，无 `-`，URL safe
- Node 侧用 `ulid` npm 包，Python 侧用 `python-ulid`

---

## 3 · 握手流程

```
Node                                 Python
 │ ws://127.0.0.1:<port>/v1          │
 ├──────────── connect ─────────────►│
 │                                   │ (TCP/WS upgrade)
 │ {kind:"hello", auth:"<token>",    │
 │  params:{client:"cli", ver:"0.1.0"}} │
 ├──────────────────────────────────►│
 │                                   │ token 校验：
 │                                   │   读 ~/.harness-trading/auth.json
 │                                   │   constant-time compare
 │ {kind:"response", corr:"...",     │
 │  result:{server:"0.1.0",          │
 │          features:["broker",      │
 │                    "skill",       │
 │                    "workflow"]}}  │
 │◄──────────────────────────────────┤
 │                                   │
 │ ─── 业务帧自由流动 ───            │
```

### 3.1 失败路径

- token 不匹配 → server 发 `kind=error` + `code=AUTH_FAIL` 后立即关闭连接（close code 4401）
- 版本不兼容 → `kind=error` + `code=VERSION_MISMATCH`，server 关闭连接（close code 4400）
- 30s 内未收到 `hello` 帧 → server 主动关闭（close code 4408）

### 3.2 token 来源

- 文件路径：`~/.harness-trading/auth.json`
- 格式：`{"token":"<256-bit hex>","created_at":1716998400}`
- 权限：`0600`，onboard 时由 CLI 生成
- 详见 [ADR-0005](./adr/phase2-decisions.md#adr-0005--auth-token-策略)

---

## 4 · 三种业务帧

### 4.1 Request / Response（同步 RPC 语义）

Node 调用：

```jsonc
{
  "v": 1, "id": "01HX1", "kind": "request", "ts": 1716998400123,
  "method": "skill.invoke",
  "params": {
    "skill": "backtest",
    "args": { "strategy": "mean-reversion", "from": "2024-01-01", "to": "2024-06-30" }
  }
}
```

Python 应答（成功）：

```jsonc
{
  "v": 1, "id": "01HX2", "kind": "response", "ts": 1716998400512,
  "corr": "01HX1",
  "result": {
    "artifact_id": "art_abc123",          // 大产物只返 id
    "summary": { "sharpe": 1.42, "mdd": -0.18 }
  }
}
```

### 4.2 Event（服务端推送）

适用于：长任务进度、行情推送、告警广播。

```jsonc
{
  "v": 1, "id": "01HX3", "kind": "event", "ts": 1716998401000,
  "method": "task.progress",
  "corr": "01HX1",                         // 关联触发请求；纯推送可省略
  "params": { "phase": "loading-bars", "pct": 23 }
}
```

事件 method 命名空间：

| 命名空间 | 用途 |
|---|---|
| `task.*` | 长任务生命周期：`task.started` / `task.progress` / `task.done` / `task.failed` |
| `feed.*` | FeedChannel 推送：`feed.bar` / `feed.tick` / `feed.news` |
| `alert.*` | AlertChannel 推送 |
| `surface.*` | SurfaceChannel UI 信号（Web / TUI / Voice） |
| `broker.*` | BrokerChannel 推送：`broker.fill` / `broker.reject` / `broker.position` |

### 4.3 Ping / Pong（心跳）

- Node 每 30s 发 `{kind:"ping"}`，Python 收到回 `{kind:"pong",corr:<ping.id>}`
- 双方任一方 60s 未见对端任何帧 → 主动关闭连接，重连由调用方负责

---

## 5 · 取消与超时

### 5.1 客户端主动取消

```jsonc
{ "v": 1, "id": "01HX4", "kind": "request", "ts": ...,
  "method": "task.cancel", "params": { "target": "01HX1" } }
```

Python 侧：把对应 asyncio task `cancel()`；任务清理完成后回 `task.done`，`result.cancelled=true`。

### 5.2 超时

- 默认 request 超时：60s（Node 侧计时；超时后 Node 自己丢弃 corr 表项）
- skill 长任务（backtest 等）应在 params 里显式 `timeout_sec` 或返回 `task.started` 后改走 event 流，原 request 立即 response（`status:"running"`）

---

## 6 · 错误码表

错误帧结构：

```jsonc
{
  "v": 1, "id": "01HX5", "kind": "error", "ts": ...,
  "corr": "01HX1",
  "error": {
    "code": "BROKER_REJECTED",
    "message": "insufficient margin",
    "data": { "broker": "paper", "balance": 1000.0, "required": 5000.0 },
    "retryable": false
  }
}
```

### 6.1 顶层错误码

| code | 含义 | retryable | 来源 |
|---|---|---|---|
| `AUTH_FAIL` | token 无效 / 缺失 | false | gateway |
| `VERSION_MISMATCH` | 协议版本不兼容 | false | gateway |
| `BAD_REQUEST` | 参数缺失 / 类型错 | false | gateway |
| `METHOD_NOT_FOUND` | 未注册的 method | false | dispatcher |
| `RATE_LIMITED` | 命中限流（如 broker quota） | true | channel |
| `TIMEOUT` | 服务端处理超时 | true | dispatcher |
| `CANCELLED` | 被 task.cancel 取消 | false | dispatcher |
| `BROKER_REJECTED` | 券商拒单 | depends on data | broker |
| `BROKER_DOWN` | 券商连接不可用 | true | broker |
| `INTERNAL` | 未捕获异常 | false | catch-all |

### 6.2 错误传递规约

- Python 侧任何 `Exception` 由 dispatcher 统一兜底转 `INTERNAL`，traceback 写本地日志，**不**透传给 Node
- 已知业务异常必须显式 `raise HarnessError(code, message, data, retryable)`，否则失去 retryable 语义
- `data` 字段允许结构化扩展，但**禁止**包含 PII / 密钥 / token

---

## 7 · 文件清单（实现侧）

```
packages/ws-bridge/
├── src/
│   ├── client.ts          # Node 侧 WebSocket 封装：connect / call / on
│   ├── frame.ts           # 信封 schema + ULID 生成
│   ├── auth.ts            # 读 ~/.harness-trading/auth.json
│   └── errors.ts          # 错误码常量 + HarnessError 类
└── tests/
    └── handshake.test.ts

backend/app/gateway/
├── server.py              # FastAPI websocket route /v1
├── frame.py               # pydantic 模型 + 验证
├── dispatcher.py          # method registry + asyncio 调度
├── auth.py                # constant-time token compare
└── errors.py              # HarnessError + dispatcher 兜底
```

---

## 8 · 兼容矩阵 / 版本演进

| Bridge ver | Node 包 ver | Python 包 ver | 状态 |
|---|---|---|---|
| `/v1` | `>=0.1, <1.0` | `>=0.1, <1.0` | 当前 |
| `/v2` | `>=1.0` | `>=1.0` | 预留，breaking 时启用 |

Breaking change 时双版本并跑至少 2 个 minor 周期，Node 侧通过 capabilities negotiation 选最低公共版本。

---

## 9 · 不在本协议范围

- skill registry 元数据格式 → `docs/skill-spec.md`（待写）
- workflow YAML schema → `docs/workflow-spec.md`（待写）
- BrokerChannel Python 内部接口 → [broker-adapter-protocol.md](./broker-adapter-protocol.md)
- Web ↔ ws-bridge 的浏览器侧封装 → `packages/web/src/lib/bridge.ts`（实现细节非协议）

---

## 10 · 决策追踪

| 决策点 | 取舍 | 理由 |
|---|---|---|
| WebSocket vs gRPC | WebSocket | 无需额外 .proto 工具链；浏览器直接复用 |
| JSON vs MsgPack | JSON | 调试友好，控制平面流量小；行情大流量另走 HTTP artifact |
| 单连接 vs 多连接 | 单连接全双工 | 简化重连逻辑，事件 / RPC 共享通道 |
| auth 头 vs 首帧 | 首帧 `hello` | WebSocket 浏览器端无法自定义 header，统一首帧 |
| ULID vs UUID | ULID | 单调可排序，日志友好 |
