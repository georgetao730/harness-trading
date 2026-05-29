# BrokerChannel Adapter Protocol (v0.1)

> Status: **Draft** · Owner: harness-trading core · Depends on: [tech-spec-phase2.md](./tech-spec-phase2.md), [ADR-0003](./adr/phase2-decisions.md#adr-0003--broker-plugin-范围), [ADR-0005](./adr/phase2-decisions.md#adr-0005--auth-token-策略)

定义 `BrokerChannel` 作为 Channels 一等公民如何被实现、注册、调用，以及 `HarnessToken` 如何在 paper / live 模式间提供安全闸门。

---

## 1 · 总览

```
┌────────────────────────────────────────────┐
│ backend/app/channels/broker.py             │
│   BrokerChannel(Protocol)        ← 协议契约 │
│   register_broker(channel)       ← 注册入口 │
│   get_broker(name) -> BrokerChannel        │
└────────────────────────────────────────────┘
        ▲                          ▲
        │                          │
┌───────┴────────┐         ┌───────┴────────────┐
│ paper broker   │         │ live broker        │
│ (内置实现)      │         │ (用户自带 wrapper)  │
│ 无需 token     │         │ 必须 HarnessToken  │
└────────────────┘         └────────────────────┘
```

**核心约束**（[ADR-0003](./adr/phase2-decisions.md#adr-0003--broker-plugin-范围)）：

- BrokerChannel 仅 Python 侧 `typing.Protocol`，外部 Rust/Go SDK 走 Python wrapper
- 不预留 gRPC / REST plugin 接口（v0.x 不做）
- 注册时 registry 强制校验 `submit` 签名包含 `harness_token` 参数

---

## 2 · Protocol 定义

```python
# backend/app/channels/broker.py
from __future__ import annotations
from typing import Protocol, Literal, runtime_checkable
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


# === 值对象 ===

OrderSide = Literal["buy", "sell"]
OrderType = Literal["market", "limit", "stop", "stop_limit"]
TimeInForce = Literal["gtc", "ioc", "fok", "day"]
OrderStatus = Literal["pending", "submitted", "partial", "filled", "cancelled", "rejected"]


@dataclass(frozen=True)
class OrderRequest:
    symbol: str
    side: OrderSide
    qty: Decimal
    order_type: OrderType
    limit_price: Decimal | None = None
    stop_price: Decimal | None = None
    tif: TimeInForce = "day"
    client_order_id: str | None = None    # ULID, idempotency key
    meta: dict | None = None              # 透传业务标记，broker 不解释


@dataclass(frozen=True)
class OrderAck:
    broker_order_id: str
    client_order_id: str
    status: OrderStatus
    accepted_at: datetime


@dataclass(frozen=True)
class Fill:
    broker_order_id: str
    fill_id: str
    qty: Decimal
    price: Decimal
    fee: Decimal
    ts: datetime


@dataclass(frozen=True)
class Position:
    symbol: str
    qty: Decimal           # 正多空
    avg_price: Decimal
    market_value: Decimal


@dataclass(frozen=True)
class Account:
    cash: Decimal
    equity: Decimal
    buying_power: Decimal
    currency: str = "USD"


# === HarnessToken ===

@dataclass(frozen=True)
class HarnessToken:
    """
    跨 paper/live 闸门的能力凭证。**值语义不可伪造**——必须通过
    backend.app.security.token.issue_live_token() 由 onboard 流程生成。

    - mode='paper': 任意调用方可获得（无副作用）
    - mode='live': 必须 onboard 时显式 opt-in，且 issued_to 与当前 broker 名严格匹配
    """
    mode: Literal["paper", "live"]
    issued_to: str            # broker name, e.g. "ibkr-paper" / "binance-live"
    issued_at: datetime
    nonce: str                # 32-byte hex; 每次发行唯一
    signature: str            # HMAC-SHA256(secret, mode|issued_to|issued_at|nonce)


# === 协议 ===

@runtime_checkable
class BrokerChannel(Protocol):
    """
    所有 broker adapter 必须实现该协议。
    register_broker() 会用 isinstance(channel, BrokerChannel) 校验。
    """

    name: str                                # 唯一名，e.g. "paper" / "ibkr-live"
    mode: Literal["paper", "live"]

    async def submit(
        self,
        order: OrderRequest,
        harness_token: HarnessToken,         # ← 强制 keyword-or-positional
    ) -> OrderAck: ...

    async def cancel(
        self,
        broker_order_id: str,
        harness_token: HarnessToken,
    ) -> OrderAck: ...

    async def query_order(
        self,
        broker_order_id: str,
    ) -> OrderAck: ...                       # 只读，不需 token

    async def query_positions(self) -> list[Position]: ...

    async def query_account(self) -> Account: ...

    def stream_fills(self) -> "AsyncIterator[Fill]": ...
    """长生命周期推送，由 gateway 转 broker.fill 事件"""
```

---

## 3 · HarnessToken 校验语义

### 3.1 颁发流程

```
onboard CLI                       backend/security/token.py
    │
    │  user --enable-live-trading=ibkr-live
    ├───────────────────────────────►
    │                                 1. 二次确认（terminal prompt）
    │                                 2. 读 ~/.harness-trading/secret.key
    │                                    (256-bit, 0600, onboard 时生成)
    │                                 3. issue_live_token(name="ibkr-live")
    │                                    → HarnessToken(mode="live", ...)
    │                                 4. 持久化到 ~/.harness-trading/live-grants.json
    │                                    (per-broker, 0600)
    │  HarnessToken                   │
    │◄────────────────────────────────┤
```

### 3.2 校验时机

每次 `submit / cancel` 调用前，**broker 实现内部第一行**必须：

```python
async def submit(self, order, harness_token):
    self._verify_token(harness_token)        # 见 §3.3
    ...
```

`_verify_token` 应继承自 `BrokerBase`（提供基类）。

### 3.3 `_verify_token` 语义

```python
class BrokerBase:
    def _verify_token(self, t: HarnessToken) -> None:
        if t.mode != self.mode:
            raise HarnessError("AUTH_FAIL", f"token mode mismatch: {t.mode} vs {self.mode}")
        if t.issued_to != self.name:
            raise HarnessError("AUTH_FAIL", f"token issued to {t.issued_to}, not {self.name}")
        if not _verify_hmac(t):
            raise HarnessError("AUTH_FAIL", "token signature invalid")
        # paper token 无过期；live token 默认 24h，过期后 onboard 重新颁发
        if self.mode == "live" and (now() - t.issued_at).total_seconds() > 86400:
            raise HarnessError("AUTH_FAIL", "live token expired; re-run onboard --enable-live-trading")
```

### 3.4 paper / live 隔离

| 维度 | paper | live |
|---|---|---|
| token mode | `"paper"` | `"live"` |
| onboard 操作 | 默认开启 | 显式 `--enable-live-trading=<name>` + 二次确认 |
| 过期 | 永不 | 24h |
| 副作用 | 内存账本 | 真实下单 |
| 默认仓位限额 | 无 | 单笔 ≤ $1000，单日 ≤ $5000（broker 自己实现，用户可改） |
| 日志脱敏 | 无 | order/fill 必须打 broker_order_id，不打 secret |

---

## 4 · 注册流程

```python
# backend/app/channels/broker.py
_REGISTRY: dict[str, BrokerChannel] = {}

def register_broker(channel: BrokerChannel) -> None:
    if not isinstance(channel, BrokerChannel):           # protocol runtime check
        raise TypeError(f"{channel} does not implement BrokerChannel")

    # 强制校验 submit 签名包含 harness_token 形参
    sig = inspect.signature(channel.submit)
    if "harness_token" not in sig.parameters:
        raise TypeError(f"{channel.name}.submit missing 'harness_token' param")

    if channel.name in _REGISTRY:
        raise ValueError(f"broker {channel.name} already registered")

    _REGISTRY[channel.name] = channel


def get_broker(name: str) -> BrokerChannel:
    if name not in _REGISTRY:
        raise HarnessError("BROKER_NOT_FOUND", f"unknown broker: {name}")
    return _REGISTRY[name]
```

第三方 adapter 在自己的包 `__init__.py` 调用 `register_broker(...)`，由 onboard 时 `pip install` 触发。

---

## 5 · 内置 paper broker（参考实现）

```python
# backend/app/channels/brokers/paper.py
class PaperBroker(BrokerBase):
    name = "paper"
    mode = "paper"

    def __init__(self, initial_cash: Decimal = Decimal("100000")):
        self._cash = initial_cash
        self._positions: dict[str, Position] = {}
        self._orders: dict[str, OrderAck] = {}
        self._fills_queue: asyncio.Queue[Fill] = asyncio.Queue()

    async def submit(self, order, harness_token):
        self._verify_token(harness_token)
        # 模拟撮合：market 立即成交，limit 检查最新行情
        ...

    async def cancel(self, broker_order_id, harness_token):
        self._verify_token(harness_token)
        ...

    # ... 其余略
```

注册：

```python
# backend/app/channels/brokers/__init__.py
from .paper import PaperBroker
from ..broker import register_broker

register_broker(PaperBroker())
```

---

## 6 · 用户自定义 broker（外部 SDK wrapper 范式）

假设用户用 Rust 写了一个高性能 binance adapter，编译为 `binance_rs.so`：

```python
# my-binance-broker/src/my_binance_broker/__init__.py
import binance_rs                            # PyO3 binding
from harness_trading.channels.broker import BrokerBase, register_broker

class BinanceLive(BrokerBase):
    name = "binance-live"
    mode = "live"

    def __init__(self, api_key: str, api_secret: str):
        self._client = binance_rs.Client(api_key, api_secret)

    async def submit(self, order, harness_token):
        self._verify_token(harness_token)
        rust_order = binance_rs.OrderRequest(
            symbol=order.symbol, side=order.side, qty=str(order.qty),
        )
        ack = await asyncio.to_thread(self._client.submit, rust_order)
        return OrderAck(broker_order_id=ack.id, ...)

    # ... 其余略

register_broker(BinanceLive(
    api_key=os.environ["BINANCE_API_KEY"],
    api_secret=os.environ["BINANCE_API_SECRET"],
))
```

用户安装：

```bash
uv pip install my-binance-broker
harness-trading onboard --enable-live-trading=binance-live
```

---

## 7 · 错误处理

所有 broker 实现应抛 `HarnessError`（继承 `Exception`）：

| code | 场景 | retryable |
|---|---|---|
| `AUTH_FAIL` | token 校验失败 | false |
| `BROKER_REJECTED` | 券商拒单（资金不足 / 标的不可交易） | false（需用户介入） |
| `BROKER_DOWN` | 网络断 / 券商 5xx | true |
| `BROKER_RATE_LIMIT` | 命中 broker 速率上限 | true |
| `INVALID_ORDER` | order 字段非法（qty<=0 等） | false |

错误传递到 Node 侧由 [node-python-bridge.md §6](./node-python-bridge.md#6--错误码表) 定义。

---

## 8 · 测试约定

每个 broker adapter 必须提供：

```
my-binance-broker/
├── tests/
│   ├── test_protocol_compliance.py    # isinstance(BrokerBase, BrokerChannel)
│   ├── test_token_verify.py           # paper/live token 拒收、过期、签名错
│   ├── test_submit_happy_path.py
│   ├── test_submit_reject.py
│   ├── test_idempotency.py            # 同 client_order_id 二次提交不重复下单
│   └── test_stream_fills.py
```

`harness-trading` 主包提供 `harness_trading.testing.broker_contract` pytest fixture，导入即获得通用契约用例。

---

## 9 · 不在本协议范围

- **行情订阅**：FeedChannel 单独定义（`docs/feed-channel-protocol.md` 待写）
- **风控规则引擎**：风控介于 strategy 与 broker 之间，独立 channel，下个迭代加
- **多腿 / 复合订单**：v0.x 不支持，复合订单由 strategy 拆成多个 atomic submit

---

## 10 · 决策追踪

| 决策点 | 取舍 | 理由 |
|---|---|---|
| 单一 BrokerChannel vs 分 PaperBroker / LiveBroker | 单一 + mode 字段 | 接口一致便于策略代码 paper→live 零修改 |
| HarnessToken 必填 vs 仅 live 必填 | 必填，paper 模式发"无副作用 token" | 接口对称避免 strategy 代码分支 |
| token 过期 vs 长效 | live 24h，paper 永不 | 平衡安全与体验 |
| Protocol vs ABC | Protocol + runtime_checkable | duck typing 友好，便于 wrapper 模式 |
| 注册中心 vs entry_points | 显式 `register_broker()` | onboard 流程可见，避免隐式发现 |
| client_order_id 必填 vs 可选 | 可选（ULID 自动生成） | 简单调用零负担，幂等场景显式传 |
