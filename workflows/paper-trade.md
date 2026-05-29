---
name: paper-trade
display_name: 模拟盘工作流
description: >
  在模拟环境中执行策略，记录每日持仓和净值变化，验证策略实盘可行性。
gate: user_confirm
stages:
  - id: setup
    title: 初始化模拟账户
    skill: market-scan
  - id: daily_signal
    title: 每日信号生成
    skill: technical-analysis
  - id: execute
    title: 执行模拟交易
    skill: technical-analysis
    gate: user_confirm
  - id: reconcile
    title: 日终对账
    skill: market-scan
inputs:
  - name: strategy_name
    label: 策略名称
    type: text
    required: true
  - name: symbols
    label: 交易标的
    type: text
    required: true
  - name: duration_days
    label: 模拟天数
    type: number
    default: 30
  - name: initial_capital
    label: 初始资金
    type: number
    default: 1000000
---
# 模拟盘工作流

在模拟环境中运行策略，验证实盘可行性。

## 流程

1. **初始化模拟账户**: 设置初始资金和标的池
2. **每日信号生成**: 根据策略规则生成当日交易信号
3. **执行模拟交易**: 人工确认后提交模拟订单
4. **日终对账**: 更新持仓和净值
