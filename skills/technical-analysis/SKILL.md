---
name: technical-analysis
description: 技术指标计算：MACD、RSI、布林带、均线系统（MA）。基于 K 线数据纯计算，无副作用。
category: technical
risk_class: read_only
when_to_use:
  - 用户问"这只票走势怎么看 / 找突破均线"
  - 需要判断金叉/死叉信号
  - workflow=strategy-spec 阶段需要给策略加技术指标过滤
when_to_skip:
  - 单纯查实时价格 → 走 market-scan
  - 基本面分析 → 不在范围
inputs:
  - symbol: string  required
  - indicator: string  default=all  enum=[macd,rsi,bollinger,ma,all]
outputs:
  - indicator_values: dict
  - signals: list （如 golden_cross / death_cross）
side_effects: []
mode: sync
estimated_latency_ms: 2000
llm_friendly_summary: |
  从 market-scan 拉取K线，计算 MACD/RSI/布林带/均线。返回指标值 + 金叉死叉信号。
---
# Skill: Technical Analysis

基于 K 线数据计算技术指标。先通过 market-scan 拉取 K 线，再计算。

## Usage

```
{ "symbol": "600519", "indicator": "all" }
{ "symbol": "600519", "indicator": "macd" }
{ "symbol": "600519", "indicator": "rsi" }
```

## Indicators

| indicator | 输出 |
|-----------|------|
| macd | DIF / DEA / histogram / signal (golden_cross\|death_cross\|bullish\|bearish) |
| rsi | rsi6 / rsi14 / rsi24 |
| bollinger | upper / middle / lower / position |
| ma | ma5 / ma10 / ma20 / ma60 / trend |
| all | 以上全部 |
