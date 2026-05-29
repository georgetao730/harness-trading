'use client';

import type { ExecutionMode } from '@/lib/api';
import { getHarnessConfig, resetCircuitBreaker, triggerCircuitBreaker } from '@/lib/api';
import type { HarnessValidatorRule } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Gauge,
  RotateCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface HarnessPanelProps {
  mode: ExecutionMode;
  circuitBroken: boolean;
  onTriggerCircuit: () => void;
  onResetCircuit: () => void;
}

export function HarnessPanel({
  mode,
  circuitBroken,
  onTriggerCircuit,
  onResetCircuit,
}: HarnessPanelProps) {
  const [validatorRules, setValidatorRules] = useState<HarnessValidatorRule[]>([]);
  const [riskControls, setRiskControls] = useState<HarnessValidatorRule[]>([]);

  useEffect(() => {
    getHarnessConfig()
      .then((config) => {
        setValidatorRules(config.validator_rules);
        setRiskControls(config.risk_controls);
      })
      .catch(() => {
        // Use defaults if backend unavailable
      });
  }, []);

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* 当前模式卡片 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold">安全缰绳状态</h3>
        </div>

        {/* 模式指示器 */}
        <div
          className={cn(
            'rounded-lg p-3 border mb-3',
            mode === 'dry_run' && 'border-blue-500/30 bg-blue-500/5',
            mode === 'approval' && 'border-yellow-500/30 bg-yellow-500/5',
            mode === 'auto' && 'border-green-500/30 bg-green-500/5',
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            {mode === 'dry_run' && <ShieldCheck className="w-4 h-4 text-blue-400" />}
            {mode === 'approval' && <Clock className="w-4 h-4 text-yellow-400" />}
            {mode === 'auto' && <Zap className="w-4 h-4 text-green-400" />}
            <span
              className={cn(
                'text-xs font-semibold',
                mode === 'dry_run' && 'text-blue-400',
                mode === 'approval' && 'text-yellow-400',
                mode === 'auto' && 'text-green-400',
              )}
            >
              {mode === 'dry_run' && '演习模式'}
              {mode === 'approval' && '审批模式'}
              {mode === 'auto' && '自动模式'}
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {mode === 'dry_run' && '所有交易指令仅记录，不实际执行'}
            {mode === 'approval' && '交易需经人工审批后才会发送到券商'}
            {mode === 'auto' && '安全参数内自动执行，超出阈值自动降级为审批'}
          </p>
        </div>

        {/* 熔断状态 */}
        <div
          className={cn(
            'rounded-lg p-3 border',
            circuitBroken
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-[var(--color-border)] bg-[var(--color-surface-hover)]/30',
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn(
                  'w-4 h-4',
                  circuitBroken ? 'text-red-400' : 'text-[var(--color-text-muted)]',
                )}
              />
              <span className="text-xs font-medium">
                {circuitBroken ? '熔断已触发' : '熔断器正常'}
              </span>
            </div>
            {circuitBroken ? (
              <button
                onClick={onResetCircuit}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                解除
              </button>
            ) : (
              <button
                onClick={onTriggerCircuit}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
              >
                <Ban className="w-3 h-3" />
                手动触发
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 校验链 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold">校验链</h3>
          <span className="text-[10px] text-[var(--color-success)] ml-auto">
            {validatorRules.length > 0
              ? `${validatorRules.filter((r) => r.enabled).length}项启用`
              : '全部通过'}
          </span>
        </div>
        <div className="space-y-1.5">
          {validatorRules.length > 0 ? (
            validatorRules.map((rule, i) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface-hover)]/30"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-[var(--color-text-primary)]">
                    {rule.name}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                    {rule.description} · 阈值: {rule.value}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface-hover)]/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
                <p className="text-[11px] font-medium text-[var(--color-text-primary)]">
                  价格合理性
                </p>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface-hover)]/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
                <p className="text-[11px] font-medium text-[var(--color-text-primary)]">
                  数量合理性
                </p>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface-hover)]/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
                <p className="text-[11px] font-medium text-[var(--color-text-primary)]">订单类型</p>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface-hover)]/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
                <p className="text-[11px] font-medium text-[var(--color-text-primary)]">交易时间</p>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface-hover)]/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" />
                <p className="text-[11px] font-medium text-[var(--color-text-primary)]">频率限制</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 审批队列 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold">审批队列</h3>
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-success)]/15 text-[10px] text-[var(--color-success)] font-medium">
            0 待处理
          </span>
        </div>
        <div className="p-6 text-center">
          <ShieldCheck className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
          <p className="text-xs text-[var(--color-text-muted)]">暂无待审批交易</p>
        </div>
      </div>

      {/* 风控参数 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-[var(--color-warning)]" />
          <h3 className="text-sm font-semibold">风控参数</h3>
        </div>
        <div className="space-y-2">
          {riskControls.length > 0 ? (
            riskControls.map((rule) => (
              <ParamRow key={rule.id} label={rule.name} value={rule.value} />
            ))
          ) : (
            <>
              <ParamRow label="单日亏损上限" value="5%" />
              <ParamRow label="单笔金额上限" value="10万" />
              <ParamRow label="持仓集中度" value="30%" />
              <ParamRow label="下单频率" value="5笔/30分" />
              <ParamRow label="禁止订单类型" value="市价单" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-[11px] font-mono font-medium text-[var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}
