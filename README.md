# Harness Trading

**AI 驱动的量化交易助手 — 带安全护栏（Safety Harness）的智能交易系统**

Harness Trading 是一个全栈 AI 交易平台，核心理念是让 AI 辅助交易决策，同时通过多层安全护栏确保每一笔交易都在可控范围内执行。支持多 LLM 供应商（Anthropic Claude、DeepSeek、OpenAI GPT、Ollama 等），提供实时行情接入、模拟交易引擎和完整的前端面板。

---

## 核心特性

### 安全护栏（Safety Harness）

交易安全是 Harness Trading 的最核心设计理念。所有交易订单必须通过多层校验链：

| 校验层 | 说明 |
|--------|------|
| **价格校验** | 订单价格偏离市价超过阈值（默认 3%）时自动拦截 |
| **数量校验** | 单笔数量合理性检查，防止超额下单 |
| **订单类型校验** | 禁止市价单，仅允许限价单，避免滑点风险 |
| **交易时间校验** | 非交易时段自动拦截所有订单 |
| **频率限制** | 限制短时间内的下单次数（默认 5 笔/30 分钟） |
| **风险控制** | 单日亏损上限、持仓集中度、单笔金额上限、最大杠杆 |
| **熔断机制** | 触及风控阈值后自动熔断，需手动重置 |

### 三种执行模式

| 模式 | 说明 |
|------|------|
| **演习模式（Dry Run）** | AI 正常决策但订单仅记录不执行，适合回测和验证 |
| **审批模式（Approval）** | 所有订单排队等待人工审批后才执行 |
| **自动模式（Auto）** | 在安全范围内自动执行，高风险订单自动升级为审批模式 |

### 多模型智能路由

支持主流 LLM 供应商，按任务类型自动路由：

- **Anthropic Claude** — 主推理模型
- **DeepSeek** — 辅助模型（默认交易决策模型）
- **OpenAI GPT-4o** — 多模态分析
- **Moonshot** — 长上下文处理
- **Ollama 本地模型** — 私密数据本地推理

### 实时行情数据

- **A股** — 通过东方财富 API 获取实时行情、K 线数据
- **港股** — 支持恒生指数及个股行情
- **美股** — 支持标普 500 等主要指数
- 带缓存机制和 Mock 数据优雅降级

### 模拟交易引擎

内置 Paper Trading 引擎，支持：
- 初始资金 100 万虚拟交易
- 持仓管理、成本均摊
- 盈亏计算（已实现/未实现）
- 完整订单历史和交易记录

---

## 技术栈

### 后端

| 组件 | 技术 |
|------|------|
| 框架 | FastAPI (Python 3.12+) |
| 异步 | asyncio / uvicorn |
| LLM | OpenAI SDK / Anthropic SDK / Google GenAI |
| 数据 | SQLAlchemy + asyncpg / Redis |
| 任务队列 | Celery + APScheduler |
| 日志 | Loguru |
| 配置 | Pydantic Settings + YAML |

### 前端

| 组件 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 |
| 样式 | Tailwind CSS 4 |
| 图表 | Recharts |
| 图标 | Lucide React |
| 语言 | TypeScript |

### 部署

| 方式 | 说明 |
|------|------|
| Docker Compose | 一键启动前后端服务 |
| 后端 | Python 3.12-slim 容器 |
| 前端 | Node.js 容器 |

---

## 项目结构

```
harness-trading/
├── backend/                    # Python 后端
│   ├── app/
│   │   ├── agent/              # AI Agent 技能系统
│   │   │   ├── skills/         # 可插拔技能模块（行情、技术分析）
│   │   │   └── memory/         # Agent 记忆系统
│   │   ├── api/                # API 路由层
│   │   │   ├── agent.py        # Agent 对话 & WebSocket
│   │   │   ├── trading.py      # 交易 & 行情接口
│   │   │   └── harness.py      # 安全护栏管理接口
│   │   ├── core/               # 核心配置 & 事件总线
│   │   ├── execution/          # 交易执行层
│   │   │   ├── paper_trading.py # 模拟交易引擎
│   │   │   └── brokers/        # 真实券商接口（预留）
│   │   ├── harness/            # 安全护栏核心
│   │   │   ├── engine.py       # 校验链 / 风险控制 / 熔断器
│   │   │   └── pipeline.py     # 护栏流水线编排
│   │   ├── llm/                # LLM 管理层
│   │   │   ├── manager.py      # 多模型路由 & 配置加载
│   │   │   ├── base.py         # 抽象接口
│   │   │   └── providers/      # 各厂商实现
│   │   ├── services/           # 业务服务层
│   │   │   └── market_data.py  # 行情数据服务
│   │   └── main.py             # FastAPI 入口
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # Next.js 前端
│   └── src/
│       ├── app/                # 页面入口
│       ├── components/         # UI 组件
│       │   ├── agent/          # Agent 对话面板
│       │   ├── charts/         # 行情图表
│       │   ├── dashboard/      # 侧边栏 & 顶栏
│       │   ├── harness/        # 安全中心面板
│       │   ├── portfolio/      # 投资组合页面
│       │   └── workflow/       # 工作流页面
│       └── lib/                # API 客户端
├── config/                     # 全局配置文件
│   ├── harness.yaml            # 安全护栏规则
│   └── providers.yaml          # LLM 供应商配置
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## API 概览

### Agent API (`/api/agent`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/chat` | 向 AI Agent 发送消息 |
| GET | `/mode` | 获取当前执行模式 |
| POST | `/mode` | 切换执行模式 |
| GET | `/skills` | 列出所有可用技能 |
| WS | `/ws` | WebSocket 实时通信 |

### Trading API (`/api/trading`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/order` | 提交交易订单（经过安全护栏） |
| GET | `/portfolio` | 获取模拟持仓组合 |
| GET | `/orders` | 获取历史订单 |
| GET | `/market/indices` | 获取主要市场指数 |
| GET | `/market/quote` | 获取个股实时行情 |
| GET | `/market/kline` | 获取 K 线数据 |

### Harness API (`/api/harness`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/status` | 获取护栏状态 |
| GET | `/config` | 获取完整护栏配置 |
| POST | `/mode` | 切换执行模式 |
| POST | `/circuit-breaker/trigger` | 手动触发熔断 |
| POST | `/circuit-breaker/reset` | 重置熔断器 |

---

## 许可证

本项目仅供学习和研究使用。交易有风险，入市需谨慎。
