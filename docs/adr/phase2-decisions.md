# Phase 2 — 7 个核心决策（ADR 0001-0007）

> Sprint 0 决策周产出。所有决策**已 Accepted**，对应 [docs/tech-spec-phase2.md §18](../tech-spec-phase2.md) 的 Q1-Q7。
> 决策日期：2026-05-29。决策人：@georgetao730。
> 后续若推翻某条，**必须**以新 ADR 形式覆盖（不直接改本文件原文，加 `Superseded by ADR-NNNN`）。

---

## ADR-0001 · Python 环境 fallback 策略

**Status**: Accepted

**Context**: onboard wizard 在用户机器上检测不到 `python3.12+` 时，需要决定如何 fallback。三个选项：(a) 强制要求用户 `brew/apt install python@3.12`；(b) 用 `uv python install 3.12` 让 uv 自带独立解释器；(c) PyInstaller 预编译 backend zip。

**Decision**: **强制要求 brew / apt 装 Python 3.12+**。onboard 检测不到就报错退出，输出明确的安装指引（macOS: `brew install python@3.12`；Ubuntu: `apt install python3.12`；Windows: 引导到 python.org）。

**Consequences**:
- ✅ 用户机器上的 Python 路径可控，不与 uv 自带的解释器混淆
- ✅ talib / numpy / pandas 等 C 扩展按系统标准方式编译，避免奇怪报错
- ✅ onboard 代码量小、可控
- ❌ "60 秒安装到能问 agent" 的口号在 Python 缺失场景下会被装 Python 这步拖到 5+ 分钟
- ❌ 减少了对没装过 Python 的小白用户友好度（量化用户大概率有 Python，问题不大）

**Alternatives considered**:
- uv 自带 Python：被否，因为系统 Python / uv Python 双解释器并存会让用户调试时困惑
- PyInstaller 预编译：被否，体积上百 MB + 量化生态 C 扩展重打包困难

**Implementation**:
- `packages/cli/src/onboard/check-python.ts` 调 `which python3.12 && python3.12 --version`
- 失败时打印分平台安装命令，exit code 2

---

## ADR-0002 · npm 包发布策略

**Status**: Accepted

**Context**: agentic-hooks 作为独立通用包要发布到 registry。npm vs jsr 选择。

**Decision**: **只发 npm**。
- 主包：`harness-trading`（无 scope，方便 `npm i -g harness-trading`）
- 子包：`@harness-trading/agentic-hooks`、`@harness-trading/cli`、`@harness-trading/supervisor`、`@harness-trading/ws-bridge`、`@harness-trading/web`

**Consequences**:
- ✅ 与 Cursor / Codex / Claude IDE 默认 Node 工具链一致
- ✅ 单一发布流水线，CI 简单
- ❌ 不享受 jsr 的 TS 原生支持

**Alternatives considered**:
- jsr 双发：被否，jsr 生态尚在初期，双发增加 CI 复杂度
- 仅 jsr：被否，IDE 集成默认 npm

**Implementation**:
- `packages/*/package.json` 配 `"publishConfig": {"access": "public"}`
- GitHub Actions release workflow 在 tag `v*` 时执行 `pnpm -r publish`

---

## ADR-0003 · Broker plugin 协议范围

**Status**: Accepted

**Context**: BrokerChannel 是 channel 系统中风险最高的一类（涉及真金白银）。是否要从 v0.1 就支持跨语言 plugin（Rust/Go via gRPC）？

**Decision**: **v0.x 仅支持 Python plugin**。BrokerChannel Protocol 在 Python 侧定义为 `typing.Protocol` 类，外部社区如果要用 Rust/Go broker SDK，自己写一层 Python wrapper。**不预留 gRPC 接口**（避免 spec 增加无价值的 boilerplate）。

**Consequences**:
- ✅ 协议简单：单语言 Python，HarnessToken 校验逻辑直接进 Python 调用栈
- ✅ Safety Harness 控制路径清晰：channel registry 注册时静态检查 `submit(self, order, harness_token)` 签名
- ❌ Rust/Go 写的 broker SDK 接入有摩擦（量级低，社区可消化）

**Alternatives considered**:
- Python 主 + gRPC 备：被否，预留接口但不实现 = 文档负担
- gRPC 一等公民：被否，运行时复杂、与"local-first 极简"原则冲突

**Implementation**:
- `backend/app/channels/broker.py` 定义 `BrokerChannel(Protocol)` + `register_broker(channel)`
- registry 拒绝注册没有 `harness_token` 参数的 broker

---

## ADR-0004 · Workflow 并行 stage

**Status**: Accepted

**Context**: workflow 引擎是否从 v0.1 就支持并行 stage（如 backtest + paper-validate 同时跑），还是 v0.x 只串行。

**Decision**: **v0.1 就支持并行 stage**。stage YAML 声明：
```yaml
- name: validate
  parallel:
    - backtest
    - paper-shadow
  join: all  # 默认 all；可选 any / first
```

**Consequences**:
- ✅ 量化场景天然有并行需求（多策略并行回测、多 broker paper-shadow）
- ✅ 一上来就把 join 语义定下来，避免后期 retrofit
- ❌ 实现复杂度比纯串行高约 30%（多了一层 stage 调度器）
- ❌ 错误聚合 / 取消传播 / 超时管理都要从一开始考虑

**Alternatives considered**:
- v0.x 仅串行：被否，量化场景的多策略并行刚需迟早要做
- 留白：被否，现在不定语义后期改起来更痛

**Implementation**:
- `backend/app/workflows/runner.py` 引入 `asyncio.gather` + `join` 策略
- `parallel` stage 失败语义：`join: all` 任一失败即整体失败；`join: any` 一个成功即继续；`join: first` 最快返回的胜出

---

## ADR-0005 · Auth token 策略

**Status**: Accepted

**Context**: Web Dashboard / CLI / hook 都需要认证 Python Gateway。是否需要 token rotate 机制？

**Decision**: **一次性 long-lived token，不 rotate**。
- onboard wizard 生成 256-bit 随机 token，写到 `~/.harness-trading/auth.json`（perm 0600）
- CLI / Web / hook 全部从该文件读
- 用户主动跑 `harness-trading auth regenerate` 才会生成新 token

**Consequences**:
- ✅ 与 local-first / 单用户场景匹配
- ✅ 实现简单：无需 refresh 流程、无 token 失效中断
- ❌ token 泄漏后只能手动重生（local 文件，泄漏路径有限，可接受）

**Alternatives considered**:
- 30 天过期 + 手动 refresh：被否，单用户 local 场景过度
- OAuth refresh-token：被否，复杂度跟实际威胁模型不匹配

**Implementation**:
- `packages/cli/src/auth.ts` 读写 `~/.harness-trading/auth.json`
- Python Gateway 用 `Authorization: Bearer <token>` 校验
- ws frame `auth` 字段透传同一 token

---

## ADR-0006 · uv 中国大陆镜像

**Status**: Accepted

**Context**: uv 默认从 PyPI / GitHub 拉，中国大陆速度慢。

**Decision**: **onboard 内置镜像选项 + 自动检测提示**。
- 检测条件：`LANG=zh_CN.*` 或 ipinfo / curl 测速判定为中国大陆
- 命中时 onboard 询问 "Detected China region, enable mirror? [Y/n]"
- 用户确认后写入 `~/.harness-trading/.env`：
  - `UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple`
  - `UV_PYTHON_INSTALL_MIRROR=https://github.moeyy.xyz/https://github.com/indygreg/python-build-standalone/releases/download`
- 默认关，用户主动确认后才启

**Consequences**:
- ✅ 中国用户首次体验跟海外用户同等
- ✅ 不强加给所有用户（避免不必要的镜像依赖）
- ❌ 增加 onboard 一步交互（可接受）

**Alternatives considered**:
- 不内置，文档教学：被否，首次体验差
- 中国 IP 默认开启：被否，可能跟用户预期不一致（如海外华人）

**Implementation**:
- `packages/cli/src/onboard/detect-region.ts` 实现检测
- prompt 用 `prompts` 包

---

## ADR-0007 · Voice mode 范围

**Status**: Accepted

**Context**: Voice Wake / Talk Mode 是 surface=voice 还是单独 mode？模型选型？

**Decision**: **macOS Live Caption MVP，仅 macOS**。
- surface 注册为 `voice-macos-livecaption`，作为 SurfaceChannel 的一种
- 不做 Whisper 跨平台版（不打包模型、不增加 onboard 体积）
- 文档明确写 "Linux / Windows voice support: not planned for Phase 2"

**Consequences**:
- ✅ S4 scope 缩小，加快 v0.1 npm publish
- ✅ macOS 用户能体验真·语音交互
- ❌ Linux / Windows 用户没有 voice
- ❌ 锁定 Apple 平台 API 学习成本

**Alternatives considered**:
- Phase 2 不做 voice：被否，量化场景"开盘前用语音问问 agent"是真需求
- Whisper local：被否，模型 ~1GB，违反 "60 秒安装" 原则

**Implementation**:
- `backend/app/channels/surface_voice_macos.py` 用 `pyobjc` 调 macOS Speech Recognition / Live Caption framework
- TTS 用 macOS `say` 命令兜底

---

## 决策追踪

| ADR | 一句话 | 影响 Sprint | 状态 |
|---|---|---|---|
| 0001 | brew/apt 装 Python（不让 uv 自带） | S1 onboard | Accepted |
| 0002 | npm 单发，主包 `harness-trading` + scope `@harness-trading/*` | S1 publish | Accepted |
| 0003 | broker plugin v0.x 仅 Python | S2 channels | Accepted |
| 0004 | workflow v0.1 支持并行 stage（`parallel:` + `join:`） | S3 workflows | Accepted |
| 0005 | 一次性 long-lived token，不 rotate | S1 auth + S4 web | Accepted |
| 0006 | uv 镜像可选 + 中国区自动提示 | S1 onboard | Accepted |
| 0007 | Voice 仅 macOS Live Caption MVP | S4 surface | Accepted |
