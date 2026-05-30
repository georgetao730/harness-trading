'use client';

import { deleteJournal, getJournal, getJournalStats, updateJournal } from '@/lib/api';
import type { JournalEntry, JournalStats } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  Calendar,
  Check,
  Edit3,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(3);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([getJournal(filter || undefined), getJournalStats()])
      .then(([data, statsData]) => {
        setEntries(data.entries || []);
        setStats(statsData);
      })
      .catch(() => {
        setEntries([]);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReview = async (journalId: string) => {
    await updateJournal(journalId, { review: reviewText, rating: reviewRating });
    setEditingId(null);
    setReviewText('');
    setReviewRating(3);
    fetchData();
  };

  const handleDelete = async (journalId: string) => {
    if (!confirm('确定删除这条交易记录？')) return;
    await deleteJournal(journalId);
    fetchData();
  };

  const openEdit = (entry: JournalEntry) => {
    setEditingId(entry.journal_id);
    setReviewText(entry.review || '');
    setReviewRating(entry.rating || 3);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('zh-CN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatPnL = (pnl: number | null) => {
    if (pnl === null || pnl === undefined) return '—';
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}${pnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header + Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">交易日志</h2>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            完整的交易生命周期记录与复盘
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <StatCard label="总交易" value={`${stats.total_trades}`} icon={<BarChart3 className="w-3 h-3" />} />
          <StatCard
            label="胜率"
            value={`${stats.win_rate}%`}
            icon={<Check className="w-3 h-3" />}
            accent={stats.win_rate >= 50}
          />
          <StatCard
            label="总盈亏"
            value={formatPnL(stats.total_pnl)}
            icon={stats.total_pnl >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            accent={stats.total_pnl >= 0}
          />
          <StatCard label="最佳" value={formatPnL(stats.best_trade)} icon={<TrendingUp className="w-3 h-3" />} accent />
          <StatCard label="最差" value={formatPnL(stats.worst_trade)} icon={<TrendingDown className="w-3 h-3" />} accent={false} />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {['', 'open', 'closed'].map((f) => (
          <button
            key={f || 'all'}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 rounded text-[10px] font-medium transition-colors',
              filter === f
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]',
            )}
          >
            {f === '' ? '全部' : f === 'open' ? '持仓中' : '已平仓'}
          </button>
        ))}
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-auto space-y-2">
        {entries.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--color-text-muted)]">
            <BookOpen className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[11px]">暂无交易记录</p>
            <p className="text-[10px] mt-1">下单后会自动创建交易日志</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.journal_id}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                entry.status === 'open'
                  ? 'border-yellow-500/30 bg-yellow-500/5'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]',
              )}
            >
              {/* Top row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold',
                      entry.direction === 'long'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400',
                    )}
                  >
                    {entry.direction === 'long' ? '做多' : '做空'}
                  </span>
                  <span className="text-[12px] font-semibold">{entry.symbol}</span>
                  {entry.name && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">{entry.name}</span>
                  )}
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px]',
                      entry.status === 'open'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]',
                    )}
                  >
                    {entry.status === 'open' ? '持仓中' : '已平仓'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {entry.rating && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            'w-2.5 h-2.5',
                            i < (entry.rating || 0)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-[var(--color-border)]',
                          )}
                        />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => openEdit(entry)}
                    className="p-1 rounded hover:bg-[var(--color-bg)] text-[var(--color-text-muted)]"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.journal_id)}
                    className="p-1 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Details row */}
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <div>
                  <span className="text-[var(--color-text-muted)]">入场</span>
                  <div className="font-mono font-medium">
                    {entry.entry_price ? entry.entry_price.toFixed(2) : '—'}
                    {entry.entry_quantity && (
                      <span className="text-[var(--color-text-muted)] ml-1">×{entry.entry_quantity}</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">出场</span>
                  <div className="font-mono font-medium">
                    {entry.exit_price ? entry.exit_price.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">盈亏</span>
                  <div
                    className={cn(
                      'font-mono font-semibold',
                      (entry.pnl || 0) >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
                    )}
                  >
                    {entry.pnl !== null ? `${entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(0)}` : '—'}
                    {entry.pnl_pct !== null && (
                      <span className="text-[9px] ml-0.5">
                        ({entry.pnl_pct >= 0 ? '+' : ''}{entry.pnl_pct.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    日期
                  </span>
                  <div className="font-mono">{formatDate(entry.entry_date)}</div>
                </div>
              </div>

              {/* Entry/Exit reasons */}
              {(entry.entry_reason || entry.exit_reason) && (
                <div className="mt-2 flex gap-4 text-[10px]">
                  {entry.entry_reason && (
                    <div className="flex-1">
                      <span className="text-[var(--color-text-muted)]">入场理由：</span>
                      {entry.entry_reason}
                    </div>
                  )}
                  {entry.exit_reason && (
                    <div className="flex-1">
                      <span className="text-[var(--color-text-muted)]">出场理由：</span>
                      {entry.exit_reason}
                    </div>
                  )}
                </div>
              )}

              {/* Review */}
              {entry.review && (
                <div className="mt-2 p-2 rounded bg-[var(--color-bg)] text-[10px] text-[var(--color-text-muted)]">
                  💡 复盘：{entry.review}
                </div>
              )}

              {/* Inline edit */}
              {editingId === entry.journal_id && (
                <div className="mt-2 p-3 rounded-lg border border-[var(--color-accent)] bg-[var(--color-bg)] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)]">评分</span>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setReviewRating(s)}
                        className="p-0.5"
                      >
                        <Star
                          className={cn(
                            'w-3.5 h-3.5',
                            s <= reviewRating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-[var(--color-border)]',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="复盘笔记：学到了什么？哪里可以改进？"
                    rows={3}
                    className="w-full px-2 py-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] outline-none resize-none focus:border-[var(--color-accent)]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(entry.journal_id)}
                      className="px-3 py-1 rounded bg-[var(--color-accent)] text-white text-[10px] flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> 保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> 取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-center">
      <div className="text-[9px] text-[var(--color-text-muted)] flex items-center justify-center gap-1 mb-0.5">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'text-[11px] font-mono font-bold',
          accent === true && 'text-[var(--color-success)]',
          accent === false && 'text-[var(--color-danger)]',
        )}
      >
        {value}
      </div>
    </div>
  );
}
