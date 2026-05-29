'use client';

const API_BASE = '/api';

// ==================== Types ====================

export type ExecutionMode = 'dry_run' | 'approval' | 'auto';

export interface ThinkingStep {
  type: 'skill' | 'reasoning' | 'risk';
  title: string;
  detail: string;
}

export interface ChatResponse {
  content: string;
  thinking_steps: ThinkingStep[];
  model: string;
  provider: string;
}

export interface ValidationResult {
  check: string;
  status: string;
  message: string;
}

export interface OrderApproval {
  approved: boolean;
  mode: ExecutionMode;
  final_action: string;
  validation_results: ValidationResult[];
  risk_warnings: string[];
}

export interface OrderResponse {
  status: string;
  order_id?: string;
  approval: OrderApproval;
  message?: string;
}

export interface PortfolioPosition {
  symbol: string;
  shares: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

export interface PortfolioSummary {
  cash: number;
  positions_value: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  position_count: number;
  trade_count: number;
}

export interface PortfolioResponse {
  summary: PortfolioSummary;
  positions: PortfolioPosition[];
}

export interface PaperOrder {
  id: string;
  symbol: string;
  action: string;
  price: number;
  quantity: number;
  status: string;
  filled_price: number | null;
  reason: string;
  created_at: string;
}

export interface OrdersResponse {
  orders: PaperOrder[];
}

export interface HarnessStatus {
  mode: ExecutionMode;
  circuit_breaker: {
    triggered: boolean;
    reason: string;
    trigger_time: number;
  };
}

export interface HarnessValidatorRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  value: string;
  type: 'toggle' | 'number' | 'select';
  options?: string[];
}

export interface HarnessConfig {
  mode: ExecutionMode;
  validator_rules: HarnessValidatorRule[];
  risk_controls: HarnessValidatorRule[];
  circuit_breaker: {
    triggered: boolean;
    reason: string;
    cooldown_minutes: number;
    auto_reset: boolean;
  };
}

// ---- Market Data ----

export interface MarketIndex {
  name: string;
  code: string;
  price: number;
  change_pct: number;
  volume: number;
}

export interface IndicesResponse {
  indices: MarketIndex[];
}

export interface QuoteResponse {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  market: string;
  error?: string;
}

export interface KlineBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KlineResponse {
  symbol: string;
  period: string;
  data: KlineBar[];
}

export interface SkillInfo {
  name: string;
  description: string;
}

export interface SkillsResponse {
  skills: SkillInfo[];
}

// ==================== API Functions ====================

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---- Health ----
export async function healthCheck() {
  return request<{ status: string; app: string; env: string }>('/health');
}

// ---- Agent ----
export async function agentChat(message: string, taskType = 'chat'): Promise<ChatResponse> {
  return request<ChatResponse>('/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ message, task_type: taskType }),
  });
}

export async function getAgentMode(): Promise<{ mode: ExecutionMode }> {
  return request<{ mode: ExecutionMode }>('/agent/mode');
}

export async function setAgentMode(mode: ExecutionMode): Promise<{ mode: ExecutionMode }> {
  return request<{ mode: ExecutionMode }>('/agent/mode', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function getSkills(): Promise<SkillsResponse> {
  return request<SkillsResponse>('/agent/skills');
}

// ---- Trading ----
export async function placeOrder(data: {
  symbol: string;
  action: string;
  price: number;
  quantity: number;
  order_type?: string;
  reason?: string;
}): Promise<OrderResponse> {
  return request<OrderResponse>('/trading/order', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPortfolio(): Promise<PortfolioResponse> {
  return request<PortfolioResponse>('/trading/portfolio');
}

export async function getOrders(): Promise<OrdersResponse> {
  return request<OrdersResponse>('/trading/orders');
}

// ---- Harness ----

export async function getHarnessStatus(): Promise<HarnessStatus> {
  return request<HarnessStatus>('/harness/status');
}

export async function setHarnessMode(mode: ExecutionMode): Promise<{ mode: ExecutionMode }> {
  return request<{ mode: ExecutionMode }>('/harness/mode', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function triggerCircuitBreaker(
  reason = 'Manual trigger',
): Promise<{ status: string; reason: string }> {
  return request<{ status: string; reason: string }>(
    `/harness/circuit-breaker/trigger?reason=${encodeURIComponent(reason)}`,
    { method: 'POST' },
  );
}

export async function resetCircuitBreaker(): Promise<{ status: string }> {
  return request<{ status: string }>('/harness/circuit-breaker/reset', {
    method: 'POST',
  });
}

export async function getHarnessConfig(): Promise<HarnessConfig> {
  return request<HarnessConfig>('/harness/config');
}

// ---- Market Data ----

export async function getMarketIndices(): Promise<IndicesResponse> {
  return request<IndicesResponse>('/trading/market/indices');
}

export async function getStockQuote(symbol: string): Promise<QuoteResponse> {
  return request<QuoteResponse>(`/trading/market/quote?symbol=${encodeURIComponent(symbol)}`);
}

export async function getKline(
  symbol: string,
  period = 'daily',
  count = 30,
): Promise<KlineResponse> {
  return request<KlineResponse>(
    `/trading/market/kline?symbol=${encodeURIComponent(symbol)}&period=${period}&count=${count}`,
  );
}
