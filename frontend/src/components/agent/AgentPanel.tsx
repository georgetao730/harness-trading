"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Bot,
  Send,
  Brain,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { getMarketIndices, getPortfolio, getHarnessStatus } from "@/lib/api";
import type { MarketIndex, PortfolioSummary, HarnessStatus } from "@/lib/api";

export function AgentPanel() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [harnessStatus, setHarnessStatus] = useState<HarnessStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [indicesRes, portfolioRes, statusRes] = await Promise.all([
        getMarketIndices(),
        getPortfolio(),
        getHarnessStatus(),
      ]);
      setIndices(indicesRes.indices);
      setSummary(portfolioRes.summary);
      setHarnessStatus(statusRes);
    } catch {
      // Backend may not be available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const marketUp = indices.filter((i) => i.change_pct >= 0).length;
  const marketBias =
    indices.length > 0
      ? marketUp >= indices.length * 0.6
        ? "偏多"
        : marketUp <= indices.length * 0.4
          ? "偏空"
          : "震荡"
      : "未知";

  return (
    <div className="h-full flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)]/15 flex items-center justify-center">
            <Bot className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI 交易助手</h3>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {loading ? "加载中..." : `市场情绪: ${marketBias}`}
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] transition-colors"
          title="刷新"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-[var(--color-text-muted)]", loading && "animate-spin")} />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 指数概览 */}
        {indices.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider px-1">市场指数</p>
            <div className="space-y-0.5">
              {indices.map((idx) => (
                <div
                  key={idx.code}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-hover)]/50"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className={cn(
                        "w-3.5 h-3.5",
                        idx.change_pct >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                      )}
                    />
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">{idx.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-[var(--color-text-primary)] tabular-nums">
                      {idx.price.toFixed(0)}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] tabular-nums",
                        idx.change_pct >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                      )}
                    >
                      {idx.change_pct >= 0 ? "+" : ""}
                      {idx.change_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 账户速览 */}
        {summary && (
          <div className="space-y-1">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider px-1">模拟账户</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]/50">
                <p className="text-[10px] text-[var(--color-text-muted)]">总资产</p>
                <p className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                  ¥{(summary.total_value / 10000).toFixed(2)}万
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]/50">
                <p className="text-[10px] text-[var(--color-text-muted)]">总盈亏</p>
                <p
                  className={cn(
                    "text-sm font-mono font-bold",
                    summary.total_pnl >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                  )}
                >
                  {summary.total_pnl >= 0 ? "+" : ""}¥{summary.total_pnl.toLocaleString()}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]/50">
                <p className="text-[10px] text-[var(--color-text-muted)]">持仓数</p>
                <p className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                  {summary.position_count} 只
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[var(--color-surface-hover)]/50">
                <p className="text-[10px] text-[var(--color-text-muted)]">可用资金</p>
                <p className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                  ¥{(summary.cash / 10000).toFixed(2)}万
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 安全状态 */}
        {harnessStatus && (
          <div className="space-y-1">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider px-1">安全护栏</p>
            <div className="p-2.5 rounded-lg bg-[var(--color-surface-hover)]/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-success)]" />
                  <span className="text-[11px] text-[var(--color-text-secondary)]">执行模式</span>
                </div>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    harnessStatus.mode === "dry_run"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : harnessStatus.mode === "auto"
                        ? "bg-green-500/10 text-green-400"
                        : harnessStatus.mode === "manual"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-red-500/10 text-red-400"
                  )}
                >
                  {harnessStatus.mode === "dry_run"
                    ? "演练"
                    : harnessStatus.mode === "auto"
                      ? "自动"
                      : harnessStatus.mode === "manual"
                        ? "手动"
                        : "熔断"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-text-secondary)]">熔断器</span>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    harnessStatus.circuit_breaker_triggered
                      ? "text-[var(--color-danger)]"
                      : "text-[var(--color-success)]"
                  )}
                >
                  {harnessStatus.circuit_breaker_triggered ? "已触发" : "正常"}
                </span>
              </div>
            </div>
          </div>
        )}

        {loading && !summary && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-[var(--color-text-muted)] animate-spin" />
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <p className="text-[10px] text-[var(--color-text-muted)] text-center">
          点击"Agent Chat"进行 AI 交易对话
        </p>
      </div>
    </div>
  );
}
