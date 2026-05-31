# Changelog

All notable changes to harness-trading.

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### Added 新增
- 一键启动脚本 `start.sh`：环境检测 → 依赖安装 → 启动前后端 → 灌入演示数据，全自动
- `POST /api/trading/seed`：一键灌入演示交易数据（4笔已平仓交易）
- `feature-*.png` 带阴影效果的功能截图（6张）
- `demo.gif` 3帧轮播演示动图
- 飞书 / 企业微信告警通道（`FeishuAlert` / `WeComAlert`）
- 渠道管理 Web UI：toggle 开关、webhook 配置器、一键测试发送
- Skills 管理页面：可视化卡片 + LLM 自然语言创建 + 在线编辑源码
- Agent 角色下拉切换（5个预注册角色）+ `POST /api/agent/role`
- 仪表盘实时 KPI 卡片（总资产 / 盈亏 / 胜率 / 盈亏比）
- `CONTRIBUTING.md` + `.github/ISSUE_TEMPLATE/`（Bug Report / Feature Request）
- `MIT LICENSE`

### Changed 变更
- README 大幅改版：精简定位描述、添加对比表格、移除未实现功能的承诺
- `docs/roadmap.md` 更新至 S5 完成状态
- 知识库文档从 3 篇扩充至 9+ 篇

### Removed 移除
- `docs/tech-spec-phase2.md`（与当前代码状态不一致的早期规划文档）

---

## [0.2.0] — 2026-05-26

### Added 新增
- Sprint 3: AI 工作流引擎（YAML 驱动，4个内置工作流）
- Sprint 3: Agent 协同系统（5个预注册角色，多角色编排）
- Sprint 4: Eval Harness（L1/L2/L3 评估框架）
- Sprint 4: Knowledge Garden（BM25 全文检索 + RAG）
- Sprint 4: Web Dashboard（10+ 前端页面全量对接）
- Sprint 4: 交易日志（Journal）、自选股（Watchlist）
- Sprint 4: 定时任务调度器（`scheduler.py`）
- 行情数据接入修复：macOS 代理兼容 + 兜底 mock 数据
- Phase 2 补齐：51 个 pytest、SQLAlchemy 5表、GitHub Actions CI、Docker Compose

---

## [0.1.0] — 2026-05-21

### Added 新增
- 项目骨架：Next.js 16 前端 + FastAPI 后端
- Sprint 1: 端到端 WebSocket 通信基石（Node↔Python bridge）
- Sprint 1: Python Gateway 服务端骨架
- Sprint 2: Skills 目录化架构（`BaseSkill` + `skill_registry`）
- Sprint 2: Channels 协议层（Feed / Alert / Broker 三类通道）
- 安全护栏系统（`harness/`）：校验链 + 熔断器
- 多模型 LLM 路由：DeepSeek / OpenAI / Claude / Ollama
- 东方财富实时行情接入（Sina/Tencent API）
- 模拟交易引擎（`paper_trading.py`）
- 基础前端页面：仪表盘、AI 对话、知识库、安全中心

---

## [0.0.1] — 2026-05-16

### Added 新增
- 项目初始化
- README + QUICKSTART 双文档
- 技术设计文档（ADRs + Broker/Node-Bridge 协议）
