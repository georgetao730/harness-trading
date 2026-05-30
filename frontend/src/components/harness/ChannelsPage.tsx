'use client';

import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, ArrowUpDown, Bell, CheckCircle2, Loader2,
  Radio, RefreshCw, Send, Shield, Wifi, WifiOff, Settings2, Zap,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import {
  getChannelTypes, getChannelsConfig, updateChannelConfig, testChannel,
  ChannelTypesResponse, ChannelConfigResponse,
} from '@/lib/api';

const SECTION_ICONS: Record<string, React.ElementType> = {
  feeds: Radio,
  alerts: Bell,
  brokers: Shield,
};
const SECTION_TITLES: Record<string, string> = {
  feeds: '行情源',
  alerts: '告警通道',
  brokers: '券商通道',
};
const SECTION_DESCS: Record<string, string> = {
  feeds: '实时行情数据推送通道',
  alerts: '交易信号、风险预警、定时推送的消息通道',
  brokers: '订单执行与持仓管理通道',
};

type SectionKey = 'feeds' | 'alerts' | 'brokers';

export function ChannelsPage() {
  const [types, setTypes] = useState<ChannelTypesResponse | null>(null);
  const [config, setConfig] = useState<ChannelConfigResponse | null>(null);
  const [status, setStatus] = useState<Record<string, Record<string, { class: string; healthy?: boolean }>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editName, setEditName] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c, s] = await Promise.all([
        getChannelTypes(),
        getChannelsConfig(),
        fetch('/api/agent/channels').then(r => r.json()),
      ]);
      setTypes(t);
      setConfig(c);
      setStatus({ feeds: s.feeds || {}, alerts: s.alerts || {}, brokers: s.brokers || {} });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleEnabled = async (section: SectionKey, name: string, enabled: boolean) => {
    const key = `${section}/${name}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateChannelConfig(section, name, { enabled });
      setMsg(prev => ({ ...prev, [key]: enabled ? `${name} 已启用` : `${name} 已禁用` }));
      setTimeout(() => setMsg(prev => { const n = { ...prev }; delete n[key]; return n; }), 2000);
      loadData();
    } catch {
      setMsg(prev => ({ ...prev, [key]: '保存失败' }));
    } finally {
      setSaving(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const handleSaveWebhook = async (section: SectionKey, name: string, webhookUrl: string) => {
    const key = `${section}/${name}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateChannelConfig(section, name, { webhook_url: webhookUrl, enabled: true });
      setMsg(prev => ({ ...prev, [key]: 'Webhook 已保存' }));
      setEditSection(null);
      setEditName(null);
      setTimeout(() => setMsg(prev => { const n = { ...prev }; delete n[key]; return n; }), 2000);
      loadData();
    } catch {
      setMsg(prev => ({ ...prev, [key]: '保存失败' }));
    } finally {
      setSaving(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const handleTest = async (section: SectionKey, name: string) => {
    const key = `test-${section}/${name}`;
    setTesting(prev => ({ ...prev, [key]: true }));
    try {
      const r = await testChannel(section === 'alerts' ? 'alert' : 'feed', name);
      setMsg(prev => ({
        ...prev,
        [key]: r.status === 'sent' ? '✅ 测试发送成功' : r.status === 'not_found' ? '❌ 通道未激活，请先启用' : '❌ 发送失败',
      }));
      setTimeout(() => setMsg(prev => { const n = { ...prev }; delete n[key]; return n; }), 3000);
    } catch {
      setMsg(prev => ({ ...prev, [key]: '❌ 测试失败' }));
    } finally {
      setTesting(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  const sections: SectionKey[] = ['feeds', 'alerts', 'brokers'];

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">通道管理</h2>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            管理行情源、告警和券商通道的配置与状态
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => {
          const Icon = SECTION_ICONS[section] || Activity;
          const typeMap = types?.types[section] || {};
          const configMap = config?.config[section] || {};
          const statusMap = status[section] || {};

          return (
            <div key={section} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              {/* Section header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/30">
                <Icon className="w-4 h-4 text-[var(--color-accent)]" />
                <h3 className="text-xs font-semibold">{SECTION_TITLES[section]}</h3>
                <span className="text-[9px] text-[var(--color-text-muted)]">· {SECTION_DESCS[section]}</span>
              </div>

              {/* Channel list */}
              <div className="divide-y divide-[var(--color-border)]">
                {Object.entries(typeMap).length === 0 ? (
                  <div className="px-4 py-6 text-center text-[10px] text-[var(--color-text-muted)]">
                    暂无可用的通道类型
                  </div>
                ) : (
                  Object.entries(typeMap).map(([name, info]) => {
                    const cfg = configMap[name] || {};
                    const st = statusMap[name];
                    const isEnabled = cfg.enabled !== false;
                    const isRunning = st?.healthy !== false && st?.class;
                    const saveKey = `${section}/${name}`;
                    const testKey = `test-${section}/${name}`;
                    const isEditing = editSection === section && editName === name;

                    return (
                      <div key={name} className="px-4 py-3 hover:bg-[var(--color-bg)]/20 transition-colors">
                        <div className="flex items-center justify-between">
                          {/* Left: name + status */}
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => handleToggleEnabled(section as SectionKey, name, !isEnabled)}
                              disabled={saving[saveKey]}
                              className={cn(
                                'w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
                                isEnabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]/30',
                              )}
                            >
                              <span className={cn(
                                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                                isEnabled ? 'left-4.5' : 'left-0.5',
                              )} />
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{info.label}</span>
                                <span className="text-[9px] text-[var(--color-text-muted)]">{name}</span>
                                {isRunning && (
                                  <span className="flex items-center gap-1 text-[9px] text-[var(--color-success)]">
                                    <Wifi className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--color-text-muted)] truncate">{info.desc}</p>
                            </div>
                          </div>

                          {/* Right: actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {msg[saveKey] && (
                              <span className="text-[9px] text-[var(--color-success)]">{msg[saveKey]}</span>
                            )}
                            {msg[testKey] && (
                              <span className={cn(
                                'text-[9px]',
                                msg[testKey].startsWith('✅') ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
                              )}>
                                {msg[testKey]}
                              </span>
                            )}
                            {saving[saveKey] && <Loader2 className="w-3 h-3 animate-spin" />}

                            {/* Webhook config (alert channels) */}
                            {section === 'alerts' && isEnabled && (
                              <button
                                onClick={() => {
                                  setEditSection(section);
                                  setEditName(isEditing ? null : name);
                                }}
                                className="p-1 rounded hover:bg-[var(--color-surface-hover)]"
                                title="配置 Webhook"
                              >
                                <Settings2 className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                              </button>
                            )}

                            {/* Test button */}
                            {section === 'alerts' && isEnabled && (
                              <button
                                onClick={() => handleTest(section as SectionKey, name)}
                                disabled={testing[testKey]}
                                className="p-1 rounded hover:bg-[var(--color-surface-hover)]"
                                title="测试发送"
                              >
                                {testing[testKey] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-text-muted)]" />
                                ) : (
                                  <Send className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Webhook URL editor */}
                        {isEditing && section === 'alerts' && (
                          <div className="mt-3 p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                            <label className="text-[10px] text-[var(--color-text-muted)] block mb-1.5">
                              Webhook URL
                            </label>
                            <WebhookEditor
                              channelName={name}
                              initialUrl={cfg.webhook_url || ''}
                              onSave={(url) => handleSaveWebhook(section as SectionKey, name, url)}
                              saving={!!saving[saveKey]}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WebhookEditor({
  channelName,
  initialUrl,
  onSave,
  saving,
}: {
  channelName: string;
  initialUrl: string;
  onSave: (url: string) => void;
  saving: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);

  const placeholders: Record<string, string> = {
    dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN',
    feishu: 'https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN',
    wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY',
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={placeholders[channelName] || 'https://...'}
        className="flex-1 px-2 py-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] outline-none focus:border-[var(--color-accent)] font-mono"
      />
      <button
        onClick={() => onSave(url.trim())}
        disabled={saving || !url.trim()}
        className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-white text-[10px] hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  );
}
