---
name: market-scan
description: 获取实时行情数据、K线数据、指数数据。覆盖A股、港股、美股。
category: market_data
risk_class: read_only
when_to_use:
  - 用户问"XX股票现在多少钱 / 走势如何"
  - 需要查看大盘指数（上证、深证、恒生、标普500）
  - 需要拉取K线数据做图表
  - workflow=strategy-spec 阶段需要标的行情快照
when_to_skip:
  - 单纯查技术指标（走 technical-analysis）
  - 基本面分析（不在范围）
inputs:
  - symbol: string  optional  股票代码（如 600519.SH），data_type=indices 时可省略
  - data_type: string  default=quote  enum=[indices,quote,kline]
  - period: string  default=daily  enum=[daily,weekly,monthly]
outputs:
  - quote/indices/kline data
  - 每个标的含 symbol / name / price / change_pct / volume
side_effects: []
mode: sync
estimated_latency_ms: 3000
llm_friendly_summary: |
  返回行情快照或K线。数据源东方财富（A股），30秒缓存。非交易时段可能返回缓存数据。
---
# Skill: Market Scan

获取股票实时行情、指数数据和K线数据。

## Usage

```
# 获取指数
{ "data_type": "indices" }

# 获取个股行情
{ "symbol": "600519", "data_type": "quote" }

# 获取K线
{ "symbol": "600519", "data_type": "kline", "period": "daily" }
```

## Errors

| code | 含义 |
|------|------|
| `NO_DATA` | 未找到该标的行情数据 |
| `FETCH_FAIL` | 上游数据源不可用 |
