---
name: strategy-spec
display_name: 策略设计工作流
description: >
  将交易想法转化为结构化策略说明文档。
  至少包含: 信号组合、标的池、仓位管理、风险预算、失效条件。
gate: user_confirm
stages:
  - id: clarify
    title: 澄清交易想法
    skill: market-scan
  - id: spec_draft
    title: 生成策略草案
    skill: technical-analysis
  - id: review
    title: 风险评审
    gate: user_confirm
    skill: technical-analysis
inputs:
  - name: idea
    label: 交易想法
    type: text
    required: true
  - name: symbols
    label: 关注的标的
    type: text
    required: true
  - name: risk_budget_pct
    label: 风险预算百分比
    type: number
    default: 5
---
# 策略设计工作流

引导 Agent 将交易想法转化为结构化策略说明文档。

## 流程

1. **澄清交易想法**: 反推信号的业务含义，补全缺失前提
2. **生成策略草案**: 给出入场/出场信号组合、标的池、仓位管理、风险预算、失效条件
3. **风险评审**: 人工确认后输出最终策略文档
