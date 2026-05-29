---
name: live-trade
display_name: 实盘交易工作流
description: >
  实盘交易全流程：信号生成 → 风控审核 → 安全闸门确认 → 执行 → 事后复盘。
gate: user_confirm
stages:
  - id: signal
    title: 生成交易信号
    skill: technical-analysis
  - id: risk_check
    title: 风控审核
    gate: user_confirm
    skill: market-scan
  - id: confirm
    title: 安全闸门确认
    gate: user_confirm
    skill: market-scan
  - id: execute
    title: 执行下单
    gate: user_confirm
    skill: technical-analysis
  - id: pma
    title: 事后复盘
    skill: market-scan
inputs:
  - name: strategy_name
    label: 策略名称
    type: text
    required: true
  - name: symbol
    label: 交易标的
    type: text
    required: true
  - name: side
    label: 方向(buy/sell)
    type: select
    options:
      - buy
      - sell
    required: true
  - name: quantity
    label: 数量
    type: number
    required: true
  - name: max_loss_pct
    label: 最大亏损百分比
    type: number
    default: 2
---
# 实盘交易工作流

安全优先的实盘交易全流程。

## 流程

1. **生成交易信号**: 根据策略规则产出买卖信号
2. **风控审核**: 检查仓位上限、单笔风险敞口、停牌/涨跌停
3. **安全闸门确认**: 人工二次确认 HarnessToken 签名
4. **执行下单**: 提交订单到券商通道
5. **事后复盘**: 记录交易日志、更新净值曲线
