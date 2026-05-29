'use client';

import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface WorkflowInfo {
  name: string;
  display_name: string;
  description: string;
}

interface StageResult {
  id: string;
  title: string;
  status: string;
  error: string | null;
}

interface RunResult {
  workflow: string;
  status: string;
  stages: StageResult[];
}

export function WorkflowPage() {
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = () => {
    setLoading(true);
    fetch('/api/agent/workflows')
      .then((r) => r.json())
      .then((data) => {
        const items: WorkflowInfo[] = Object.entries(data).map(([name, displayName]) => ({
          name,
          display_name: displayName as string,
          description: '',
        }));
        setWorkflows(items);
        if (items.length > 0 && !selectedWorkflow) setSelectedWorkflow(items[0]);
      })
      .catch(() => setWorkflows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWorkflows(); }, []);

  const runWorkflow = async () => {
    if (!selectedWorkflow || running) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/agent/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: selectedWorkflow.name,
          inputs: { idea: '手动触发', symbols: '600519.SH' },
        }),
      });
      const data = await res.json();
      setRunResult(data);
    } catch (e: any) {
      setRunResult({ workflow: selectedWorkflow.name, status: 'failed', stages: [] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="h-full flex gap-4">
      {/* 左侧：工作流列表 */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">工作流</h2>
          <button
            onClick={fetchWorkflows}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            刷新
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-[10px] text-[var(--color-text-muted)] p-3">加载中...</p>
          ) : workflows.length === 0 ? (
            <p className="text-[10px] text-[var(--color-text-muted)] p-3">暂无工作流</p>
          ) : (
            workflows.map((wf) => (
              <button
                key={wf.name}
                onClick={() => { setSelectedWorkflow(wf); setRunResult(null); }}
                className={cn(
                  'w-full text-left rounded-xl border p-3 transition-all',
                  selectedWorkflow?.name === wf.name
                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/20',
                )}
              >
                <h3 className="text-xs font-semibold">{wf.display_name}</h3>
                <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{wf.name}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 右侧：工作流详情 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {selectedWorkflow && (
          <>
            {/* 头部操作栏 */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div>
                <h2 className="text-sm font-semibold">{selectedWorkflow.display_name}</h2>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {selectedWorkflow.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runWorkflow}
                  disabled={running}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors',
                    running
                      ? 'bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)] cursor-not-allowed'
                      : 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/25',
                  )}
                >
                  {running ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> 运行中</>
                  ) : (
                    <><Play className="w-3 h-3" /> 运行工作流</>
                  )}
                </button>
              </div>
            </div>

            {/* 运行结果 */}
            <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 overflow-auto">
              {runResult ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">执行结果</span>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium',
                        runResult.status === 'ok'
                          ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                          : 'bg-red-500/15 text-red-400',
                      )}
                    >
                      {runResult.status === 'ok' ? '成功' : '失败'}
                    </span>
                  </div>
                  {runResult.stages.length > 0 ? (
                    <div className="space-y-2">
                      {runResult.stages.map((stage) => (
                        <div
                          key={stage.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]"
                        >
                          {stage.status === 'ok' ? (
                            <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
                          ) : stage.status === 'failed' ? (
                            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium">{stage.title}</p>
                            {stage.error && (
                              <p className="text-[10px] text-red-400 truncate">{stage.error}</p>
                            )}
                          </div>
                          <span
                            className={cn(
                              'text-[9px] px-1.5 py-0.5 rounded',
                              stage.status === 'ok' && 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
                              stage.status === 'failed' && 'bg-red-500/10 text-red-400',
                              stage.status === 'skipped' && 'bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]',
                            )}
                          >
                            {stage.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {running ? '正在执行...' : '暂无阶段数据'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                  <Play className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-[11px]">点击"运行工作流"执行</p>
                  <p className="text-[9px] mt-1">执行结果将显示在此处</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
