"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Brain,
  Clock,
  Search,
  Plus,
  Star,
  TrendingUp,
  TrendingDown,
  Shield,
  Tag,
  Trash2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

interface Memory {
  id: string;
  type: "trade_pattern" | "risk_preference" | "market_rule" | "personal";
  title: string;
  content: string;
  tags: string[];
  importance: "high" | "medium" | "low";
  created: string;
  lastAccess: string;
}

interface KnowledgeCard {
  id: string;
  title: string;
  category: string;
  summary: string;
  source: string;
  date: string;
}

const memories: Memory[] = [
  {
    id: "m1",
    type: "trade_pattern",
    title: "追高陷阱",
    content: "2024年3月腾讯追高买入后亏损12%。教训：不在突破后追高，等待回调确认后再入场。",
    tags: ["追高", "腾讯", "教训"],
    importance: "high",
    created: "2024-03-15",
    lastAccess: "今天",
  },
  {
    id: "m2",
    type: "risk_preference",
    title: "持仓偏好",
    content: "用户偏好日内交易，不喜欢持仓过夜。单笔风险承受为账户的2%。倾向于科技股和消费股。",
    tags: ["风险偏好", "持仓风格"],
    importance: "high",
    created: "2024-01-10",
    lastAccess: "今天",
  },
  {
    id: "m3",
    type: "market_rule",
    title: "美联储议息规则",
    content: "FOMC会议前减少仓位至50%以下，会议结果公布后根据方向再操作。历史波动统计：会议当日平均波动2.3%。",
    tags: ["美联储", "宏观", "仓位管理"],
    importance: "medium",
    created: "2024-06-20",
    lastAccess: "昨天",
  },
  {
    id: "m4",
    type: "personal",
    title: "茅台策略",
    content: "茅台在1700-1800区间为合理估值，低于1700开始建仓，高于1900分批止盈。利用股息再投资。",
    tags: ["茅台", "估值", "策略"],
    importance: "medium",
    created: "2024-04-05",
    lastAccess: "3天前",
  },
  {
    id: "m5",
    type: "trade_pattern",
    title: "突破交易成功案例",
    content: "NVDA在2024年5月突破1000美元后持续上涨。确认信号：成交量放大3倍 + MACD金叉 + RSI>60。",
    tags: ["NVDA", "突破", "成功"],
    importance: "medium",
    created: "2024-05-20",
    lastAccess: "1周前",
  },
];

const knowledgeCards: KnowledgeCard[] = [
  { id: "k1", title: "MACD交易策略精讲", category: "技术分析", summary: "MACD金叉死叉的实战应用与常见误区", source: "内部整理", date: "2024-04-10" },
  { id: "k2", title: "A股交易规则手册", category: "市场规则", summary: "涨跌停、T+1、交易费用等核心规则", source: "官方文档", date: "2024-01-15" },
  { id: "k3", title: "风险管理基础框架", category: "风控体系", summary: "仓位管理、凯利公式、VaR计算", source: "经典教材", date: "2024-02-28" },
  { id: "k4", title: "财报分析速查表", category: "基本面分析", summary: "PE/PB/ROE/毛利率等核心指标解读", source: "内部整理", date: "2024-03-05" },
];

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  trade_pattern: { icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10" },
  risk_preference: { icon: Shield, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  market_rule: { icon: BookOpen, color: "text-green-400", bg: "bg-green-500/10" },
  personal: { icon: Brain, color: "text-purple-400", bg: "bg-purple-500/10" },
};

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<"memories" | "knowledge">("memories");

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">知识库 & 记忆</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
            <Search className="w-3 h-3" />
            <input placeholder="搜索记忆..." className="bg-transparent outline-none w-32" />
          </div>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[10px] font-medium hover:bg-[var(--color-primary)]/25 transition-colors">
            <Plus className="w-3 h-3" />
            添加
          </button>
        </div>
      </div>

      {/* 标签切换 */}
      <div className="flex gap-1 bg-[var(--color-surface)] rounded-xl p-1 border border-[var(--color-border)] w-fit">
        <TabButton active={activeTab === "memories"} onClick={() => setActiveTab("memories")}>Agent 记忆</TabButton>
        <TabButton active={activeTab === "knowledge"} onClick={() => setActiveTab("knowledge")}>交易知识</TabButton>
      </div>

      {/* Agent 记忆 */}
      {activeTab === "memories" && (
        <div className="grid grid-cols-2 gap-3">
          {memories.map((mem) => {
            const config = typeConfig[mem.type];
            const Icon = config.icon;
            return (
              <div key={mem.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)]/30 transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", config.bg)}>
                      <Icon className={cn("w-3.5 h-3.5", config.color)} />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold">{mem.title}</h4>
                      <p className="text-[9px] text-[var(--color-text-muted)] capitalize">{mem.type.replace("_", " ")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 rounded hover:bg-[var(--color-surface-hover)]">
                      <Star className="w-3 h-3 text-[var(--color-text-muted)]" />
                    </button>
                    <button className="p-1 rounded hover:bg-[var(--color-surface-hover)]">
                      <Trash2 className="w-3 h-3 text-[var(--color-text-muted)]" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mb-3">{mem.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {mem.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] text-[9px] text-[var(--color-text-muted)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {mem.lastAccess}
                    </span>
                    <span className={cn(
                      "px-1 py-0.5 rounded text-[8px] font-medium",
                      mem.importance === "high" ? "bg-red-500/15 text-red-400" : "bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]"
                    )}>
                      {mem.importance === "high" ? "重要" : "普通"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 交易知识 */}
      {activeTab === "knowledge" && (
        <div className="grid grid-cols-2 gap-3">
          {knowledgeCards.map((card) => (
            <div key={card.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)]/30 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-2">
                <span className="px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[9px] text-[var(--color-primary)] font-medium">{card.category}</span>
                <ExternalLink className="w-3 h-3 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h4 className="text-xs font-semibold mb-1">{card.title}</h4>
              <p className="text-[10px] text-[var(--color-text-secondary)] mb-3">{card.summary}</p>
              <div className="flex items-center justify-between text-[9px] text-[var(--color-text-muted)]">
                <span>{card.source}</span>
                <span>{card.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
        active ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      )}
    >
      {children}
    </button>
  );
}
