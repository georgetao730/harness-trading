'use client';

import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, ArrowUpDown, Radio, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ChannelInfo {
  type: string;
  name: string;
  status: string;
  details: string;
}

interface ChannelsData {
  feeds: Record<string, string>;
  alerts: Record<string, string>;
  brokers: Record<string, string>;
}

export function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChannels = () => {
    setLoading(true);
    fetch('/api/agent/channels')
      .then((r) => r.json())
      .then((data) => setChannels(data))
      .catch(() => setChannels(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchChannels(); }, []);

  const feedList: ChannelInfo[] = channels?.feeds
    ? Object.entries(channels.feeds).map(([k, v]) => ({
        type: 'feed', name: k, status: 'active', details: v,
      }))
    : [];
  const alertList: ChannelInfo[] = channels?.alerts
    ? Object.entries(channels.alerts).map(([k, v]) => ({
        type: 'alert', name: k, status: 'active', details: v,
      }))
    : [];
  const brokerList: ChannelInfo[] = channels?.brokers
    ? Object.entries(channels.brokers).map(([k, v]) => ({
        type: 'broker', name: k, status: 'active', details: v,
      }))
    : [];

  const sectionIcon = (type: string) => {
    switch (type) {
      case 'feed': return <Radio className="w-4 h-4 text-blue-400" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'broker': return <ArrowUpDown className="w-4 h-4 text-green-400" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const sectionTitle = (type: string) => {
    switch (type) {
      case 'feed': return '行情源';
      case 'alert': return '告警通道';
      case 'broker': return '券商通道';
      default: return type;
    }
  };

  const renderSection = (title: string, icon: React.ReactNode, items: ChannelInfo[]) => (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-semibold">{title}</h3>
        <span className="text-[10px] text-[var(--color-text-muted)]">{items.length} 个</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[10px] text-[var(--color-text-muted)]">暂无已激活的通道</p>
      ) : (
        <div className="space-y-2">
          {items.map((ch) => (
            <div
              key={`${ch.type}-${ch.name}`}
              className="flex items-center justify-between p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              <div className="flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-[var(--color-success)]" />
                <span className="text-[11px] font-medium">{ch.name}</span>
              </div>
              <span className="text-[9px] text-[var(--color-text-muted)] max-w-[200px] truncate">
                {ch.details}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">通道管理</h2>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            行情源、告警和券商通道的状态与配置
          </p>
        </div>
        <button
          onClick={fetchChannels}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {/* 通道面板 */}
      <div className="flex-1 overflow-auto space-y-4">
        {renderSection('行情源 (Feeds)', sectionIcon('feed'), feedList)}
        {renderSection('告警通道 (Alerts)', sectionIcon('alert'), alertList)}
        {renderSection('券商通道 (Brokers)', sectionIcon('broker'), brokerList)}
      </div>
    </div>
  );
}
