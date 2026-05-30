'use client';

import { cn } from '@/lib/utils';
import {
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RotateCw,
  Save,
  Shield,
  Wifi,
  WifiOff,
  Zap,
  Settings,
  AlertCircle,
  RefreshCw,
  Bell,
  BellOff,
  Clock,
  Radio,
  TrendingDown,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import {
  getHarnessConfig,
  getHarnessStatus,
  setHarnessMode,
  getProviders,
  HarnessConfig,
  HarnessValidatorRule,
  ProviderInfo,
  ExecutionMode,
} from '@/lib/api';

const categoryLabels: Record<string, string> = {
  primary: '主推理',
  secondary: '辅助',
  vision: '多模态',
  local: '本地',
  long_context: '长上下文',
};

const categoryColors: Record<string, string> = {
  primary: 'bg-purple-500/15 text-purple-400',
  secondary: 'bg-blue-500/15 text-blue-400',
  vision: 'bg-green-500/15 text-green-400',
  local: 'bg-yellow-500/15 text-yellow-400',
  long_context: 'bg-cyan-500/15 text-cyan-400',
};

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<'providers' | 'harness' | 'notifications' | 'general'>('providers');
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [harnessConfig, setHarnessConfig] = useState<HarnessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [provResp, hc] = await Promise.all([
        getProviders().catch(() => ({ providers: [], routing: {} })),
        getHarnessConfig().catch(() => null),
      ]);
      setProviders(provResp.providers);
      if (hc) setHarnessConfig(hc);
    } catch {
      setError('无法加载配置，请检查后端服务是否运行');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleRule = (ruleId: string, section: 'validator_rules' | 'risk_controls') => {
    if (!harnessConfig) return;
    const rules = harnessConfig[section].map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r,
    );
    setHarnessConfig({ ...harnessConfig, [section]: rules });
  };

  const handleModeChange = async (mode: ExecutionMode) => {
    try {
      await setHarnessMode(mode);
      if (harnessConfig) setHarnessConfig({ ...harnessConfig, mode });
    } catch {
      setError('切换模式失败');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">系统设置</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          </button>
          <button
            onClick={() => setSaving(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[10px] font-medium hover:bg-[var(--color-primary)]/25 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            保存配置
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* 标签切换 */}
      <div className="flex gap-1 bg-[var(--color-surface)] rounded-xl p-1 border border-[var(--color-border)] w-fit">
        {[
          { id: 'providers', label: '模型厂商' },
          { id: 'harness', label: '安全策略' },
          { id: 'notifications', label: '通知设置' },
          { id: 'general', label: '通用设置' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as typeof activeSection)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
              activeSection === tab.id
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 模型厂商 */}
      {activeSection === 'providers' && (
        <div className="space-y-3">
          {providers.length === 0 && (
            <div className="text-center py-8 text-[var(--color-text-muted)] text-xs">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              暂未配置模型厂商，请在 config/providers.yaml 中配置
            </div>
          )}
          {providers.map((p) => (
            <div
              key={p.id}
              className={cn(
                'rounded-xl border transition-all',
                p.enabled
                  ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
                  : 'border-[var(--color-border)]/50 bg-[var(--color-surface)]/50 opacity-70',
              )}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold">{p.provider}</h4>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{p.model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.enabled ? (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                      <Wifi className="w-3 h-3" /> 已启用
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                      <WifiOff className="w-3 h-3" /> 未启用
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 安全策略 - 来自 harness config */}
      {activeSection === 'harness' && harnessConfig && (
        <div className="space-y-4">
          {/* 执行模式 */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h3 className="text-xs font-semibold mb-3">执行模式</h3>
            <div className="flex gap-2">
              {(['dry_run', 'approval', 'auto'] as ExecutionMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-medium transition-all',
                    harnessConfig.mode === m
                      ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-transparent',
                  )}
                >
                  {m === 'dry_run' ? '演习模式' : m === 'approval' ? '审批模式' : '自动模式'}
                </button>
              ))}
            </div>
          </div>

          {/* 熔断器状态 */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h3 className="text-xs font-semibold mb-2">熔断器</h3>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  harnessConfig.circuit_breaker.triggered ? 'bg-red-500' : 'bg-green-500',
                )}
              />
              <span className="text-xs">
                {harnessConfig.circuit_breaker.triggered ? '已触发' : '正常'}
              </span>
              {harnessConfig.circuit_breaker.triggered && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  · 原因: {harnessConfig.circuit_breaker.reason}
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              冷却时间: {harnessConfig.circuit_breaker.cooldown_minutes} 分钟
              {harnessConfig.circuit_breaker.auto_reset ? ' · 自动重置' : ' · 手动重置'}
            </div>
          </div>

          {/* 校验规则 */}
          <RuleSection
            title="交易校验规则"
            rules={harnessConfig.validator_rules}
            onToggle={(id) => handleToggleRule(id, 'validator_rules')}
          />

          {/* 风险控制 */}
          <RuleSection
            title="风险控制"
            rules={harnessConfig.risk_controls}
            onToggle={(id) => handleToggleRule(id, 'risk_controls')}
          />
        </div>
      )}

      {/* 通知设置 */}
      {activeSection === 'notifications' && (
        <div className="space-y-4">
          {/* 定时推送说明 */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[var(--color-accent)]" />
              <h3 className="text-xs font-semibold">定时推送</h3>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mb-4">
              系统内置的定时任务会自动向所有告警通道推送消息。以下为当前配置：
            </p>

            <div className="space-y-3">
              {/* Morning briefing */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium">开盘简报</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      每个交易日 9:25 · 盘前市场概览 + 持仓快照
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                  <CheckCircle2 className="w-3 h-3" /> 已启用
                </span>
              </div>

              {/* Closing summary */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium">收盘总结</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      每个交易日 15:05 · 市场总结 + 今日交易统计
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                  <CheckCircle2 className="w-3 h-3" /> 已启用
                </span>
              </div>

              {/* Watchdog */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium">持仓风险监控</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      交易时段每30分钟 · 回撤超过3%时推送预警
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                  <CheckCircle2 className="w-3 h-3" /> 已启用
                </span>
              </div>
            </div>
          </div>

          {/* 告警通道状态 */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-[var(--color-accent)]" />
              <h3 className="text-xs font-semibold">告警通道</h3>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mb-4">
              定时推送和风险预警会通过以下通道发送通知。通道配置在 config/channels.yaml。
            </p>

            <div className="divide-y divide-[var(--color-border)]">
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                  <span className="text-[11px]">日志输出</span>
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)]">loguru console</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                  <span className="text-[11px]">事件总线</span>
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)]">EventBus broadcast</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />
                  <span className="text-[11px]">Webhook（待配置）</span>
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)]">企业微信/钉钉/飞书</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15">
              <p className="text-[10px] text-[var(--color-text-muted)]">
                💡 提示：如需添加企业微信/钉钉/飞书等 Webhook 通知，请在
                <code className="mx-1 px-1 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-accent)] text-[9px]">config/channels.yaml</code>
                中配置 alert 通道。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 通用设置 */}
      {activeSection === 'general' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">系统语言</label>
            <select className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs outline-none">
              <option>简体中文</option>
              <option>English</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">默认交易模式</label>
            <select className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs outline-none">
              <option>演习模式 (推荐)</option>
              <option>审批模式</option>
              <option>自动模式</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleSection({
  title,
  rules,
  onToggle,
}: {
  title: string;
  rules: HarnessValidatorRule[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-xs font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-hover)]/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-medium">{rule.name}</h4>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px]',
                    rule.enabled
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]',
                  )}
                >
                  {rule.enabled ? '已启用' : '已停用'}
                </span>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{rule.description}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[10px] text-[var(--color-text-secondary)]">{rule.value}</span>
              <button
                onClick={() => onToggle(rule.id)}
                className={cn(
                  'w-8 h-5 rounded-full transition-colors relative',
                  rule.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]/30',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                    rule.enabled ? 'left-3.5' : 'left-0.5',
                  )}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
