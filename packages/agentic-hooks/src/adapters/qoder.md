# Qoder Adapter — Harness Workflow as a Qoder Skill
#
# 将本文件放在项目 `.qoder/skills/harness-workflow/SKILL.md`，
# Qoder agent 即可通过 skill 调用 Harness 工作流。
#
# 用法: Qoder 会自动加载这个 skill，agent 可以通过
# /harness-workflow 或 function call 来触发工作流。

name: harness-workflow
display_name: Harness Workflow Runner
description: >
  Run a workflow in the Harness Trading system.
  Available workflows: strategy-spec, backtest, paper-trade, live-trade.
category: trading
trigger:
  manual: true
  keywords:
    - 回测
    - backtest
    - 策略
    - strategy
    - 模拟交易
    - paper trade
    - 实盘
    - live trade
tool:
  type: shell
  command: |
    python packages/agentic-hooks/src/harness_launcher.py "$WORKFLOW_NAME" --inputs '$WORKFLOW_INPUTS'
  env:
    WORKFLOW_NAME: "{{workflow}}"
    WORKFLOW_INPUTS: "{{inputs}}"

parameters:
  - name: workflow
    type: select
    description: 选择要运行的工作流
    options:
      - strategy-spec
      - backtest
      - paper-trade
      - live-trade
    required: true
  - name: inputs
    type: json
    description: 工作流输入参数 (JSON)
    required: true
