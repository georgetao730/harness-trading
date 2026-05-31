'use client';

import { getHarnessConfig, getHarnessStatus } from '@/lib/api';
import type { HarnessConfig, HarnessValidatorRule } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Ban,
  Gauge,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SafetyEvent {
  time: string;
  type: 'info' | 'warning' | 'danger';
  message: string;
}

export function SafetyCenterPage() {
  const [activeSection, setActiveSection] = useState<'rules' | 'controls' | 'logs'>('rules');
  const [config, setConfig] = useState<HarnessConfig | null>(null);
  const [circuitTriggered, setCircuitTriggered] = useState(false);
  const [eventLogs, setEventLogs] = useState<SafetyEvent[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const resp = await fetch('/api/harness/events');
      const data = await resp.json();
      setEventLogs(data.events || []);
    } catch {
      // keep existing logs
    }
  }, []);

  useEffect(() => {
    Promise.all([getHarnessConfig(), getHarnessStatus()])
      .then(([cfg, status]) => {
        setConfig(cfg);
        setCircuitTriggered(status.circuit_breaker.triggered);
      })
      .catch(() => {
        // Use defaults
      });
    fetchEvents();
  }, [fetchEvents]);

  const validatorRules = config?.validator_rules || [];
  const riskControls = config?.risk_controls || [];
  const enabledRules = validatorRules.filter((r) => r.enabled).length;
  const enabledControls = riskControls.filter((r) => r.enabled).length;

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* 顶部状态概览 */}
      <div className="grid grid-cols-4 gap-3">
        <SafetyStatCard
          label="安全评分"
          value={
            config ? `${Math.round((enabledRules / 5) * 80 + (circuitTriggered ? 0 : 20))}` : '92'
          }
          subtext={circuitTriggered ? '熔断中' : '优秀'}
          color={circuitTriggered ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}
          icon={ShieldCheck}
        />
        <SafetyStatCard
          label="校验链"
          value={`${enabledRules}/5`}
          subtext={enabledRules === 5 ? '全部通过' : '部分启用'}
          color="text-[var(--color-success)]"
          icon={Gauge}
        />
        <SafetyStatCard
          label="熔断器"
          value={circuitTriggered ? '已触发' : '正常'}
          subtext={circuitTriggered ? '需要手动重置' : '未触发'}
          color={circuitTriggered ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}
          icon={Shield}
        />
        <SafetyStatCard
          label="风控参数"
          value={`${enabledControls}/4`}
          subtext="项启用"
          color="text-[var(--color-text-muted)]"
          icon={Ban}
        />
      </div>

      {/* 标签栏 */}
      <div className="flex gap-1 bg-[var(--color-surface)] rounded-xl p-1 border border-[var(--color-border)]">
        {[
          { id: 'rules', label: '校验规则' },
          { id: 'controls', label: '风控参数' },
          { id: 'logs', label: '安全日志' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as typeof activeSection)}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
              activeSection === tab.id
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 校验规则列表 */}
      {activeSection === 'rules' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold">Validator Chain 配置</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              所有交易订单必须按顺序通过以下校验
            </p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {(validatorRules.length > 0
              ? validatorRules
              : ([
                  {
                    id: 'price_check',
                    name: '价格校验',
                    description: '订单价格偏离市价超过阈值时拦截',
                    enabled: true,
                    value: '3%',
                    type: 'select' as const,
                    options: ['1%', '2%', '3%', '5%', '10%'],
                  },
                  {
                    id: 'qty_check',
                    name: '数量校验',
                    description: '单笔数量超过持仓上限时拦截',
                    enabled: true,
                    value: '10000股',
                    type: 'number' as const,
                  },
                  {
                    id: 'market_order',
                    name: '禁止市价单',
                    description: '不允许提交市价单，强制限价单',
                    enabled: true,
                    value: '启用',
                    type: 'toggle' as const,
                  },
                  {
                    id: 'time_check',
                    name: '交易时间校验',
                    description: '非交易时段自动拦截所有订单',
                    enabled: true,
                    value: '启用',
                    type: 'toggle' as const,
                  },
                  {
                    id: 'freq_limit',
                    name: '频率限制',
                    description: '限制短时间内下单次数',
                    enabled: true,
                    value: '5笔/30分钟',
                    type: 'select' as const,
                    options: ['3笔/30分钟', '5笔/30分钟', '10笔/30分钟'],
                  },
                ] as HarnessValidatorRule[])
            ).map((rule: HarnessValidatorRule, i: number) => (
              <div
                key={rule.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-hover)]/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] w-4">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium">{rule.name}</p>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-medium',
                          rule.enabled
                            ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                            : 'bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]',
                        )}
                      >
                        {rule.enabled ? '启用' : '禁用'}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {rule.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {rule.type === 'select' && rule.options && (
                    <select
                      className="bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1 text-[10px] text-[var(--color-text-secondary)] outline-none"
                      defaultValue={rule.value}
                    >
                      {rule.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                  {rule.type === 'toggle' && (
                    <button
                      className={cn(
                        'p-0.5 rounded transition-colors',
                        rule.enabled
                          ? 'text-[var(--color-success)]'
                          : 'text-[var(--color-text-muted)]',
                      )}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  {rule.type === 'number' && (
                    <input
                      className="w-20 bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1 text-[10px] text-right text-[var(--color-text-secondary)] outline-none"
                      defaultValue={rule.value}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 风控参数 */}
      {activeSection === 'controls' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold">Risk Controller 参数</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              全局风控参数，触发将自动熔断
            </p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {(riskControls.length > 0
              ? riskControls
              : ([
                  {
                    id: 'daily_loss',
                    name: '单日亏损上限',
                    description: '触及后自动熔断，当日禁止交易',
                    enabled: true,
                    value: '5%',
                    type: 'select' as const,
                    options: ['2%', '3%', '5%', '8%', '10%'],
                  },
                  {
                    id: 'position_limit',
                    name: '持仓集中度',
                    description: '单只股票最大持仓占比',
                    enabled: true,
                    value: '30%',
                    type: 'select' as const,
                    options: ['20%', '25%', '30%', '40%'],
                  },
                  {
                    id: 'single_amount',
                    name: '单笔金额上限',
                    description: '单笔交易最大金额',
                    enabled: true,
                    value: '100,000',
                    type: 'number' as const,
                  },
                  {
                    id: 'max_leverage',
                    name: '最大杠杆',
                    description: '融资融券最大杠杆倍数',
                    enabled: false,
                    value: '1x',
                    type: 'select' as const,
                    options: ['1x', '1.5x', '2x'],
                  },
                ] as HarnessValidatorRule[])
            ).map((rule: HarnessValidatorRule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-hover)]/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <AlertTriangle
                    className={cn(
                      'w-4 h-4',
                      rule.enabled
                        ? 'text-[var(--color-warning)]'
                        : 'text-[var(--color-text-muted)]',
                    )}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium">{rule.name}</p>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {rule.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {rule.type === 'select' && rule.options && (
                    <select
                      className="bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1 text-[10px] text-[var(--color-text-secondary)] outline-none"
                      defaultValue={rule.value}
                    >
                      {rule.options.map((opt: string) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                  {rule.type === 'number' && (
                    <input
                      className="w-20 bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1 text-[10px] text-right text-[var(--color-text-secondary)] outline-none"
                      defaultValue={rule.value}
                    />
                  )}
                  <button
                    className={cn(
                      'p-0.5 rounded transition-colors',
                      rule.enabled
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-text-muted)]',
                    )}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-5 h-5" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 安全日志 */}
      {activeSection === 'logs' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-semibold">安全日志</h3>
            <button
              onClick={fetchEvents}
              className="p-1 rounded hover:bg-[var(--color-surface-hover)] transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-3 h-3 text-[var(--color-text-muted)]" />
            </button>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {eventLogs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-[var(--color-text-muted)]">
                <ShieldCheck className="w-6 h-6 mb-1 opacity-30" />
                <p className="text-xs">暂无安全事件</p>
                <p className="text-[10px] opacity-60 mt-0.5">系统运行正常或后端未连接</p>
              </div>
            ) : (
              eventLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                      log.type === 'danger' && 'bg-[var(--color-danger)]',
                      log.type === 'warning' && 'bg-[var(--color-warning)]',
                      (log.type === 'info') && 'bg-[var(--color-primary)]',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-text-primary)]">{log.message}</p>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                    {log.time}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SafetyStatCard({
  label,
  value,
  subtext,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtext: string;
  color: string;
  icon: React.ElementType;
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
      <p className={cn('text-[10px] mt-1', color)}>{subtext}</p>
    </div>
  );
}
