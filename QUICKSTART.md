# 快速上手指南

本文档帮助你从零开始在本地运行 Harness Trading 系统。

---

## 前置要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Python | 3.12+ | 后端运行环境 |
| Node.js | 18+ | 前端运行环境 |
| npm | 9+ | 包管理器 |
| Docker（可选） | 24+ | 使用 Docker Compose 一键部署时需要 |

---

## 1. 克隆项目并配置环境变量

```bash
# 进入项目目录
cd harness-trading

# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，填入你需要的 LLM API Key：

```bash
# 必填——至少配一个 LLM Provider 的 API Key
DEEPSEEK_API_KEY=sk-your-deepseek-key     # 推荐：默认交易决策模型
# 或
ANTHROPIC_API_KEY=sk-ant-your-key
# 或
OPENAI_API_KEY=sk-your-openai-key

# 可选
MOONSHOT_API_KEY=sk-your-moonshot-key
GOOGLE_API_KEY=your-google-key
QWEN_API_KEY=your-qwen-key
GLM_API_KEY=your-glm-key
```

> **推荐配置 DeepSeek**：目前 `providers.yaml` 中交易决策、行情分析等任务默认路由到 DeepSeek（`secondary` 模型），配好即可直接使用。想用其他模型，参考下方「切换 LLM 模型」章节。

---

## 2. 启动服务

### 方式一：Docker Compose（推荐）

```bash
# 一键启动前后端
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

启动后：
- 后端 API：http://localhost:8000
- 前端页面：http://localhost:3000
- 健康检查：http://localhost:8000/api/health

### 方式二：手动分别启动

#### 启动后端

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

---

## 3. 验证服务

打开浏览器访问 http://localhost:3000，你应该看到 Dashboard 主面板，包含三个区域：

- **左侧** — AI Agent 对话面板
- **中间** — 市场行情概览
- **右侧** — 安全护栏面板

访问 http://localhost:8000/api/health 确认后端返回：

```json
{"status": "ok", "app": "Harness Trading", "env": "development"}
```

---

## 4. 快速体验核心功能

### 4.1 和 AI Agent 对话

在 Dashboard 左侧的 Agent 面板中输入消息，例如：

```
帮我分析一下贵州茅台（600519）的走势
```

AI 会调用配置的 LLM 模型进行回复。

### 4.2 查看实时行情

中间面板会自动加载主要指数（上证、深证、恒生、标普 500）和热门个股行情。

### 4.3 提交模拟交易订单

默认模式是 **演习模式（Dry Run）**，订单不会真实执行。切换到 **Agent 页面**（左侧导航 → Agent），可以进行更深入的对话。

通过 API 提交模拟订单：

```bash
curl -X POST http://localhost:8000/api/trading/order \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "600519",
    "action": "buy",
    "price": 1800.00,
    "quantity": 100,
    "reason": "AI建议买入茅台"
  }'
```

返回示例（演习模式）：

```json
{
  "status": "dry_run_logged",
  "approval": {
    "approved": true,
    "mode": "dry_run",
    "final_action": "dry_run_log",
    "validation_results": [
      {"check": "price_check", "status": "pass", "message": "订单价格 1800.0 合理"},
      {"check": "quantity_check", "status": "pass", "message": "数量 100 股合理"},
      {"check": "order_type_check", "status": "pass", "message": "订单类型 limit 允许"},
      {"check": "time_check", "status": "pass", "message": "在交易时段内"},
      {"check": "frequency_limit", "status": "pass", "message": "频率正常"}
    ]
  },
  "message": "演习模式：订单已记录但未执行"
}
```

### 4.4 切换执行模式

Dashboard 顶栏可以切换三种模式：

| 按钮 | 效果 |
|------|------|
| 🟢 **演习** | AI 建议正常运作，订单记录但不执行 |
| 🟡 **审批** | 订单进入人工审批队列，确认后才执行（模拟） |
| 🔴 **自动** | 风险检查通过后自动执行（模拟） |

### 4.5 熔断机制演示

在右侧护栏面板点击 **「触发熔断」**，此后所有订单将被直接拒绝：

```bash
curl -X POST http://localhost:8000/api/harness/circuit-breaker/trigger?reason=演示熔断
```

此时提交任何订单都会被拦截。点击 **「重置熔断」** 恢复正常。

---

## 5. 切换 LLM 模型

编辑 `config/providers.yaml`，修改路由规则即可切换模型。

### 示例：所有任务改用 OpenAI GPT-4o

```yaml
routing:
  trading_decision: vision     # 原为 secondary(DeepSeek)
  market_analysis: vision
  news_summary: vision
  # ... 其他任务同理
```

### 示例：启用本地 Ollama 模型

1. 确保本地运行了 Ollama：
   ```bash
   ollama pull qwen2.5:32b
   ```

2. 在 `providers.yaml` 中将 `local` 的 `enabled` 改为 `true`，然后修改路由：
   ```yaml
   routing:
     trading_decision: local
     chat: local
   ```

### 示例：仅用 DeepSeek（无需配其他 Key）

将 `providers.yaml` 中其他 provider 的 `enabled` 设为 `false`，仅保留 `secondary`（DeepSeek），路由全部指向 `secondary`。

---

## 6. 自定义安全护栏规则

编辑 `config/harness.yaml` 调整风控策略：

```yaml
validator_chain:
  price_check:
    enabled: true
    max_deviation_pct: 5.0        # 调大价格偏离容忍度

  frequency_limit:
    max_orders_per_window: 10     # 放宽下单频率
    window_minutes: 30

risk_controller:
  daily_loss_limit_pct: 8.0       # 提高日内亏损上限
  single_order_amount_limit: 200000
```

修改后重启后端即生效。

---

## 7. 前端页面导航

| 导航项 | 页面 | 功能 |
|--------|------|------|
| 📊 **Dashboard** | 主面板 | Agent 对话 + 行情 + 护栏概览 |
| 🤖 **Agent** | 全屏 Agent | 深度 AI 交易对话 |
| 🔀 **Workflows** | 工作流 | 可视化交易策略流程 |
| 💼 **Portfolio** | 投资组合 | 持仓明细、盈亏统计 |
| 🛡️ **Safety** | 安全中心 | 护栏规则配置、熔断管理 |
| 📚 **Knowledge** | 知识库 | 交易知识管理 |
| ⚙️ **Settings** | 设置 | 系统配置 |

---

## 8. API 调试工具

访问 FastAPI 自带的 Swagger 文档：

```
http://localhost:8000/docs
```

可以在此直接测试所有 API 接口，包含完整的请求/响应示例。

---

## 常见问题

### Q: 前端页面显示「Backend not available」

**A:** 后端未启动或端口被占用。检查后端是否正常运行：
```bash
curl http://localhost:8000/api/health
```

### Q: 聊天返回「AI 服务暂时不可用」

**A:** LLM 配置问题。检查：
1. `.env` 中是否配置了至少一个 API Key
2. `providers.yaml` 中的 provider 是否 `enabled: true`
3. 网络是否能访问对应的 API 端点

### Q: 行情数据不显示

**A:** 系统有 Mock 降级机制，即使外部 API 不可用也会显示模拟数据。如果连 Mock 数据都看不到，请检查浏览器控制台是否有错误。

### Q: macOS 下行情接口超时

**A:** 行情服务使用 `curl` 子进程绕过 macOS 系统代理，通常不受影响。如果确实超时，可能是网络环境问题，系统会自动降级到 Mock 数据。

### Q: 如何换成真实交易？

**A:** 当前版本暂不支持真实券商对接。`backend/app/execution/brokers/` 目录预留了券商接口，可自行实现。**在此之前，请勿在自动模式下连接真实资金。**

---

## 下一步

- 阅读 [README.md](./README.md) 了解项目架构
- 查看 `config/harness.yaml` 调整风控规则
- 查看 `config/providers.yaml` 自定义模型路由
- 访问 `http://localhost:8000/docs` 浏览完整 API 文档

---

> ⚠️ **免责声明**：本项目仅供学习研究使用，不构成任何投资建议。交易有风险，入市需谨慎。请勿在未充分理解风险的情况下使用自动交易模式。
