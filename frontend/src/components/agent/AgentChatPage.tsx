'use client';

import { agentChat } from '@/lib/api';
import type { ThinkingStep } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: ThinkingStep[];
  timestamp: string;
  model?: string;
  provider?: string;
}

const initialMessages: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      '你好！我是 Harness 交易助手。我可以帮你分析市场、研究标的、生成交易建议。\n\n**当前处于演习模式**，所有建议不会实际执行。\n\n你可以这样问我：\n- "分析一下腾讯最近的走势"\n- "帮我看看茅台现在适不适合买入"\n- "今天市场整体情况怎么样"',
    timestamp: '09:30',
  },
];

export function AgentChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [apiOnline, setApiOnline] = useState(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingSteps]);

  const sendMessage = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const userQuestion = input;
    setInput('');
    setIsThinking(true);

    try {
      // Call real AI backend
      const response = await agentChat(userQuestion);

      // Show thinking steps one by one with animation
      if (response.thinking_steps && response.thinking_steps.length > 0) {
        for (const step of response.thinking_steps) {
          setThinkingSteps((prev) => [...prev, step]);
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        thinking: response.thinking_steps || [],
        model: response.model,
        provider: response.provider,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setApiOnline(true);
    } catch {
      // Fallback: backend not available
      setApiOnline(false);
      const fallbackMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          '⚠️ AI 服务暂时不可用。请确认后端服务已启动 (`cd backend && uvicorn app.main:app --reload --port 18766`)。\n\n当前使用离线模式，你可以使用下方建议按钮或在等待服务恢复。',
        thinking: [],
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    }

    setThinkingSteps([]);
    setIsThinking(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestions = [
    '分析一下腾讯最近走势',
    '帮我看看茅台是否适合买入',
    '今天市场整体情况怎么样',
    '我的持仓风险评估',
    '推荐几只技术面好的股票',
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI 交易助手</h2>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {apiOnline ? '多模型智能路由' : '离线模式'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-[10px]',
              apiOnline
                ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
            )}
          >
            {apiOnline ? (
              <>
                <Wifi className="w-3 h-3" />
                在线
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                离线
              </>
            )}
          </span>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div className={cn('max-w-[75%]', msg.role === 'user' ? 'order-first' : '')}>
              {/* 用户消息 */}
              {msg.role === 'user' && (
                <div className="rounded-2xl rounded-br-md bg-[var(--color-primary)] px-4 py-2.5">
                  <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}

              {/* AI 思考过程（折叠） */}
              {msg.role === 'assistant' && msg.thinking && msg.thinking.length > 0 && (
                <div className="mb-2">
                  <button
                    onClick={() =>
                      setExpandedThinking((prev) => ({
                        ...prev,
                        [msg.id]: !prev[msg.id],
                      }))
                    }
                    className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    <Brain className="w-3 h-3" />
                    思考过程 ({msg.thinking.length} 步)
                    {expandedThinking[msg.id] ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  {expandedThinking[msg.id] && (
                    <div className="mt-1.5 space-y-1">
                      {msg.thinking!.map((step, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 px-2 py-1 rounded bg-[var(--color-surface-hover)]/50"
                        >
                          {step.type === 'skill' && (
                            <BarChart3 className="w-3 h-3 text-blue-400 mt-0.5" />
                          )}
                          {step.type === 'reasoning' && (
                            <Brain className="w-3 h-3 text-purple-400 mt-0.5" />
                          )}
                          {step.type === 'risk' && (
                            <Shield className="w-3 h-3 text-yellow-400 mt-0.5" />
                          )}
                          <div>
                            <p className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                              {step.title}
                            </p>
                            <p className="text-[10px] text-[var(--color-text-muted)]">
                              {step.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI 回复 */}
              {msg.role === 'assistant' && (
                <div className="rounded-2xl rounded-bl-md bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3">
                  <div className="text-sm text-[var(--color-text-primary)] leading-relaxed prose-sm prose-invert max-w-none">
                    {msg.content.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) {
                        return (
                          <h3
                            key={i}
                            className="text-sm font-bold mt-2 mb-1 text-[var(--color-text-primary)]"
                          >
                            {line.replace('## ', '')}
                          </h3>
                        );
                      }
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return (
                          <p
                            key={i}
                            className="text-xs font-semibold mt-2 mb-0.5 text-[var(--color-text-primary)]"
                          >
                            {line.replace(/\*\*/g, '')}
                          </p>
                        );
                      }
                      if (line.startsWith('- ')) {
                        return (
                          <p key={i} className="text-xs ml-3 flex gap-1.5">
                            <span className="text-[var(--color-primary)]">•</span>
                            <span>{line.replace('- ', '')}</span>
                          </p>
                        );
                      }
                      if (line.startsWith('⚠️')) {
                        return (
                          <p
                            key={i}
                            className="text-[10px] mt-2 text-[var(--color-warning)] italic"
                          >
                            {line}
                          </p>
                        );
                      }
                      if (line.trim() === '') return <br key={i} />;
                      return (
                        <p key={i} className="text-xs">
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 时间戳 */}
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 px-1">
                {msg.timestamp}
              </p>
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </div>
            )}
          </div>
        ))}

        {/* AI 实时思考步骤 */}
        {isThinking && thinkingSteps.length > 0 && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="rounded-2xl rounded-bl-md bg-[var(--color-surface)] border border-[var(--color-primary)]/20 px-4 py-3 max-w-[75%]">
              <p className="text-[10px] text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
                <Brain className="w-3 h-3" />
                正在思考...
              </p>
              <div className="space-y-1.5">
                {thinkingSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {step.type === 'skill' && <BarChart3 className="w-3 h-3 text-blue-400" />}
                    {step.type === 'reasoning' && <Brain className="w-3 h-3 text-purple-400" />}
                    {step.type === 'risk' && <Shield className="w-3 h-3 text-yellow-400" />}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[var(--color-text-secondary)]">
                        {step.title}
                      </span>
                      <span className="inline-block w-1 h-1 rounded-full bg-[var(--color-success)]" />
                    </div>
                  </div>
                ))}
                {thinkingSteps.length < 4 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce" />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce [animation-delay:0.2s]" />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 建议快捷按钮 + 输入框 */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        {/* 快捷建议 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text-secondary)] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        {/* 输入区域 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题或交易指令..."
              rows={1}
              className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-[var(--color-primary)]/50 placeholder:text-[var(--color-text-muted)]"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isThinking}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-xl transition-all',
              input.trim() && !isThinking
                ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]'
                : 'bg-[var(--color-surface-hover)] cursor-not-allowed',
            )}
          >
            {isThinking ? (
              <Loader2 className="w-5 h-5 text-[var(--color-text-muted)] animate-spin" />
            ) : (
              <Send
                className={cn(
                  'w-4 h-4',
                  input.trim() ? 'text-white' : 'text-[var(--color-text-muted)]',
                )}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
