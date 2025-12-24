'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiRefreshCw, FiExternalLink, FiChevronDown, FiChevronRight } from 'react-icons/fi';

const API_BASE = process.env.NEXT_PUBLIC_GO_API ?? 'http://www.hvenjustic.top:4010';

type MarkdownStore = {
    nums?: number;
    raw_markdown?: string[];
    fit_markdown?: string[];
    markdown_with_citations?: string[];
};

type ResultItem = {
    id?: number | string;
    url?: string;
    site_name?: string | null;
    result_md?: string | null;
    processed_md?: string | null;
    graph_json?: string | null;
    crawled_at?: string | null;
    llm_processed_at?: string | null;
    page_count?: number;
    chunk_count?: number;
    is_crawled?: boolean;
    crawl_count?: number;
    created_at?: string | null;
    updated_at?: string | null;
};

type ResultDetailResponse = {
    item?: ResultItem;
};

type PreviewState = {
    url: string;
    type: string;
    content: string;
    loading: boolean;
    error?: string;
    section: SectionKey;
};

type SectionKey = 'raw_markdown' | 'fit_markdown' | 'markdown_with_citations';

export default function ResultDetailClient() {
    const searchParams = useSearchParams();
    const id = useMemo(() => searchParams.get('id')?.trim() || '', [searchParams]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState<ResultDetailResponse | null>(null);
    const [mdStore, setMdStore] = useState<MarkdownStore | null>(null);
    const [openSection, setOpenSection] = useState<SectionKey | null>('fit_markdown');
    const [preview, setPreview] = useState<PreviewState | null>(null);

    const fetchDetail = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/results/${encodeURIComponent(id)}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`请求失败：${res.status}`);
            const json = (await res.json()) as ResultDetailResponse;
            setData(json);

            const rawStr = json?.item?.result_md ?? '';
            if (rawStr) {
                try {
                    const parsed = JSON.parse(rawStr) as MarkdownStore;
                    setMdStore(parsed);
                } catch (e) {
                    setMdStore(null);
                    setError('解析 result_md 失败，请检查返回格式');
                }
            } else {
                setMdStore(null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : '未知错误');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const sections: { key: SectionKey; title: string; desc: string; data: string[] }[] = useMemo(() => {
        const store = mdStore || {};
        return [
            { key: 'fit_markdown', title: 'Fit Markdown', desc: '主用于展示/知识库', data: store.fit_markdown ?? [] },
            { key: 'raw_markdown', title: 'Raw Markdown', desc: '原始清洗后文本', data: store.raw_markdown ?? [] },
            {
                key: 'markdown_with_citations',
                title: 'Markdown with Citations',
                desc: '含引用标注',
                data: store.markdown_with_citations ?? [],
            },
        ];
    }, [mdStore]);

    const handleOpenSection = (key: SectionKey) => {
        setOpenSection((prev) => (prev === key ? null : key));
    };

    const handleLoadMD = async (url: string, section: SectionKey, type: string) => {
        if (!url) return;
        setPreview({ url, section, type, content: '', loading: true, error: undefined });
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`下载失败：${res.status}`);
            const text = await res.text();
            setPreview({ url, section, type, content: text, loading: false });
        } catch (e) {
            setPreview({
                url,
                section,
                type,
                content: '',
                loading: false,
                error: e instanceof Error ? e.message : '下载出错',
            });
        }
    };

    const formatTime = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    };

    const mdNums = mdStore?.nums ?? data?.item?.page_count;
    const detail = data?.item;

    const handlePreviewAndDownload = async (url: string, section: SectionKey, type: string) => {
        if (!url) return;
        triggerDownload(url);
        await handleLoadMD(url, section, type);
    };

    const handleOpenGraph = () => {
        if (!id) return;
        const target = `/result/detail/graph?id=${encodeURIComponent(id)}`;
        window.open(target, '_blank', 'noopener,noreferrer');
    };

    const triggerDownload = (url: string) => {
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = '';
            a.target = '_blank';
            a.rel = 'noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="px-6 pb-16">
            <div className="mx-auto mt-8 max-w-6xl space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/result"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                        >
                            <FiArrowLeft className="h-4 w-4" />
                            返回
                        </Link>
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                            任务详情{id ? ` #${id}` : ''}
                        </h1>
                    </div>
                    <button
                        onClick={fetchDetail}
                        disabled={!id}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                    >
                        <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                    </button>
                </div>

                {!id && (
                    <div className="glass-panel rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                        缺少参数 <code>id</code>，请从结果列表点击进入（示例：<code>/result/detail?id=123</code>）。
                    </div>
                )}

                {error && (
                    <div className="glass-panel rounded-2xl border border-red-200 bg-red-50/70 p-5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                        {error}
                    </div>
                )}

                <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70 space-y-4">
                    <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
                        <div>站点：{detail?.site_name ?? '—'}</div>
                        <div>URL：{detail?.url ?? '—'}</div>
                        <div>爬取：{detail?.is_crawled ? '已完成' : '未完成'}（次数 {detail?.crawl_count ?? 0}）</div>
                        <div>页面数：{mdNums ?? '—'} | 分块：{detail?.chunk_count ?? 0}</div>
                        <div>抓取时间：{formatTime(detail?.crawled_at)}</div>
                        <div>LLM时间：{formatTime(detail?.llm_processed_at)}</div>
                        <div>创建：{formatTime(detail?.created_at)}</div>
                        <div>更新：{formatTime(detail?.updated_at)}</div>
                        <div>MD 文档数：{mdStore?.nums ?? '—'}</div>
                        <div className="md:col-span-2">
                            预处理结果（processed_md）：{' '}
                            {detail?.processed_md ? (
                                <button
                                    onClick={() => triggerDownload(detail.processed_md as string)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-indigo-700 transition hover:border-indigo-200 hover:text-indigo-800 dark:border-slate-700 dark:text-indigo-200 dark:hover:border-indigo-500"
                                >
                                    <FiExternalLink className="h-4 w-4" />
                                    下载/查看
                                </button>
                            ) : (
                                '—'
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3">
                                <span>图谱 JSON（graph_json）：</span>
                                <button
                                    onClick={handleOpenGraph}
                                    disabled={!detail?.graph_json}
                                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:border-emerald-700"
                                >
                                    <FiExternalLink className="h-4 w-4" />
                                    图渲染
                                </button>
                            </div>
                            <div className="mt-1 max-h-48 overflow-auto rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {detail?.graph_json || '—'}
                            </div>
                        </div>
                    </div>

                    {!mdStore && <div className="text-sm text-slate-500 dark:text-slate-400">暂无 markdown 链接数据。</div>}

                    {sections.map((sec) => {
                        const isOpen = openSection === sec.key;
                        const isActivePreview = preview && preview.section === sec.key;
                        return (
                            <div
                                key={sec.key}
                                className="rounded-xl border border-slate-200 bg-white/70 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                            >
                                <button
                                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
                                    onClick={() => handleOpenSection(sec.key)}
                                >
                                    <div className="flex items-center gap-2">
                                        {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                                        <span>{sec.title}</span>
                                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                            {sec.desc}（{sec.data.length} 个）
                                        </span>
                                    </div>
                                </button>
                                {isOpen && (
                                    <div className="space-y-3 px-4 pb-4">
                                        <div className="h-56 overflow-auto space-y-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
                                            {sec.data.length === 0 && (
                                                <div className="text-xs text-slate-500 dark:text-slate-400">暂无链接</div>
                                            )}
                                            {sec.data.map((u, idx) => (
                                                <button
                                                    key={`${sec.key}-${idx}-${u}`}
                                                    onClick={() => handlePreviewAndDownload(u, sec.key, sec.title)}
                                                    className="group flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                                >
                                                    <span className="truncate">{u || '空链接'}</span>
                                                    <span className="flex items-center gap-1 text-slate-400 transition group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
                                                        <FiExternalLink className="h-4 w-4" />
                                                        <span>下载并预览</span>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        {isActivePreview && (
                                            <div className="glass-panel rounded-xl border border-indigo-200/70 bg-indigo-50/70 p-4 shadow-sm dark:border-indigo-900/40 dark:bg-slate-900/70">
                                                <div className="mb-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
                                                    <span className="font-semibold">
                                                        预览：{preview?.type} - {preview?.url}
                                                    </span>
                                                    {preview?.loading && <span className="text-amber-600">加载中...</span>}
                                                    {preview?.error && <span className="text-red-500">{preview.error}</span>}
                                                </div>
                                                <div className="max-h-60 overflow-auto rounded-lg bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-50 shadow-inner">
                                                    {preview?.loading ? '加载中...' : preview?.content || '内容为空'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

