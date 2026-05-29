"use client";

import { cn } from "@/lib/utils";
import { Shield, AlertTriangle, Bell, User } from "lucide-react";
import type { ExecutionMode } from "@/lib/api";

const modes: { id: ExecutionMode; label: string; desc: string; color: string }[] = [
  {
    id: "dry_run",
    label: "演习模式",
    desc: "AI 正常决策，不执行真实交易",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    id: "approval",
    label: "审批模式",
    desc: "交易需人工确认后执行",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  {
    id: "auto",
    label: "自动模式",
    desc: "安全参数内自动执行",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
];

interface TopBarProps {
  mode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
  circuitBroken: boolean;
  onResetCircuit: () => void;
}

export function TopBar({ mode, onModeChange, circuitBroken, onResetCircuit }: TopBarProps) {
  const currentMode = modes.find((m) => m.id === mode)!;

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
      {/* 左侧: 模式选择器 */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
          执行模式
        </span>
        <div className="flex bg-[var(--color-background)] rounded-lg p-0.5 gap-0.5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                mode === m.id
                  ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {/* 当前模式指示 */}
        <span
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-medium border",
            currentMode.color
          )}
        >
          {currentMode.desc}
        </span>
      </div>

      {/* 右侧: 状态 & 操作 */}
      <div className="flex items-center gap-4">
        {/* 熔断状态 */}
        {circuitBroken && (
          <button
            onClick={onResetCircuit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium animate-pulse hover:bg-red-500/25 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            熔断已触发 - 点击解除
          </button>
        )}

        {/* 风控状态 */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <Shield className={cn("w-3.5 h-3.5", circuitBroken ? "text-red-400" : "text-green-400")} />
          风控 {circuitBroken ? "已暂停" : "正常"}
        </div>

        {/* 通知 */}
        <button className="relative p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
          <Bell className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-danger)]" />
        </button>

        {/* 用户 */}
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
          <User className="w-4 h-4 text-[var(--color-text-secondary)]" />
        </button>
      </div>
    </header>
  );
}
