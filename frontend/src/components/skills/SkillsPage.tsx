'use client';

import { cn } from '@/lib/utils';
import {
  Activity, BarChart3, Brain, Code2, Database, Eye, Loader2,
  Plus, Radio, RefreshCw, Save, Search, Sparkles, TrendingUp,
  Wand2, Wrench, Zap, X,
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getSkillsDetail, createSkill, getSkillSource, updateSkillSource,
  SkillInfo, SkillsDetailResponse,
} from '@/lib/api';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  market_data: TrendingUp,
  technical: BarChart3,
  fundamental: Database,
  nlp: Brain,
  llm_reasoning: Wand2,
  execution: Zap,
};
const CATEGORY_COLORS: Record<string, string> = {
  market_data: 'text-blue-400 bg-blue-500/10',
  technical: 'text-purple-400 bg-purple-500/10',
  fundamental: 'text-green-400 bg-green-500/10',
  nlp: 'text-orange-400 bg-orange-500/10',
  llm_reasoning: 'text-pink-400 bg-pink-500/10',
  execution: 'text-emerald-400 bg-emerald-500/10',
};

// ── Create Skill Modal ──
function CreateSkillModal({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'review'>('input');

  const handleGenerate = async () => {
    if (!description.trim()) { setError('请输入 Skill 功能描述'); return; }
    setError('');
    setGenerating(true);
    try {
      const resp = await createSkill(description.trim());
      if (resp.status === 'created') {
        setGeneratedCode(resp.code);
        setStep('review');
      } else if (resp.status === 'duplicate') {
        setError(resp.message || 'Skill 已存在');
      } else {
        setError(resp.message || '创建失败');
      }
    } catch (err: any) {
      setError(err?.message || 'LLM 生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = () => {
    onCreated();
    handleClose();
  };

  const handleClose = () => {
    setDescription('');
    setGeneratedCode('');
    setError('');
    setStep('input');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold">创建新 Skill</h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-[var(--color-surface-hover)]">
            <X className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'input' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-2 block">
                  用自然语言描述你想要的 Skill 功能
                </label>
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setError(''); }}
                  placeholder={'例如：\n扫描全市场股票，找出 macd 金叉且 rsi 在 30-70 之间的股票\n或者：\n根据基本面数据计算格雷厄姆估值，判断股票是否被低估'}
                  disabled={generating}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-xs outline-none focus:border-[var(--color-accent)] resize-none"
                />
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[11px]">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || !description.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 正在生成 Skill 代码...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI 生成 Skill
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[10px] text-[var(--color-text-muted)]">
                AI 已为你生成以下 Skill 代码，确认后将自动注册到系统中（重启后端后生效）
              </p>
              <pre className="p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[10px] leading-relaxed overflow-auto max-h-[400px] font-mono whitespace-pre-wrap">
                {generatedCode}
              </pre>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-xs hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  ← 返回修改描述
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-success)] text-white text-xs font-medium hover:opacity-90"
                >
                  确认创建
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Skill Modal ──
function EditSkillModal({
  open, skillName, onClose, onSaved,
}: {
  open: boolean; skillName: string; onClose: () => void; onSaved: () => void;
}) {
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !skillName) return;
    setLoading(true);
    getSkillSource(skillName)
      .then((r) => setSource(r.source))
      .catch(() => setError('加载源码失败'))
      .finally(() => setLoading(false));
  }, [open, skillName]);

  const handleSave = async () => {
    if (!source.trim()) return;
    setSaving(true);
    setError('');
    try {
      await updateSkillSource(skillName, source);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold">编辑 Skill · <span className="text-[var(--color-accent)]">{skillName}.py</span></h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-surface-hover)]">
            <X className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : (
            <>
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full h-[420px] px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[11px] leading-relaxed font-mono outline-none focus:border-[var(--color-accent)] resize-none"
                spellCheck={false}
              />

              {error && (
                <div className="px-3 py-2 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[11px]">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-xs hover:bg-[var(--color-surface-hover)] transition-colors">
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !source.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {saving ? '保存中...' : '保存代码'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Skills Page ──
export function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editSkill, setEditSkill] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getSkillsDetail();
      setSkills(resp.skills || []);
      setCategories(resp.categories || []);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const filtered = filter
    ? skills.filter((s) => s.category === filter)
    : skills;

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Skills 管理</h2>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            AI Agent 可调用的能力模块 · {skills.length} 项已注册
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSkills}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            刷新
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-[10px] font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3 h-3" />
            创建 Skill
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={cn(
            'px-3 py-1 rounded-lg text-[10px] font-medium transition-colors',
            !filter
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]',
          )}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={cn(
              'px-3 py-1 rounded-lg text-[10px] font-medium transition-colors',
              filter === cat.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Skills grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
          <Wrench className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-xs font-medium">暂无 Skills</p>
          <p className="text-[10px] opacity-60 mt-1">
            Skills 模块通过 skills/ 目录自动发现注册
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((skill) => {
            const Icon = CATEGORY_ICONS[skill.category || ''] || Activity;
            const colorClass = CATEGORY_COLORS[skill.category || ''] || 'text-gray-400 bg-gray-500/10';
            const catLabel = categories.find(c => c.id === skill.category)?.label || skill.category;
            return (
              <div
                key={skill.name}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-accent)]/30 transition-all group relative"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colorClass)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold truncate">{skill.name}</h4>
                    <span className="text-[9px] text-[var(--color-text-muted)]">{catLabel || skill.category}</span>
                  </div>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[8px] font-medium flex-shrink-0',
                    skill.enabled !== false
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]',
                  )}>
                    {skill.enabled !== false ? '启用' : '禁用'}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed mb-3">
                  {skill.description}
                </p>

                {/* Edit button */}
                <button
                  onClick={() => setEditSkill(skill.name)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  <Code2 className="w-3 h-3" />
                  编辑源码
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* How it works */}
      <div className="mt-auto p-4 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 space-y-2">
        <p className="text-[10px] text-[var(--color-text-muted)]">
          💡 Skills 模块通过 <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] text-[9px]">skills/*.py</code>
          目录自动发现注册。新增 Skill 只需在该目录下创建 Python 文件，继承 <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] text-[9px]">BaseSkill</code>
          并实现 <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] text-[9px]">execute()</code> 方法即可。
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          ✨ 点击「创建 Skill」使用自然语言描述需求，AI 将自动生成完整可运行的 Skill 代码。
        </p>
      </div>

      {/* Modals */}
      <CreateSkillModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadSkills}
      />
      <EditSkillModal
        open={!!editSkill}
        skillName={editSkill || ''}
        onClose={() => setEditSkill(null)}
        onSaved={loadSkills}
      />
    </div>
  );
}
