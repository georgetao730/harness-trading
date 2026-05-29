"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Settings,
  Brain,
  Bot,
  Key,
  Server,
  Globe,
  Shield,
  Zap,
  Save,
  RotateCw,
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
  category: "primary" | "secondary" | "vision" | "local" | "long_context";
}

const initialProviders: ProviderConfig[] = [
  {
    id: "p1",
    name: "主推理模型",
    provider: "Anthropic",
    model: "claude-sonnet-4-20250514",
    apiKey: "••••••••••••••••",
    baseUrl: "https://api.anthropic.com",
    enabled: true,
    status: "connected",
    category: "primary",
  },
  {
    id: "p2",
    name: "辅助模型",
    provider: "DeepSeek",
    model: "deepseek-chat",
    apiKey: "••••••••••••••••",
    baseUrl: "https://api.deepseek.com",
    enabled: true,
    status: "connected",
    category: "secondary",
  },
  {
    id: "p3",
    name: "本地模型",
    provider: "Ollama",
    model: "qwen2.5:32b",
    apiKey: "",
    baseUrl: "http://localhost:11434",
    enabled: false,
    status: "disconnected",
    category: "local",
  },
  {
    id: "p4",
    name: "多模态模型",
    provider: "OpenAI",
    model: "gpt-4o",
    apiKey: "••••••••••••••••",
    baseUrl: "https://api.openai.com",
    enabled: true,
    status: "connected",
    category: "vision",
  },
  {
    id: "p5",
    name: "长上下文模型",
    provider: "Moonshot",
    model: "moonshot-v1-128k",
    apiKey: "",
    baseUrl: "https://api.moonshot.cn",
    enabled: false,
    status: "disconnected",
    category: "long_context",
  },
];

const availableProviders = [
  { name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"] },
  { name: "Anthropic", models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-haiku-3.5"] },
  { name: "Google", models: ["gemini-2.5-pro", "gemini-2.5-flash"] },
  { name: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "通义千问", models: ["qwen-max", "qwen-plus", "qwen-turbo"] },
  { name: "智谱GLM", models: ["glm-4-plus", "glm-4-flash"] },
  { name: "Moonshot", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"] },
  { name: "Ollama", models: ["llama3:70b", "qwen2.5:32b", "deepseek-r1:32b", "mistral:7b"] },
  { name: "OpenAI兼容", models: ["custom-model"] },
];

const routingRules = [
  { task: "交易决策", model: "主推理模型 (Claude Sonnet)", priority: 1 },
  { task: "市场分析", model: "主推理模型 (Claude Sonnet)", priority: 1 },
  { task: "新闻摘要", model: "辅助模型 (DeepSeek)", priority: 2 },
  { task: "情绪分析", model: "辅助模型 (DeepSeek)", priority: 2 },
  { task: "图表分析", model: "多模态模型 (GPT-4o)", priority: 3 },
  { task: "研报阅读", model: "长上下文模型 (Moonshot)", priority: 4 },
  { task: "隐私数据", model: "本地模型 (Qwen2.5)", priority: 5 },
  { task: "普通对话", model: "辅助模型 (DeepSeek)", priority: 6 },
];

const categoryLabels: Record<string, string> = {
  primary: "主推理",
  secondary: "辅助",
  vision: "多模态",
  local: "本地",
  long_context: "长上下文",
};

const categoryColors: Record<string, string> = {
  primary: "bg-purple-500/15 text-purple-400",
  secondary: "bg-blue-500/15 text-blue-400",
  vision: "bg-green-500/15 text-green-400",
  local: "bg-yellow-500/15 text-yellow-400",
  long_context: "bg-cyan-500/15 text-cyan-400",
};

export function SettingsPage() {
  const [providers, setProviders] = useState(initialProviders);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<"providers" | "routing" | "general">("providers");
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">系统设置</h2>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-[10px] font-medium hover:bg-[var(--color-primary-hover)] transition-colors">
          <Save className="w-3.5 h-3.5" />
          保存配置
        </button>
      </div>

      {/* 设置标签 */}
      <div className="flex gap-1 bg-[var(--color-surface)] rounded-xl p-1 border border-[var(--color-border)] w-fit">
        {[
          { id: "providers", label: "模型厂商" },
          { id: "routing", label: "模型路由" },
          { id: "general", label: "通用设置" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as typeof activeSection)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeSection === tab.id
                ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 模型厂商配置 */}
      {activeSection === "providers" && (
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={cn(
                "rounded-xl border transition-all",
                provider.enabled
                  ? "border-[var(--color-border)] bg-[var(--color-surface)]"
                  : "border-[var(--color-border)]/50 bg-[var(--color-surface)]/50 opacity-70"
              )}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold">{provider.name}</h4>
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", categoryColors[provider.category])}>
                        {categoryLabels[provider.category]}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{provider.provider} · {provider.model}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {provider.status === "connected" ? (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                      <Wifi className="w-3 h-3" /> 已连接
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                      <WifiOff className="w-3 h-3" /> 未连接
                    </span>
                  )}
                  <button
                    onClick={() => {
                      const newProviders = providers.map((p) =>
                        p.id === provider.id ? { ...p, enabled: !p.enabled } : p
                      );
                      setProviders(newProviders);
                    }}
                    className={cn(
                      "w-8 h-5 rounded-full transition-colors relative",
                      provider.enabled ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]/30"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                        provider.enabled ? "left-3.5" : "left-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* 展开编辑 */}
              {editingProvider === provider.id && (
                <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">厂商</label>
                      <select className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]/50">
                        {availableProviders.map((ap) => (
                          <option key={ap.name} selected={ap.name === provider.provider}>{ap.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">模型</label>
                      <select className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]/50">
                        {availableProviders.find((ap) => ap.name === provider.provider)?.models.map((m) => (
                          <option key={m} selected={m === provider.model}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type={showKeys[provider.id] ? "text" : "password"}
                        defaultValue={provider.apiKey}
                        className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]/50 font-mono"
                      />
                      <button
                        onClick={() => setShowKeys((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                        className="px-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                      >
                        {showKeys[provider.id] ? (
                          <EyeOff className="w-4 h-4 text-[var(--color-text-muted)]" />
                        ) : (
                          <Eye className="w-4 h-4 text-[var(--color-text-muted)]" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Base URL</label>
                    <input
                      defaultValue={provider.baseUrl}
                      className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]/50 font-mono"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[10px] font-medium hover:bg-[var(--color-primary)]/25 transition-colors">
                      <CheckCircle2 className="w-3 h-3" /> 测试连接
                    </button>
                    <button
                      onClick={() => setEditingProvider(null)}
                      className="px-3 py-1.5 rounded-lg text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                    >
                      收起
                    </button>
                  </div>
                </div>
              )}

              {/* 底部操作 */}
              <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--color-border)]">
                <button
                  onClick={() => setEditingProvider(editingProvider === provider.id ? null : provider.id)}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {editingProvider === provider.id ? "收起编辑" : "编辑配置"}
                </button>
                <button className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-success)] transition-colors">
                  <RotateCw className="w-3 h-3" /> 测试连接
                </button>
              </div>
            </div>
          ))}

          {/* 添加新 Provider */}
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] transition-colors text-xs">
            <Plus className="w-4 h-4" />
            添加模型厂商
          </button>
        </div>
      )}

      {/* 模型路由规则 */}
      {activeSection === "routing" && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold">模型路由规则</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">根据任务类型自动选择最优模型，支持降级链</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {routingRules.map((rule, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--color-text-muted)] w-4">P{rule.priority}</span>
                  <span className="text-xs font-medium">{rule.task}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--color-text-muted)]">{rule.model}</span>
                  <Zap className="w-3 h-3 text-[var(--color-warning)]" />
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/20">
            <p className="text-[10px] text-[var(--color-text-muted)]">
              降级链: 主推理 → 辅助 → 本地 (任一不可用时自动切换)
            </p>
          </div>
        </div>
      )}

      {/* 通用设置 */}
      {activeSection === "general" && (
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
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">通知渠道</label>
            <div className="space-y-2">
              {["邮件通知", "Webhook", "Telegram Bot"].map((ch) => (
                <label key={ch} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" defaultChecked className="accent-[var(--color-primary)]" />
                  {ch}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
