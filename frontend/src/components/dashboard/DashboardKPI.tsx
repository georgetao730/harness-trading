'use client';

import { cn } from '@/lib/utils';
import { getTradingStats, TradingStats } from '@/lib/api';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Target,
  Wallet,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'green' | 'red' | 'blue' | 'purple';
}) {
  const colorMap = {
    default: 'text-[var(--color-text-primary)]',
    green: 'text-[var(--color-success)]',
    red: 'text-[var(--color-danger)]',
    blue: 'text-[var(--color-info)]',
    purple: 'text-[var(--color-accent)]',
  };

  const bgMap = {
    default: 'bg-[var(--color-surface-hover)]/50',
    green: 'bg-[var(--color-success)]/8',
    red: 'bg-[var(--color-danger)]/8',
    blue: 'bg-[var(--color-info)]/8',
    purple: 'bg-[var(--color-accent)]/8',
  };

  const iconBgMap = {
    default: 'bg-[var(--color-surface-hover)]',
    green: 'bg-[var(--color-success)]/15',
    red: 'bg-[var(--color-danger)]/15',
    blue: 'bg-[var(--color-info)]/15',
    purple: 'bg-[var(--color-accent)]/15',
  };

  return (
    <div className={cn('rounded-xl p-3.5 border border-[var(--color-border)]', bgMap[color])}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconBgMap[color])}>
          <Icon className={cn('w-3.5 h-3.5', colorMap[color])} />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-lg font-bold font-mono tabular-nums', colorMap[color])}>{value}</span>
        {trend && trend !== 'neutral' && (
          trend === 'up'
            ? <ArrowUpRight className="w-3.5 h-3.5 text-[var(--color-success)]" />
            : <ArrowDownRight className="w-3.5 h-3.5 text-[var(--color-danger)]" />
        )}
      </div>
      {sub && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

export function DashboardKPI() {
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = () => {
      getTradingStats()
        .then(setStats)
        .catch(() => setStats(null))
        .finally(() => setLoading(false));
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl p-3.5 border border-[var(--color-border)] bg-[var(--color-surface-hover)]/20 animate-pulse">
            <div className="h-3 w-16 bg-[var(--color-border)] rounded mb-3" />
            <div className="h-6 w-24 bg-[var(--color-border)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const pnlColor = stats.total_pnl >= 0 ? 'green' : 'red';
  const pnlTrend = stats.total_pnl >= 0 ? 'up' : 'down';
  const winRateColor = stats.win_rate >= 50 ? 'green' : 'red';
  const profitFactorColor = stats.profit_factor >= 1.5 ? 'green' : (stats.profit_factor >= 1 ? 'default' : 'red');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <StatCard
        label="总资产"
        value={`¥${(stats.total_value / 10000).toFixed(2)}万`}
        sub={`现金 ¥${(stats.cash / 10000).toFixed(2)}万`}
        icon={Wallet}
        color="blue"
      />
      <StatCard
        label="总盈亏"
        value={`${stats.total_pnl >= 0 ? '+' : ''}¥${stats.total_pnl.toLocaleString()}`}
        sub={`${stats.total_pnl_pct >= 0 ? '+' : ''}${stats.total_pnl_pct}%`}
        icon={TrendingUp}
        trend={pnlTrend}
        color={pnlColor}
      />
      <StatCard
        label="胜率"
        value={`${stats.win_rate}%`}
        sub={`${stats.winning_trades}赢 ${stats.losing_trades}亏 · 共${stats.total_trades}笔`}
        icon={Target}
        color={winRateColor}
      />
      <StatCard
        label="盈亏比"
        value={stats.profit_factor >= 999 ? '∞' : stats.profit_factor.toFixed(2)}
        sub={`均盈 ¥${stats.avg_win.toLocaleString()} · 均亏 ¥${stats.avg_loss.toLocaleString()}`}
        icon={Activity}
        color={profitFactorColor}
      />
    </div>
  );
}
