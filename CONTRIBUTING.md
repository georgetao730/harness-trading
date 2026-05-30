# Contributing to Harness Trading

感谢你对 Harness Trading 的关注！我们欢迎任何形式的贡献。

## 行为准则

请遵循 [Contributor Covenant](https://www.contributor-covenant.org/zh-cn/version/2/1/code_of_conduct/) 行为准则。

## 如何贡献

### 报告 Bug

1. 使用 [Bug Report](https://github.com/your-org/harness-trading/issues/new?template=bug_report.md) 模板
2. 描述复现步骤、期望行为、实际行为
3. 提供环境信息（OS、Python 版本、Node 版本）

### 提出功能

1. 使用 [Feature Request](https://github.com/your-org/harness-trading/issues/new?template=feature_request.md) 模板
2. 描述使用场景和期望行为
3. 如果可能，提供实现建议

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/my-feature`
3. 遵循现有代码风格（Python: ruff；TypeScript: biome）
4. 确保测试通过：`make ci`
5. 提交 PR 到 `main` 分支

## 开发环境

```bash
# 安装依赖
make install

# 启动后端
make dev-gateway

# 启动前端
cd frontend && npm run dev -- --webpack -p 3000

# 运行测试
make test
```

## 项目结构

```
harness-trading/
├── backend/           # FastAPI 后端
│   ├── app/api/       # REST 接口
│   ├── app/agent/     # AI Agent（Skills、Roles）
│   ├── app/channels/  # 插件通道（Feeds、Alerts、Brokers）
│   ├── app/harness/   # 安全护栏
│   ├── app/knowledge/ # BM25 知识库
│   ├── app/eval/      # 评估框架
│   └── app/workflows/ # YAML 工作流引擎
├── frontend/          # Next.js 前端
│   └── src/components/
├── config/            # 全局配置
├── docs/              # 设计文档
└── packages/          # Node 包（CLI、WS Bridge）
```

## 代码风格

- **Python**：`ruff check . && ruff format .`
- **TypeScript/React**：`pnpm lint`
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

## License

MIT License。贡献即表示你同意在此许可证下授权你的代码。
