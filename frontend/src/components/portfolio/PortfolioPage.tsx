'use client';

import { getOrders, getPortfolio } from '@/lib/api';
import type { PaperOrder, PortfolioPosition, PortfolioSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  DollarSign,
  Download,
  Filter,
  PieChart,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export function PortfolioPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [portfolioData, ordersData] = await Promise.all([getPortfolio(), getOrders()]);
      setSummary(portfolioData.summary);
      setPositions(portfolioData.positions);
      setOrders(ordersData.orders);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalValue = summary?.total_value || 0;
  const totalPnl = summary?.total_pnl || 0;
  const totalPnlPct = summary?.total_pnl_pct || 0;

  const pieData = positions.map((p) => ({
    name: p.symbol,
    value: p.market_value,
  }));

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {loading && (
        <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)] text-sm">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          加载中...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 text-sm text-[var(--color-danger)]">
          后端服务未连接。请确保后端已启动：
          <code className="ml-2 px-2 py-0.5 rounded bg-[var(--color-surface-hover)] text-xs">
            cd backend && uvicorn app.main:app --reload --port 8000
          </code>
          <button
            onClick={fetchData}
            className="ml-3 px-2 py-0.5 rounded bg-[var(--color-danger)]/20 text-xs font-medium hover:bg-[var(--color-danger)]/30"
          >
            重试
          </button>
        </div>
      )}

      {/* 顶部概览 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="总资产"
          value={summary ? `¥${(totalValue / 10000).toFixed(2)}万` : '--'}
          change={totalPnlPct}
          icon={DollarSign}
          color="text-[var(--color-primary)]"
        />
        <StatCard
          label="总盈亏"
          value={summary ? `¥${totalPnl.toLocaleString()}` : '--'}
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
          label="现金余额"
          value={summary ? `¥${(summary.cash / 10000).toFixed(2)}万` : '--'}
          icon={BarChart3}
          color="text-cyan-400"
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-semibold mb-3">资产概览</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={[
                { name: '初始', value: 1000000 },
                { name: '当前', value: totalValue },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" />
              <XAxis
                dataKey="name"
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
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {positions.length > 0 && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h3 className="text-sm font-semibold mb-3">持仓分布</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RePieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#14141f',
                    border: '1px solid #2a2a3d',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </RePieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {positions.map((p, i) => (
                <div key={p.symbol} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-[10px] text-[var(--color-text-muted)]">{p.symbol}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {positions.length === 0 && !loading && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center justify-center">
            <div className="text-center py-8">
              <PieChart className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-xs text-[var(--color-text-muted)]">暂无持仓</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                通过 AI 助手下达交易指令开始
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 持仓明细表 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold">持仓明细</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            </button>
          </div>
        </div>
        {positions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
                <th className="text-left px-4 py-2 font-medium">标的</th>
                <th className="text-right px-4 py-2 font-medium">持仓/成本</th>
                <th className="text-right px-4 py-2 font-medium">现价</th>
                <th className="text-right px-4 py-2 font-medium">市值</th>
                <th className="text-right px-4 py-2 font-medium">盈亏</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {positions.map((p) => (
                <tr
                  key={p.symbol}
                  className="hover:bg-[var(--color-surface-hover)]/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center">
                        <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">
                          {p.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <p className="text-xs font-medium">{p.symbol}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs">{p.shares} 股</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      成本 ¥{p.avg_cost.toFixed(2)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs">¥{p.current_price.toFixed(2)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs font-medium">¥{(p.market_value / 10000).toFixed(2)}万</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p
                      className={cn(
                        'text-xs font-medium',
                        p.unrealized_pnl >= 0
                          ? 'text-[var(--color-success)]'
                          : 'text-[var(--color-danger)]',
                      )}
                    >
                      {p.unrealized_pnl >= 0 ? '+' : ''}¥{p.unrealized_pnl.toFixed(2)}
                    </p>
                    <p
                      className={cn(
                        'text-[10px]',
                        p.unrealized_pnl_pct >= 0
                          ? 'text-[var(--color-success)]'
                          : 'text-[var(--color-danger)]',
                      )}
                    >
                      {p.unrealized_pnl_pct >= 0 ? '+' : ''}
                      {p.unrealized_pnl_pct.toFixed(2)}%
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">暂无持仓数据</div>
        )}
      </div>

      {/* 交易记录 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold">最近交易</h3>
        </div>
        {orders.length > 0 ? (
          <div className="divide-y divide-[var(--color-border)]">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--color-surface-hover)]/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-medium',
                      o.action === 'buy'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-red-500/15 text-red-400',
                    )}
                  >
                    {o.action === 'buy' ? '买入' : '卖出'}
                  </span>
                  <div>
                    <p className="text-xs font-medium">{o.symbol}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{o.reason || '--'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      ¥{o.price} x {o.quantity}
                    </p>
                    <p className="text-xs font-medium">
                      ¥{(o.price * o.quantity).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-medium',
                      o.status === 'filled' &&
                        'bg-[var(--color-success)]/15 text-[var(--color-success)]',
                      o.status === 'pending' &&
                        'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
                      o.status === 'rejected' &&
                        'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
                    )}
                  >
                    {o.status === 'filled'
                      ? '已成交'
                      : o.status === 'pending'
                        ? '待处理'
                        : '已拒绝'}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] w-40">
                    {new Date(o.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">暂无交易记录</div>
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
      <p className="text-lg font-bold">{value}</p>
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
