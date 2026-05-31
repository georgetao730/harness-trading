'use client';

/**
 * Demo data for standalone frontend deployment (Vercel).
 * Activated automatically when the backend API is unreachable.
 */

import type { KlineBar, MarketIndex, OrderApproval, PortfolioPosition, PortfolioSummary } from './api';

// ── Market Indices ──

export const DEMO_INDICES: MarketIndex[] = [
  { name: '上证指数', code: '000001.SH', price: 3356.27, change_pct: 0.48, volume: 0 },
  { name: '深证成指', code: '399001.SZ', price: 10728.31, change_pct: -0.22, volume: 0 },
  { name: '创业板指', code: '399006.SZ', price: 2156.73, change_pct: 1.15, volume: 0 },
  { name: '科创50', code: '000688.SH', price: 985.42, change_pct: 2.03, volume: 0 },
];

// ── K-line Data (60 days for 上证指数) ──

const BASE_DATE = new Date('2026-03-01');
const BASE_PRICE = 3150;
const DEMO_KLINE_DAYS = 60;

function generateDemoKline(symbol: string): KlineBar[] {
  const bars: KlineBar[] = [];
  let price = symbol === '000001.SH' ? BASE_PRICE : symbol === '399001.SZ' ? 10200 : 2000;
  const volatility = 0.015;

  for (let i = 0; i < DEMO_KLINE_DAYS; i++) {
    const d = new Date(BASE_DATE);
    d.setDate(d.getDate() + i);

    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().slice(0, 10);
    const change = (Math.random() - 0.48) * volatility * price * 0.5;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.3;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.3;
    const volume = Math.floor(Math.random() * 50000000 + 10000000);

    bars.push({ date: dateStr, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume });
    price = close;
  }

  return bars;
}

export const DEMO_KLINE_CACHE: Record<string, KlineBar[]> = {};

export function getDemoKline(symbol: string): KlineBar[] {
  if (!DEMO_KLINE_CACHE[symbol]) {
    DEMO_KLINE_CACHE[symbol] = generateDemoKline(symbol);
  }
  return DEMO_KLINE_CACHE[symbol];
}

// ── Portfolio ──

export const DEMO_PORTFOLIO_SUMMARY: PortfolioSummary = {
  cash: 450320.50,
  positions_value: 559879.50,
  total_value: 1010200.00,
  total_pnl: 10200.00,
  total_pnl_pct: 1.02,
  position_count: 3,
  trade_count: 7,
};

export const DEMO_POSITIONS: PortfolioPosition[] = [
  { symbol: '600519.SH', shares: 100, avg_cost: 1250.00, current_price: 1325.00, market_value: 132500, unrealized_pnl: 7500, unrealized_pnl_pct: 6.00 },
  { symbol: '000858.SZ', shares: 500, avg_cost: 158.00, current_price: 162.50, market_value: 81250, unrealized_pnl: 2250, unrealized_pnl_pct: 2.85 },
  { symbol: '601318.SH', shares: 1000, avg_cost: 52.00, current_price: 53.80, market_value: 53800, unrealized_pnl: 1800, unrealized_pnl_pct: 3.46 },
];

// ── Closed Trades ──

export const DEMO_CLOSED_TRADES = [
  { id: 't-001', symbol: '600519.SH', name: '贵州茅台', action: 'sell', price: 1325.00, quantity: 100, pnl: 7500.0, date: '2026-05-25', status: 'filled', filled_price: 1325.00, reason: '目标价止盈', created_at: '2026-05-25T10:30:00Z' },
  { id: 't-002', symbol: '000858.SZ', name: '五粮液', action: 'sell', price: 162.50, quantity: 500, pnl: 2250.0, date: '2026-05-26', status: 'filled', filled_price: 162.50, reason: '技术面卖出信号', created_at: '2026-05-26T14:15:00Z' },
  { id: 't-003', symbol: '300750.SZ', name: '宁德时代', action: 'sell', price: 205.50, quantity: 300, pnl: -1350.0, date: '2026-05-27', status: 'filled', filled_price: 205.50, reason: '止损', created_at: '2026-05-27T11:00:00Z' },
  { id: 't-004', symbol: '601318.SH', name: '中国平安', action: 'sell', price: 53.80, quantity: 1000, pnl: 1800.0, date: '2026-05-28', status: 'filled', filled_price: 53.80, reason: '调仓换股', created_at: '2026-05-28T09:45:00Z' },
];

// ── Harness Config ──

export const DEMO_HARNESS_CONFIG = {
  mode: 'dry_run',
  validator_rules: [
    { id: 'price_deviation', name: '价格偏离检查', description: '下单价格偏离市场价超过阈值时拒绝', enabled: true, value: '3%', type: 'select' as const, options: ['1%', '2%', '3%', '5%'] },
    { id: 'quantity_check', name: '数量检查', description: '超大单自动拒绝', enabled: true, value: '开' as string, type: 'toggle' as const },
    { id: 'order_type', name: '订单类型限制', description: '仅限限价单，市价单直接阻挡', enabled: true, value: '限价单', type: 'select' as const, options: ['限价单', '不限'] },
    { id: 'trading_hours', name: '交易时段检查', description: '非交易时段封锁', enabled: true, value: 'A股标准', type: 'select' as const, options: ['A股标准', '24小时'] },
    { id: 'rate_limit', name: '频率限制', description: '30分钟内下单次数上限', enabled: true, value: '5', type: 'number' as const },
  ],
  risk_controls: [
    { id: 'daily_loss', name: '单日亏损上限', description: '触及后自动熔断', enabled: true, value: '5%', type: 'select' as const, options: ['2%', '3%', '5%', '8%'] },
    { id: 'position_limit', name: '持仓集中度', description: '单只股票最大持仓占比', enabled: true, value: '30%', type: 'select' as const, options: ['20%', '25%', '30%'] },
    { id: 'single_amount', name: '单笔金额上限', description: '单笔交易最大金额', enabled: true, value: '100000', type: 'number' as const },
    { id: 'max_leverage', name: '最大杠杆', description: '融资融券最大杠杆倍数', enabled: false, value: '1x', type: 'select' as const, options: ['1x', '1.5x', '2x'] },
  ],
  circuit_breaker: { triggered: false, reason: '', cooldown_minutes: 1440, auto_reset: false },
};

export const DEMO_HARNESS_STATUS = {
  mode: 'dry_run' as const,
  circuit_breaker: { triggered: false, reason: '', trigger_time: 0 },
};

// ── Channels ──

export const DEMO_CHANNELS = {
  feeds: { eastmoney: { class: 'EastMoneyFeed', healthy: true } },
  alerts: {
    dingtalk: { class: 'DingTalkAlert' },
    feishu: { class: 'FeishuAlert' },
    wecom: { class: 'WeComAlert' },
  },
  brokers: { paper: { class: 'PaperBrokerAdapter' } },
  stats: { feed_runners: { eastmoney: true } },
};

// ── Knowledge Base ──

export const DEMO_KNOWLEDGE = {
  entries: [
    { id: 'kb-001', title: 'MACD指标详解', tags: ['技术分析', 'MACD'], category: '技术指标', status: 'active', snippet: 'MACD（异同移动平均线）是最常用的趋势跟踪指标…' },
    { id: 'kb-002', title: 'K线形态识别', tags: ['K线', '形态学'], category: '技术分析', status: 'active', snippet: 'K线形态是技术分析的基石，常见的反转形态包括…' },
    { id: 'kb-003', title: '仓位管理原则', tags: ['风控', '仓位'], category: '风控', status: 'active', snippet: '科学的仓位管理是长期稳定盈利的关键…' },
    { id: 'kb-004', title: 'A股交易规则', tags: ['规则', 'A股'], category: '基础', status: 'active', snippet: 'A股实行T+1交易制度，涨跌幅限制为主板±10%…' },
  ],
  candidates: [],
  stats: { total: 4, active: 4, candidates: 0 },
};

// ── Skills ──

export const DEMO_SKILLS = {
  skills: [
    { name: 'market_data', category: 'market_data', description: '获取实时行情数据（指数、个股报价、K线）', enabled: true },
    { name: 'technical', category: 'technical', description: '技术指标计算（MACD、RSI、MA、布林带）', enabled: true },
  ],
  categories: [
    { id: 'market_data', label: '行情数据' },
    { id: 'technical', label: '技术分析' },
    { id: 'fundamental', label: '基本面' },
    { id: 'nlp', label: '自然语言' },
    { id: 'llm_reasoning', label: 'AI推理' },
    { id: 'execution', label: '交易执行' },
  ],
};

// ── Safety Events ──

export const DEMO_SAFETY_EVENTS = [
  { time: '2026-05-28 14:32', type: 'info' as const, message: '订单检查通过 — 价格偏离 2.1% (< 3%), 数量正常, 限价单, 交易时段内' },
  { time: '2026-05-28 09:45', type: 'info' as const, message: '风险控制检查通过 — 日亏损 0.15% (< 5%), 持仓集中度 13.1% (< 30%), 单笔 53,800 (< 100,000)' },
  { time: '2026-05-27 11:00', type: 'warning' as const, message: '触发止损 — 宁德时代(300750) 亏损 1,350 元 (-2.1%)，执行卖出' },
  { time: '2026-05-26 14:15', type: 'info' as const, message: '技术面卖出信号 — 五粮液(000858) MACD 死叉，止盈卖出' },
  { time: '2026-05-25 10:30', type: 'info' as const, message: '目标价止盈 — 贵州茅台(600519) 达到目标价 1325，卖出止盈' },
];

// ── Agent Roles ──

export const DEMO_ROLES = {
  roles: [
    { name: 'backtest_executor', display_name: '回测执行官', description: '负责运行回测任务，验证策略有效性', allowed_skills: ['market_data', 'technical'], allowed_channels: [], safety: { max_position_pct: 0 } },
    { name: 'strategy_designer', display_name: '策略设计师', description: '设计交易策略和信号规则', allowed_skills: ['technical', 'fundamental'], allowed_channels: [], safety: { max_position_pct: 0 } },
    { name: 'trade_operator', display_name: '交易操作员', description: '在风控约束下执行实际交易', allowed_skills: ['market_data', 'execution'], allowed_channels: ['dingtalk'], safety: { max_position_pct: 20, max_daily_trades: 5 } },
    { name: 'risk_reviewer', display_name: '风控审查官', description: '审查交易决策，发现潜在风险', allowed_skills: ['market_data'], allowed_channels: ['dingtalk', 'feishu'], safety: { max_position_pct: 0 } },
    { name: 'event_reviewer', display_name: '事件复盘官', description: '分析重大市场事件，撰写复盘报告', allowed_skills: ['market_data', 'nlp'], allowed_channels: ['feishu'], safety: { max_position_pct: 0 } },
  ],
  active: 'trade_operator',
};
