'use client';

import { addToWatchlist, getWatchlist, removeFromWatchlist } from '@/lib/api';
import type { WatchlistItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MinusCircle, Plus, RefreshCw, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addSymbol, setAddSymbol] = useState('');
  const [addName, setAddName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchWatchlist = useCallback(() => {
    setLoading(true);
    getWatchlist()
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWatchlist();
    const interval = setInterval(fetchWatchlist, 10000); // auto-refresh every 10s
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  const handleAdd = async () => {
    setAddError('');
    if (!addSymbol.trim()) {
      setAddError('请输入股票代码');
      return;
    }
    setAdding(true);
    const sym = addSymbol.trim().toUpperCase();
    try {
      const result = await addToWatchlist(sym, addName.trim() || undefined);
      if (result.status === 'duplicate') {
        setAddError(result.message || '该股票已在自选列表中');
        return;
      }
      setAddSymbol('');
      setAddName('');
      setShowAdd(false);
      fetchWatchlist();
    } catch (err: any) {
      setAddError(err?.message || '添加失败，请检查后端服务是否运行');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (symbol: string) => {
    await removeFromWatchlist(symbol);
    fetchWatchlist();
  };

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toFixed(2);
    if (p >= 100) return p.toFixed(2);
    if (p >= 10) return p.toFixed(2);
    return p.toFixed(3);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">自选股</h2>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {items.length} 只股票 · 每 10 秒自动刷新
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-[10px] hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3 h-3" />
            添加
          </button>
          <button
            onClick={fetchWatchlist}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <input
              value={addSymbol}
              onChange={(e) => { setAddSymbol(e.target.value); setAddError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="代码，如 600519.SH"
              className="flex-1 px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[11px] outline-none focus:border-[var(--color-accent)]"
            />
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="名称（可选）"
              className="w-28 px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[11px] outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding}
              className={cn(
                'px-3 py-1.5 rounded-lg text-white text-[10px] transition-opacity',
                adding ? 'bg-[var(--color-text-muted)] cursor-not-allowed' : 'bg-[var(--color-accent)] hover:opacity-90',
              )}
            >
              {adding ? '添加中...' : '确认'}
            </button>
          </div>
          {addError && (
            <p className="text-[10px] text-[var(--color-danger)] px-3">{addError}</p>
          )}
        </div>
      )}

      {/* Watchlist table */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--color-text-muted)]">
            <Star className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[11px]">还没有自选股</p>
            <p className="text-[10px] mt-1">点击"添加"开始关注股票</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const q = item.quote;
              const isUp = q && q.change_pct >= 0;
              const isDown = q && q.change_pct < 0;
              return (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => handleRemove(item.symbol)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-red-500"
                    >
                      <MinusCircle className="w-3.5 h-3.5" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold truncate">
                          {item.name || item.symbol}
                        </span>
                        <span className="text-[9px] text-[var(--color-text-muted)]">
                          {item.symbol}
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {q ? (
                      <>
                        <div className="text-right">
                          <div className="text-[13px] font-mono font-semibold tabular-nums">
                            {formatPrice(q.price)}
                          </div>
                          <div
                            className={cn(
                              'text-[10px] font-medium tabular-nums',
                              isUp && 'text-[var(--color-success)]',
                              isDown && 'text-[var(--color-danger)]',
                            )}
                          >
                            {q.change_pct >= 0 ? '+' : ''}
                            {q.change_pct.toFixed(2)}%
                          </div>
                        </div>
                        {isUp ? (
                          <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-[var(--color-danger)]" />
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-[var(--color-text-muted)]">加载中...</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
