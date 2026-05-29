---
name: backtest
display_name: 回测工作流
description: >
  对策略进行历史数据回测，产出收益率曲线、最大回撤、夏普比率等核心指标报告。
gate: user_confirm
stages:
  - id: data_prep
    title: 准备历史数据
    skill: market-scan
  - id: run_backtest
    title: 执行回测
    skill: technical-analysis
  - id: report
    title: 生成回测报告
    gate: user_confirm
    skill: technical-analysis
inputs:
  - name: strategy_name
    label: 策略名称
    type: text
    required: true
  - name: symbols
    label: 回测标的
    type: text
    required: true
  - name: start_date
    label: 开始日期
    type: date
    required: true
  - name: end_date
    label: 结束日期
    type: date
    default: today
  - name: initial_capital
    label: 初始资金
    type: number
    default: 1000000
---
# 回测工作流

对已定义的策略执行历史回测。

## 流程

1. **准备历史数据**: 拉取指定时间段的行情数据
2. **执行回测**: 按策略规则逐日模拟交易
3. **生成回测报告**: 产出收益率曲线、最大回撤、夏普比率、胜率等核心指标，人工确认
