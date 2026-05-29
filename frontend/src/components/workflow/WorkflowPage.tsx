"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Play,
  Pause,
  Clock,
  BarChart3,
  Brain,
  Shield,
  FileText,
  Bot,
  Trash2,
  Copy,
  MoreHorizontal,
  ArrowRight,
  Zap,
  Calendar,
  GripVertical,
} from "lucide-react";

interface WorkflowNode {
  id: string;
  type: "market_data" | "technical" | "nlp" | "llm" | "risk" | "notify";
  label: string;
  description: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  schedule: string;
  status: "active" | "paused" | "draft";
  lastRun?: string;
  nodes: WorkflowNode[];
}

const nodeTypeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  market_data: { icon: BarChart3, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  technical: { icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30" },
  nlp: { icon: FileText, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  llm: { icon: Brain, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
  risk: { icon: Shield, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  notify: { icon: Bot, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/30" },
};

const availableNodes: WorkflowNode[] = [
  { id: "market-1", type: "market_data", label: "行情数据", description: "获取实时行情和K线数据" },
  { id: "tech-1", type: "technical", label: "技术分析", description: "计算MACD、RSI等指标" },
  { id: "nlp-1", type: "nlp", label: "舆情分析", description: "分析新闻、社交媒体情绪" },
  { id: "llm-1", type: "llm", label: "AI推理", description: "LLM综合分析生成建议" },
  { id: "risk-1", type: "risk", label: "风控校验", description: "多层级安全校验" },
  { id: "notify-1", type: "notify", label: "通知推送", description: "发送告警和通知" },
];

const workflows: Workflow[] = [
  {
    id: "wf-1",
    name: "每日市场扫描",
    description: "每个交易日开盘前和午盘进行全市场扫描",
    schedule: "0 9,13 * * 1-5",
    status: "active",
    lastRun: "今天 09:00",
    nodes: [
      { id: "n1", type: "market_data", label: "获取指数数据", description: "上证、深证、恒生、标普500" },
      { id: "n2", type: "nlp", label: "新闻情绪分析", description: "分析隔夜重大新闻" },
      { id: "n3", type: "llm", label: "市场简报生成", description: "AI生成市场简报和关注点" },
      { id: "n4", type: "notify", label: "推送报告", description: "推送至Dashboard" },
    ],
  },
  {
    id: "wf-2",
    name: "波段交易研究",
    description: "发现潜在波段交易机会并生成交易计划",
    schedule: "0 */2 * * 1-5",
    status: "paused",
    lastRun: "昨天 14:00",
    nodes: [
      { id: "n5", type: "market_data", label: "扫描强势股", description: "筛选涨幅、成交量前列个股" },
      { id: "n6", type: "technical", label: "技术面筛选", description: "MACD金叉、突破压力位" },
      { id: "n7", type: "llm", label: "交易计划生成", description: "AI生成入场/止损/止盈计划" },
      { id: "n8", type: "risk", label: "风控审核", description: "仓位、风险收益比校验" },
    ],
  },
  {
    id: "wf-3",
    name: "持仓风险评估",
    description: "定时评估当前持仓风险并给出调整建议",
    schedule: "0 */4 * * 1-5",
    status: "draft",
    nodes: [
      { id: "n9", type: "market_data", label: "持仓行情更新", description: "获取所有持仓标的实时行情" },
      { id: "n10", type: "risk", label: "风险指标计算", description: "VaR、最大回撤、集中度" },
      { id: "n11", type: "llm", label: "调整建议", description: "AI生成调仓建议" },
    ],
  },
];

export function WorkflowPage() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>(workflows[0]);

  return (
    <div className="h-full flex gap-4">
      {/* 左侧：工作流列表 */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">工作流</h2>
          <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[10px] font-medium hover:bg-[var(--color-primary)]/25 transition-colors">
            <Plus className="w-3 h-3" />
            新建
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {workflows.map((wf) => (
            <button
              key={wf.id}
              onClick={() => setSelectedWorkflow(wf)}
              className={cn(
                "w-full text-left rounded-xl border p-3 transition-all",
                selectedWorkflow.id === wf.id
                  ? "border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/20"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold">{wf.name}</h3>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-medium",
                    wf.status === "active" && "bg-[var(--color-success)]/15 text-[var(--color-success)]",
                    wf.status === "paused" && "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
                    wf.status === "draft" && "bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]"
                  )}
                >
                  {wf.status === "active" ? "运行中" : wf.status === "paused" ? "已暂停" : "草稿"}
                </span>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-2 mb-2">{wf.description}</p>
              <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <Clock className="w-3 h-3" />
                {wf.lastRun || "未执行"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 右侧：工作流详情 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* 头部操作栏 */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div>
            <h2 className="text-sm font-semibold">{selectedWorkflow.name}</h2>
            <p className="text-[10px] text-[var(--color-text-muted)]">{selectedWorkflow.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
              <Calendar className="w-3 h-3" />
              Cron: {selectedWorkflow.schedule}
            </span>
            <button
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors",
                selectedWorkflow.status === "active"
                  ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/25"
                  : "bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25"
              )}
            >
              {selectedWorkflow.status === "active" ? (
                <>
                  <Pause className="w-3 h-3" /> 暂停
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" /> 启动
                </>
              )}
            </button>
            <button className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
              <MoreHorizontal className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
          </div>
        </div>

        {/* 流程画布 */}
        <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 overflow-auto">
          <div className="flex items-center gap-4 min-w-max justify-center h-full">
            {selectedWorkflow.nodes.map((node, index) => {
              const config = nodeTypeConfig[node.type];
              const Icon = config.icon;
              return (
                <div key={node.id} className="flex items-center gap-4">
                  {/* 节点卡片 */}
                  <div
                    className={cn(
                      "w-40 rounded-xl border-2 p-3 transition-all hover:scale-105 cursor-pointer",
                      config.bg
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", config.bg.replace("border-", "").split(" ")[0])}>
                        <Icon className={cn("w-3.5 h-3.5", config.color)} />
                      </div>
                      <GripVertical className="w-3 h-3 text-[var(--color-text-muted)]" />
                    </div>
                    <p className="text-[11px] font-semibold text-[var(--color-text-primary)]">{node.label}</p>
                    <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{node.description}</p>
                  </div>

                  {/* 连接线 */}
                  {index < selectedWorkflow.nodes.length - 1 && (
                    <div className="flex items-center">
                      <ArrowRight className="w-5 h-5 text-[var(--color-border)]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 可用节点面板 */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h4 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            可用节点（拖拽到画布）
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableNodes.map((node) => {
              const config = nodeTypeConfig[node.type];
              const Icon = config.icon;
              return (
                <div
                  key={node.id}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:scale-105 transition-all",
                    config.bg
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", config.color)} />
                  <span className="text-[10px] font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                    {node.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
