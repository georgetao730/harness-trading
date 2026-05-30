'use client';

import { cn } from '@/lib/utils';
import {
  BarChart3,
  BookOpen,
  Bot,
  Eye,
  LayoutDashboard,
  NotebookPen,
  Radio,
  Settings,
  Shield,
  Wand2,
  Workflow,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'watchlist', label: '自选股', icon: Eye },
  { id: 'agent', label: 'AI 对话', icon: Bot },
  { id: 'workflows', label: '工作流', icon: Workflow },
  { id: 'channels', label: '通道管理', icon: Radio },
  { id: 'skills', label: 'Skills 管理', icon: Wand2 },
  { id: 'portfolio', label: '持仓管理', icon: BarChart3 },
  { id: 'journal', label: '交易日志', icon: NotebookPen },
  { id: 'harness', label: '安全中心', icon: Shield },
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'settings', label: '系统设置', icon: Settings },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-56 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-sm">Harness Trading</span>
      </div>

      {/* 导航 */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
              activeTab === item.id
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* 底部状态 */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
          系统运行中
        </div>
      </div>
    </aside>
  );
}
