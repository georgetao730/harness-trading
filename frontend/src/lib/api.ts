'use client';

import {
  DEMO_CHANNELS,
  DEMO_CLOSED_TRADES,
  DEMO_CRYPTO_PRICES,
  DEMO_HARNESS_CONFIG,
  DEMO_HARNESS_STATUS,
  DEMO_INDICES,
  DEMO_KNOWLEDGE,
  DEMO_PORTFOLIO_SUMMARY,
  DEMO_POSITIONS,
  DEMO_ROLES,
  DEMO_SAFETY_EVENTS,
  DEMO_SKILLS,
} from './demo-data';

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
  name: string;
  description: string;
  category?: string;
  enabled?: boolean;
}

export interface SkillsDetailResponse {
  skills: SkillInfo[];
  categories: { id: string; label: string }[];
}

// ==================== API Functions ====================

let _backendOnline = true;
export function isBackendOnline(): boolean {
  return _backendOnline;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  _backendOnline = true;
  return res.json();
}

/** Try real API, fall back to demo data on error. */
async function requestOrDemo<T>(url: string, demo: T, options?: RequestInit): Promise<T> {
  try {
    const result = await request<T>(url, options);
    return result;
  } catch {
    _backendOnline = false;
    return demo;
  }
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

export async function getSkills(): Promise<SkillsDetailResponse> {
  return request<SkillsDetailResponse>('/agent/skills');
}

export async function getSkillsDetail(): Promise<SkillsDetailResponse> {
  return requestOrDemo<SkillsDetailResponse>('/agent/skills/detail', DEMO_SKILLS);
}

export interface SkillSourceResponse {
  name: string;
  source: string;
  file: string;
}

export interface SkillCreateResponse {
  status: string;
  name: string;
  file: string;
  code: string;
  message?: string;
}

export async function createSkill(description: string): Promise<SkillCreateResponse> {
  return request<SkillCreateResponse>('/agent/skills/create', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}

export async function getSkillSource(name: string): Promise<SkillSourceResponse> {
  return request<SkillSourceResponse>(`/agent/skills/${encodeURIComponent(name)}/source`);
}

export async function updateSkillSource(name: string, source: string): Promise<{ status: string; name: string }> {
  return request<{ status: string; name: string }>(`/agent/skills/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify({ source }),
  });
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
  return requestOrDemo<PortfolioResponse>('/trading/portfolio', {
    summary: DEMO_PORTFOLIO_SUMMARY,
    positions: DEMO_POSITIONS,
  });
}

export async function getOrders(): Promise<OrdersResponse> {
  return requestOrDemo<OrdersResponse>('/trading/orders', {
    orders: DEMO_CLOSED_TRADES,
  });
}

export interface TradingStats {
  cash: number;
  positions_value: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  position_count: number;
  trade_count: number;
  win_rate: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  daily_pnl: { date: string; pnl: number; trades: number }[];
  initial_cash: number;
}

export async function getTradingStats(): Promise<TradingStats> {
  return request<TradingStats>('/trading/stats');
}

// ---- Harness ----

export async function getHarnessStatus(): Promise<HarnessStatus> {
  return requestOrDemo<HarnessStatus>('/harness/status', DEMO_HARNESS_STATUS);
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
  return requestOrDemo<HarnessConfig>('/harness/config', DEMO_HARNESS_CONFIG as any);
}

// ---- Market Data ----

export async function getMarketIndices(): Promise<IndicesResponse> {
  return requestOrDemo<IndicesResponse>('/trading/market/indices', { indices: DEMO_INDICES });
}

export async function getStockQuote(symbol: string): Promise<QuoteResponse> {
  return request<QuoteResponse>(`/trading/market/quote?symbol=${encodeURIComponent(symbol)}`);
}

// ---- Knowledge Base ----

export interface KnowledgeDoc {
  id: string;
  title: string;
  snippet?: string;
  tags: string[];
  category: string;
  status: string;
  score?: number;
  source?: string;
}

export interface KnowledgeDetail extends KnowledgeDoc {
  content: string;
}

export interface KnowledgeSearchResponse {
  query: string;
  results: KnowledgeDoc[];
}

export interface KnowledgeListResponse {
  entries: KnowledgeDoc[];
}

export interface KnowledgeStats {
  total: number;
  promoted: number;
  candidates: number;
  tags: number;
  categories: number;
}

export async function searchKnowledge(q: string, topK = 10): Promise<KnowledgeSearchResponse> {
  return request<KnowledgeSearchResponse>(
    `/agent/knowledge/search?q=${encodeURIComponent(q)}&top_k=${topK}`,
  );
}

export async function getKnowledgeStats(): Promise<KnowledgeStats> {
  return requestOrDemo<KnowledgeStats>(
    '/agent/knowledge/stats',
    { total: 4, promoted: 4, candidates: 0, tags: 6, categories: 3 } as KnowledgeStats,
  );
}

export async function getKnowledgeCandidates(): Promise<{ candidates: KnowledgeDoc[] }> {
  return requestOrDemo<{ candidates: KnowledgeDoc[] }>(
    '/agent/knowledge/candidates',
    { candidates: DEMO_KNOWLEDGE.candidates },
  );
}

export async function promoteKnowledge(id: string): Promise<{ id: string; promoted: boolean }> {
  return request<{ id: string; promoted: boolean }>('/agent/knowledge/promote', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function listKnowledge(): Promise<KnowledgeListResponse> {
  return requestOrDemo<KnowledgeListResponse>('/agent/knowledge/list', {
    entries: DEMO_KNOWLEDGE.entries,
  });
}

export async function getKnowledgeDetail(id: string): Promise<KnowledgeDetail> {
  return request<KnowledgeDetail>(`/agent/knowledge/${encodeURIComponent(id)}`);
}

export async function createKnowledge(data: {
  title: string;
  content: string;
  tags?: string[];
  category?: string;
  source?: string;
}): Promise<{ id: string; created: boolean }> {
  return request<{ id: string; created: boolean }>('/agent/knowledge/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledge(id: string): Promise<{ id: string; deleted: boolean }> {
  return request<{ id: string; deleted: boolean }>(`/agent/knowledge/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ---- Providers ----

export interface ProviderInfo {
  id: string;
  provider: string;
  model: string;
  enabled: boolean;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  routing: Record<string, string>;
}

export async function getProviders(): Promise<ProvidersResponse> {
  return request<ProvidersResponse>('/agent/providers');
}

// ---- Channels ----

export interface ChannelTypeInfo {
  label: string;
  desc: string;
  fields: string[];
}

export interface ChannelTypesResponse {
  types: {
    feeds: Record<string, ChannelTypeInfo>;
    alerts: Record<string, ChannelTypeInfo>;
    brokers: Record<string, ChannelTypeInfo>;
  };
}

export interface ChannelConfigEntry {
  enabled?: boolean;
  webhook_url?: string;
  initial_cash?: number;
  poll_interval?: number;
}

export interface ChannelConfigResponse {
  config: {
    feeds: Record<string, ChannelConfigEntry>;
    alerts: Record<string, ChannelConfigEntry>;
    brokers: Record<string, ChannelConfigEntry>;
  };
}

export async function getChannelTypes(): Promise<ChannelTypesResponse> {
  return request<ChannelTypesResponse>('/agent/channels/types');
}

export async function getChannelsConfig(): Promise<ChannelConfigResponse> {
  return request<ChannelConfigResponse>('/agent/channels/config');
}

export async function updateChannelConfig(
  section: string,
  name: string,
  settings: Record<string, unknown>,
): Promise<{ status: string; section: string; name: string }> {
  return request<{ status: string; section: string; name: string }>(
    '/agent/channels/config',
    { method: 'PUT', body: JSON.stringify({ section, name, settings }) },
  );
}

export async function testChannel(type: string, name: string) {
  return request<{ status: string; channel?: string }>('/agent/channels/test', {
    method: 'POST',
    body: JSON.stringify({ type, name }),
  });
}

// ---- Agent Roles ----

export interface AgentRoleInfo {
  name: string;
  display_name: string;
  description: string;
  allowed_skills: string[];
  allowed_channels: string[];
  safety: string[];
}

export interface AgentRolesResponse {
  roles: AgentRoleInfo[];
}

export async function getAgentRoles(): Promise<AgentRolesResponse> {
  return requestOrDemo<AgentRolesResponse>('/agent/roles', DEMO_ROLES as any);
}

export async function setAgentRole(role: string): Promise<{ role: string }> {
  return request<{ role: string }>('/agent/role', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

// ---- Watchlist ----

export interface WatchlistQuote {
  price: number;
  change_pct: number;
  change: number;
  name: string;
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  name: string;
  note: string | null;
  sort_order: number;
  created_at: string | null;
  quote: WatchlistQuote | null;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
  count: number;
}

export async function getWatchlist(): Promise<WatchlistResponse> {
  return request<WatchlistResponse>('/watchlist');
}

export async function addToWatchlist(symbol: string, name?: string, note?: string) {
  return request<{ status: string; symbol: string; id?: number; message?: string }>(
    '/watchlist',
    { method: 'POST', body: JSON.stringify({ symbol, name, note }) },
  );
}

export async function removeFromWatchlist(symbol: string) {
  return request<{ status: string; symbol: string }>(`/watchlist/${encodeURIComponent(symbol)}`, {
    method: 'DELETE',
  });
}

// ---- Trade Journal ----

export interface JournalEntry {
  id: number;
  journal_id: string;
  symbol: string;
  name: string | null;
  direction: string;
  entry_date: string | null;
  entry_price: number | null;
  entry_quantity: number | null;
  entry_reason: string | null;
  exit_date: string | null;
  exit_price: number | null;
  exit_reason: string | null;
  pnl: number | null;
  pnl_pct: number | null;
  status: string;
  review: string | null;
  rating: number | null;
  tags: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface JournalListResponse {
  entries: JournalEntry[];
  count: number;
}

export interface JournalStats {
  total_trades: number;
  open_positions: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  total_pnl: number;
  avg_pnl: number;
  avg_rating: number;
  best_trade: number;
  worst_trade: number;
}

export async function getJournal(status?: string, limit = 50): Promise<JournalListResponse> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', String(limit));
  return request<JournalListResponse>(`/journal?${params.toString()}`);
}

export async function updateJournal(
  journalId: string,
  data: {
    exit_price?: number;
    exit_reason?: string;
    review?: string;
    rating?: number;
    tags?: string;
  },
): Promise<JournalEntry> {
  return request<JournalEntry>(`/journal/${journalId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteJournal(journalId: string) {
  return request<{ status: string }>(`/journal/${journalId}`, { method: 'DELETE' });
}

export async function getJournalStats(): Promise<JournalStats> {
  return request<JournalStats>('/journal/stats');
}

// ==================== Crypto / Binance API ====================

export interface CryptoQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  high: number;
  low: number;
  volume: number;
  quote_volume: number;
}

export async function getCryptoPrices(symbols?: string): Promise<{ quotes: CryptoQuote[]; count: number }> {
  return requestOrDemo<{ quotes: CryptoQuote[]; count: number }>(
    symbols ? `/trading/crypto/prices?symbols=${symbols}` : '/trading/crypto/prices',
    { quotes: DEMO_CRYPTO_PRICES, count: DEMO_CRYPTO_PRICES.length },
  );
}
