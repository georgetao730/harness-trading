'use client';

import { getCryptoKline, getCryptoPrices, getKline, getMarketIndices, getPortfolio } from '@/lib/api';
import type { CryptoQuote, KlineBar, MarketIndex, PortfolioPosition, PortfolioSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Activity,
  BarChart3,
  Bitcoin,
  DollarSign,
  LineChart,
  PieChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CandlestickChart } from './CandlestickChart';

export function MarketOverview() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [klineData, setKlineData] = useState<KlineBar[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState('上证指数');
  const [chartType, setChartType] = useState<'area' | 'candle'>('candle');
  const [marketType, setMarketType] = useState<'stock' | 'crypto'>('stock');

  // Crypto state
  const [cryptoPrices, setCryptoPrices] = useState<CryptoQuote[]>([]);
  const [cryptoKline, setCryptoKline] = useState<KlineBar[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState('BTCUSDT');

  const fetchData = useCallback(async () => {
    try {
      const [indicesRes, klineRes, portfolioRes, cryptoRes] = await Promise.all([
        getMarketIndices(),
        getKline('000001.SH', 'daily', 30),
        getPortfolio(),
        getCryptoPrices(),
      ]);
      setIndices(indicesRes.indices);
      setKlineData(klineRes.data);
      setSummary(portfolioRes.summary);
      setPositions(portfolioRes.positions);
      setCryptoPrices(cryptoRes.quotes);
    } catch {
      // Backend may not be available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const switchIndex = async (name: string) => {
    setSelectedIndex(name);
    const idx = indices.find((i) => i.name === name);
    if (idx) {
      try {
        const kline = await getKline(idx.code, 'daily', 30);
        setKlineData(kline.data);
      } catch {}
    }
  };

  const switchMarket = async (type: 'stock' | 'crypto') => {
    setMarketType(type);
    if (type === 'crypto') {
      try {
        const kline = await getCryptoKline(selectedCrypto, '1d', 60);
        setCryptoKline(kline.data);
      } catch {}
    }
  };

  const switchCrypto = async (symbol: string) => {
    setSelectedCrypto(symbol);
    try {
      const kline = await getCryptoKline(symbol, '1d', 60);
      setCryptoKline(kline.data);
    } catch {}
  };

  const chartData = klineData.map((bar) => ({
    date: bar.date.slice(5), // "MM-DD"
    price: bar.close,
  }));

  const totalValue = summary?.total_value || 0;
  const totalPnl = summary?.total_pnl || 0;
  const totalPnlPct = summary?.total_pnl_pct || 0;

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* 资产概览卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="总资产"
          value={`¥${(totalValue / 10000).toFixed(2)}万`}
          change={totalPnlPct}
          icon={DollarSign}
          color="text-[var(--color-primary)]"
        />
        <StatCard
          label="总盈亏"
          value={`¥${totalPnl.toLocaleString()}`}
          change={totalPnlPct}
          icon={TrendingUp}
          color={totalPnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}
        />
        <StatCard
          label="持仓数量"
          value={summary ? summary.position_count.toString() : '0'}
          subtext="只标的"
          icon={PieChart}
          color="text-purple-400"
        />
        <StatCard
          label="风控状态"
          value="正常"
          subtext={loading ? '加载中...' : '实时监控'}
          icon={Activity}
          color="text-[var(--color-success)]"
        />
      </div>

      {/* 市场类型切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => switchMarket('stock')}
          className={cn(
            'px-3 py-1.5 text-xs rounded-lg border transition-all flex items-center gap-1.5',
            marketType === 'stock'
              ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          A股
        </button>
        <button
          onClick={() => switchMarket('crypto')}
          className={cn(
            'px-3 py-1.5 text-xs rounded-lg border transition-all flex items-center gap-1.5',
            marketType === 'crypto'
              ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
          )}
        >
          <Bitcoin className="w-3.5 h-3.5" />
          加密货币
        </button>
      </div>

      {/* 指数行情条 */}
      {marketType === 'stock' && indices.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {indices.map((idx) => (
            <button
              key={idx.code}
              onClick={() => switchIndex(idx.name)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                selectedIndex === idx.name
                  ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/20',
              )}
            >
              <span className="font-medium">{idx.name}</span>
              <span className="tabular-nums">{idx.price.toFixed(0)}</span>
              <span
                className={cn(
                  'text-[10px] tabular-nums',
                  idx.change_pct >= 0
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-danger)]',
                )}
              >
                {idx.change_pct >= 0 ? '+' : ''}
                {idx.change_pct.toFixed(2)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 加密行情条 */}
      {marketType === 'crypto' && cryptoPrices.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cryptoPrices.map((coin) => (
            <button
              key={coin.symbol}
              onClick={() => switchCrypto(coin.symbol)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                selectedCrypto === coin.symbol
                  ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/20',
              )}
            >
              <span className="font-medium">{coin.name}</span>
              <span className="tabular-nums">
                {coin.price < 1 ? `$${coin.price.toFixed(4)}` : `$${coin.price.toFixed(0)}`}
              </span>
              <span
                className={cn(
                  'text-[10px] tabular-nums',
                  coin.change_pct >= 0
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-danger)]',
                )}
              >
                {coin.change_pct >= 0 ? '+' : ''}
                {coin.change_pct.toFixed(2)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 图表区域 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">
              {marketType === 'crypto'
                ? (cryptoPrices.find((c) => c.symbol === selectedCrypto)?.name || selectedCrypto)
                : selectedIndex}
            </h3>
            <div className="flex rounded-md bg-[var(--color-background)] border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => setChartType('area')}
                className={cn(
                  'px-2 py-1 text-[10px] flex items-center gap-1 transition-colors',
                  chartType === 'area'
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                )}
              >
                <LineChart className="w-3 h-3" />
                走势
              </button>
              <button
                onClick={() => setChartType('candle')}
                className={cn(
                  'px-2 py-1 text-[10px] flex items-center gap-1 transition-colors',
                  chartType === 'candle'
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                )}
              >
                <BarChart3 className="w-3 h-3" />
                K线
              </button>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="p-1 rounded hover:bg-[var(--color-surface-hover)] transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          </button>
        </div>
        {chartType === 'candle' ? (
          <CandlestickChart data={marketType === 'crypto' ? cryptoKline : klineData} height={400} />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#14141f',
                  border: '1px solid #2a2a3d',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#6366f1"
                strokeWidth={1.5}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
            {loading ? '加载中...' : '暂无数据'}
          </div>
        )}
      </div>

      {/* 持仓列表 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold">当前持仓</h3>
          <span className="text-[10px] text-[var(--color-text-muted)]">模拟账户</span>
        </div>
        {positions.length > 0 ? (
          <div className="divide-y divide-[var(--color-border)]">
            {positions.map((p) => (
              <div
                key={p.symbol}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-hover)]/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {p.symbol}
                    </p>
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    {p.shares} 股 · 成本 ¥{p.avg_cost.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    ¥{(p.market_value / 10000).toFixed(2)}万
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {p.unrealized_pnl_pct >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-[var(--color-success)]" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-[var(--color-danger)]" />
                    )}
                    <span
                      className={cn(
                        'text-[10px] font-medium',
                        p.unrealized_pnl_pct >= 0
                          ? 'text-[var(--color-success)]'
                          : 'text-[var(--color-danger)]',
                      )}
                    >
                      {p.unrealized_pnl_pct >= 0 ? '+' : ''}
                      {p.unrealized_pnl_pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
            {loading ? '加载中...' : '暂无持仓，通过 AI 对话下达交易指令'}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  subtext,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  change?: number;
  subtext?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </span>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <p className="text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
      {change !== undefined && (
        <p
          className={`text-[10px] font-medium mt-1 ${
            change >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}
        >
          {change >= 0 ? '+' : ''}
          {change.toFixed(2)}%
        </p>
      )}
      {subtext && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{subtext}</p>}
    </div>
  );
}
