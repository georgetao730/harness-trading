'use client';

import { cn } from '@/lib/utils';
import {
  BookOpen,
  Brain,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Tag,
  TrendingUp,
  AlertCircle,
  Trash2,
  Upload,
  X,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import {
  listKnowledge,
  searchKnowledge,
  getKnowledgeStats,
  getKnowledgeDetail,
  createKnowledge,
  deleteKnowledge,
  promoteKnowledge,
  KnowledgeDoc,
  KnowledgeStats,
  KnowledgeDetail,
  KnowledgeSearchResponse,
} from '@/lib/api';

const TAG_COLORS: Record<string, string> = {
  '技术分析': 'bg-blue-500/10 text-blue-400',
  '交易策略': 'bg-green-500/10 text-green-400',
  '风险管理': 'bg-red-500/10 text-red-400',
  '市场规则': 'bg-yellow-500/10 text-yellow-400',
  '基础知识': 'bg-purple-500/10 text-purple-400',
  '买入信号': 'bg-emerald-500/10 text-emerald-400',
  '卖出信号': 'bg-orange-500/10 text-orange-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  strategy: '交易策略',
  rule: '市场规则',
  risk: '风险管理',
  pattern: '形态识别',
  indicator: '技术指标',
  basics: '基础知识',
};

function getTagColor(tag: string): string {
  return TAG_COLORS[tag] || 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]';
}

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'upload' | 'search'>('browse');
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Browse
  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listResp, statsResp] = await Promise.all([
        listKnowledge(),
        getKnowledgeStats().catch(() => null),
      ]);
      setDocs(listResp.entries || []);
      if (statsResp) setStats(statsResp);
    } catch {
      setError('加载知识库失败，请检查后端服务');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // ── Upload ──
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadContent.trim()) {
      setUploadMsg('标题和内容不能为空');
      return;
    }
    setUploading(true);
    setUploadMsg('');
    try {
      const tags = uploadTags.split(/[,，\s]+/).filter(Boolean);
      await createKnowledge({
        title: uploadTitle.trim(),
        content: uploadContent.trim(),
        tags,
        category: uploadCategory.trim() || undefined,
        source: 'manual',
      });
      setUploadTitle('');
      setUploadContent('');
      setUploadTags('');
      setUploadCategory('');
      setUploadMsg('✅ 知识上传成功！已自动索引到知识库');
      loadDocs();
    } catch (e: any) {
      setUploadMsg(`❌ 上传失败: ${e?.message || '未知错误'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这篇知识？')) return;
    await deleteKnowledge(id);
    loadDocs();
  };

  // ── Detail ──
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const d = await getKnowledgeDetail(id);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
  };

  // ── Search ──
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeDoc[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setHasSearched(false); return; }
    setSearchLoading(true);
    try {
      const resp: KnowledgeSearchResponse = await searchKnowledge(q, 10);
      setSearchResults(resp.results || []);
      setHasSearched(true);
    } catch {
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Group docs by category
  const byCategory: Record<string, KnowledgeDoc[]> = {};
  for (const doc of docs) {
    const cat = doc.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(doc);
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">知识库</h2>
          {stats && (
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)]">
                {stats.total} 篇文档
              </span>
              {stats.promoted > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                  {stats.promoted} 已收录
                </span>
              )}
              <span className="text-[var(--color-text-muted)]">
                {stats.categories} 个分类 · {stats.tags} 个标签
              </span>
            </div>
          )}
        </div>
        <button
          onClick={loadDocs}
          className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] transition-colors"
          title="刷新"
        >
          <RefreshCw className={cn('w-3.5 h-3.5 text-[var(--color-text-muted)]', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[var(--color-surface)] rounded-xl p-1 border border-[var(--color-border)] w-fit flex-shrink-0">
        {[
          { id: 'browse' as const, label: '浏览文档', icon: BookOpen },
          { id: 'upload' as const, label: '上传知识', icon: Upload },
          { id: 'search' as const, label: 'BM25 搜索', icon: Search },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
              activeTab === tab.id
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px] flex-shrink-0">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* ── Browse Tab ── */}
        {activeTab === 'browse' && (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
              <BookOpen className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-xs font-medium">知识库为空</p>
              <p className="text-[10px] opacity-60 mt-1">切换到"上传知识"添加第一篇文档</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byCategory).map(([cat, catDocs]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      {CATEGORY_LABELS[cat] || cat}
                    </h3>
                    <span className="text-[9px] text-[var(--color-text-muted)]">({catDocs.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {catDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)]/30 transition-all group cursor-pointer"
                        onClick={() => openDetail(doc.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-xs font-semibold truncate pr-2 flex-1">{doc.title}</h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                              className="p-0.5 rounded hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)]" />
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed mb-2 line-clamp-2">
                          {doc.snippet || doc.title}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1 flex-wrap">
                            {(doc.tags || []).slice(0, 3).map((tag) => (
                              <span key={tag} className={cn('px-1.5 py-0.5 rounded text-[9px]', getTagColor(tag))}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[8px]',
                            doc.status === 'promoted' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400',
                          )}>
                            {doc.status === 'promoted' ? '已收录' : '待审核'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Upload Tab ── */}
        {activeTab === 'upload' && (
          <div className="space-y-4 max-w-2xl">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Upload className="w-4 h-4 text-[var(--color-accent)]" />
                <h3 className="text-xs font-semibold">新增知识</h3>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mb-4">
                添加交易知识到知识库，AI Agent 回答时会自动检索相关内容（RAG）。
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">标题 *</label>
                  <input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="如：MACD金叉交易策略"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-xs outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">内容 *</label>
                  <textarea
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                    placeholder="输入知识内容，支持 Markdown 格式…"
                    rows={8}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-xs outline-none resize-none focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">标签（逗号分隔）</label>
                    <input
                      value={uploadTags}
                      onChange={(e) => setUploadTags(e.target.value)}
                      placeholder="如：技术分析, MACD"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-xs outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">分类</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-xs outline-none"
                    >
                      <option value="">选择分类</option>
                      <option value="strategy">交易策略</option>
                      <option value="rule">市场规则</option>
                      <option value="risk">风险管理</option>
                      <option value="pattern">形态识别</option>
                      <option value="indicator">技术指标</option>
                      <option value="basics">基础知识</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={cn(
                    'px-4 py-2 rounded-lg text-white text-xs font-medium transition-all flex items-center gap-1.5',
                    uploading
                      ? 'bg-[var(--color-text-muted)] cursor-not-allowed'
                      : 'bg-[var(--color-accent)] hover:opacity-90',
                  )}
                >
                  {uploading ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />上传中...</>
                  ) : (
                    <><Plus className="w-3 h-3" />确认上传</>
                  )}
                </button>

                {uploadMsg && (
                  <p className={cn(
                    'text-[10px] px-1',
                    uploadMsg.startsWith('✅') ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
                  )}>
                    {uploadMsg}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Search Tab ── */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] focus-within:border-[var(--color-primary)]/50 transition-colors">
                <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
                <input
                  placeholder="搜索交易知识…（BM25 + 中文分词）"
                  className="bg-transparent outline-none text-xs flex-1"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
                />
                {searchLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-primary)]" />}
              </div>
              <button
                onClick={() => doSearch(query)}
                disabled={searchLoading || !query.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-xs font-medium hover:bg-[var(--color-primary)]/25 disabled:opacity-40 transition-colors"
              >
                搜索
              </button>
            </div>

            {hasSearched && (
              searchResults.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {searchResults.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)]/30 transition-all cursor-pointer"
                      onClick={() => openDetail(doc.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-xs font-semibold">{doc.title}</h4>
                        {doc.score !== undefined && (
                          <span className="text-[9px] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)]">
                            {(doc.score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed mb-2 line-clamp-2">
                        {doc.snippet || ''}
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {(doc.tags || []).map((tag) => (
                          <span key={tag} className={cn('px-1.5 py-0.5 rounded text-[9px]', getTagColor(tag))}>
                            <Tag className="w-2.5 h-2.5 inline mr-0.5" />{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
                  <Search className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">未找到匹配结果</p>
                  <p className="text-[10px] opacity-60 mt-1">尝试其他关键词，或上传相关内容</p>
                </div>
              )
            )}

            {!hasSearched && (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
                <Search className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-xs font-medium">BM25 全文检索</p>
                <p className="text-[10px] opacity-60 mt-1 max-w-xs text-center">
                  支持中文分词，输入关键词搜索知识库内容。搜索词会匹配标题、正文和标签。
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeDetail}>
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-[680px] max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold truncate">{detail?.title || '加载中…'}</h3>
              <button onClick={closeDetail} className="p-1 rounded hover:bg-[var(--color-surface-hover)]">
                <X className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  {/* Meta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {detail.tags?.map((tag) => (
                      <span key={tag} className={cn('px-2 py-0.5 rounded text-[9px] font-medium', getTagColor(tag))}>
                        {tag}
                      </span>
                    ))}
                    {detail.category && (
                      <span className="px-2 py-0.5 rounded bg-[var(--color-surface-hover)] text-[9px] text-[var(--color-text-muted)]">
                        {CATEGORY_LABELS[detail.category] || detail.category}
                      </span>
                    )}
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[9px]',
                      detail.status === 'promoted' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400',
                    )}>
                      {detail.status === 'promoted' ? '已收录' : '待审核'}
                    </span>
                  </div>

                  {/* Content rendered as markdown-ish */}
                  <div className="prose prose-sm max-w-none text-xs leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {detail.content}
                  </div>

                  {detail.source && (
                    <div className="pt-3 border-t border-[var(--color-border)]">
                      <span className="text-[9px] text-[var(--color-text-muted)] flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" />
                        来源: {detail.source}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-text-muted)] text-xs">无法加载文档内容</div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
              <span className="text-[9px] text-[var(--color-text-muted)]">
                ID: {detailId}
              </span>
              <button
                onClick={() => { closeDetail(); handleDelete(detailId); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
