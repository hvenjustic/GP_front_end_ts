'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiArrowRight, FiInfo, FiRefreshCw } from 'react-icons/fi';

type MarkdownStore = {
    nums?: number;
    raw_markdown?: string[];
    fit_markdown?: string[];
    markdown_with_citations?: string[];
};

type ResultItem = {
    id: number;
    site_name: string | null;
    url: string;
    crawled_at: string | null;
    llm_processed_at: string | null;
    is_crawled: boolean;
    crawl_count: number;
    page_count: number;
    chunk_count: number;
};

type ResultListResponse = {
    items: ResultItem[];
    total: number;
    page: number;
    page_size: number;
};

type ResultDetail = ResultItem & {
    result_md?: string | null;
    graph_json?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type SectionKey = 'raw_markdown' | 'fit_markdown' | 'markdown_with_citations';

type PreviewState = {
    url: string;
    section: SectionKey;
    type: string;
    content: string;
    loading: boolean;
    error?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_GO_API ?? 'http://10.138.19.107:4010';

const clampInt = (value: string | null, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
};

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div
        className={`glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70 ${className}`}
    >
        {children}
    </div>
);

export default function ResultListClient() {
    const searchParams = useSearchParams();
    const page = useMemo(() => clampInt(searchParams.get('page'), 1, 1, 10_000), [searchParams]);
    const pageSize = 10; // 固定每页 10 条

    const [data, setData] = useState<ResultListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [detailId, setDetailId] = useState<number | null>(null);
    const [detailData, setDetailData] = useState<ResultDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailMdStore, setDetailMdStore] = useState<MarkdownStore | null>(null);
    const [openSection, setOpenSection] = useState<SectionKey | null>('fit_markdown');
    const [preview, setPreview] = useState<PreviewState | null>(null);

    const totalPages = useMemo(() => {
        if (!data) return 1;
        return Math.max(1, Math.ceil((data.total || 0) / (data.page_size || pageSize)));
    }, [data, pageSize]);

    const fetchList = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/results?page=${page}&page_size=${pageSize}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`请求失败：${res.status}`);
            const json = (await res.json()) as ResultListResponse;
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : '未知错误');
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id: number) => {
        setDetailId(id);
        setDetailLoading(true);
        setDetailError('');
        setDetailMdStore(null);
        setPreview(null);
        try {
            const res = await fetch(`${API_BASE}/api/results/${id}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`请求失败：${res.status}`);
            const json = (await res.json()) as { item?: ResultDetail };
            setDetailData(json?.item ?? null);
            const rawStr = json?.item?.result_md ?? '';
            if (rawStr) {
                try {
                    const parsed = JSON.parse(rawStr) as MarkdownStore;
                    setDetailMdStore(parsed);
                } catch (e) {
                    setDetailMdStore(null);
                    setDetailError('解析 result_md 失败，请检查返回格式');
                }
            }
        } catch (e) {
            setDetailError(e instanceof Error ? e.message : '未知错误');
            setDetailData(null);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [page, pageSize]);

    const buildHref = (nextPage: number) => `/result?page=${nextPage}&page_size=${pageSize}`;

    const formatTime = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    };

    const sections = useMemo(() => {
        const store = detailMdStore || {};
        return [
            { key: 'fit_markdown' as SectionKey, title: 'Fit Markdown', desc: '主用于展示/知识库', data: store.fit_markdown ?? [] },
            { key: 'raw_markdown' as SectionKey, title: 'Raw Markdown', desc: '原始清洗后文本', data: store.raw_markdown ?? [] },
            {
                key: 'markdown_with_citations' as SectionKey,
                title: 'Markdown with Citations',
                desc: '含引用标注',
                data: store.markdown_with_citations ?? [],
            },
        ];
    }, [detailMdStore]);

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

    return (
        <div className="px-6 pb-16">
            <div className="mx-auto mt-8 max-w-[108rem] space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">结果列表</h1>
                    <button
                        onClick={fetchList}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                    >
                        <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                    </button>
                </div>

                <Card className="overflow-hidden p-0">
                    {error && <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</div>}
                    <div className="overflow-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">site_name</th>
                                    <th className="px-4 py-3">url</th>
                                    <th className="px-4 py-3">crawled_at</th>
                                    <th className="px-4 py-3">llm_processed_at</th>
                                    <th className="px-4 py-3">is_crawled</th>
                                    <th className="px-4 py-3">crawl_count</th>
                                    <th className="px-4 py-3">page_count</th>
                                    <th className="px-4 py-3">chunk_count</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {(data?.items || []).map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-300">
                                            <Link href={`/result/detail?id=${item.id}`}>{item.id}</Link>
                                        </td>
                                        <td className="px-4 py-3">{item.site_name || '-'}</td>
                                        <td className="px-4 py-3 max-w-[520px] truncate" title={item.url}>
                                            {item.url}
                                        </td>
                                        <td className="px-4 py-3">{item.crawled_at ? new Date(item.crawled_at).toLocaleString() : '-'}</td>
                                        <td className="px-4 py-3">
                                            {item.llm_processed_at ? new Date(item.llm_processed_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-3">{item.is_crawled ? '1' : '0'}</td>
                                        <td className="px-4 py-3">{item.crawl_count}</td>
                                        <td className="px-4 py-3">{item.page_count}</td>
                                        <td className="px-4 py-3">
                                            {item.chunk_count}
                                            <button
                                                onClick={() => fetchDetail(item.id)}
                                                className="ml-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:text-indigo-200"
                                            >
                                                <FiInfo className="h-3 w-3" />
                                                详情
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && (data?.items || []).length === 0 && (
                                    <tr>
                                        <td className="px-4 py-10 text-center text-slate-500 dark:text-slate-400" colSpan={9}>
                                            暂无数据
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm dark:border-slate-800">
                        <div className="text-slate-600 dark:text-slate-300">
                            总数 {data?.total ?? '—'} · 第 {data?.page ?? page} / {totalPages} 页
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                aria-disabled={page <= 1}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${page <= 1
                                    ? 'cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                                    : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600'
                                    }`}
                                href={buildHref(Math.max(1, page - 1))}
                            >
                                <FiArrowLeft className="h-4 w-4" />
                                上一页
                            </Link>
                            <Link
                                aria-disabled={page >= totalPages}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${page >= totalPages
                                    ? 'cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                                    : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600'
                                    }`}
                                href={buildHref(Math.min(totalPages, page + 1))}
                            >
                                下一页
                                <FiArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </Card>
                {detailId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                        <div className="w-[min(90vw,880px)] max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                                    <FiInfo className="h-5 w-5 text-indigo-500" />
                                    <h3 className="text-lg font-semibold">详情（ID: {detailId}）</h3>
                                    {detailLoading && <span className="text-xs text-slate-500 dark:text-slate-400">加载中…</span>}
                                    {detailError && <span className="text-xs text-red-500">{detailError}</span>}
                                </div>
                                <button
                                    onClick={() => {
                                        setDetailId(null);
                                        setDetailData(null);
                                        setDetailError('');
                                    }}
                                    className="rounded-lg px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    关闭
                                </button>
                            </div>
                            <div className="grid gap-3 px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                                {detailData ? (
                                    <>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            <div>站点：{detailData.site_name ?? '—'}</div>
                                            <div>URL：{detailData.url}</div>
                                            <div>爬取：{detailData.is_crawled ? '已完成' : '未完成'}（次数 {detailData.crawl_count ?? 0}）</div>
                                        <div>页面数：{detailMdStore?.nums ?? detailData.page_count ?? 0} | 分块：{detailData.chunk_count ?? 0}</div>
                                        <div>抓取时间：{formatTime(detailData.crawled_at)}</div>
                                        <div>LLM时间：{formatTime(detailData.llm_processed_at)}</div>
                                        <div>创建：{formatTime(detailData.created_at)}</div>
                                        <div>更新：{formatTime(detailData.updated_at)}</div>
                                        </div>
                                    {!detailMdStore && <div className="text-xs text-slate-500 dark:text-slate-400">暂无 markdown 链接数据。</div>}
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
                                                    onClick={() => setOpenSection((prev) => (prev === sec.key ? null : sec.key))}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>{isOpen ? '▾' : '▸'}</span>
                                                        <span>{sec.title}</span>
                                                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                                            {sec.desc}（{sec.data.length} 个）
                                                        </span>
                                                    </div>
                                                </button>
                                                {isOpen && (
                                                    <div className="space-y-3 px-4 pb-4">
                                                        <div className="h-52 overflow-auto space-y-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
                                                            {sec.data.length === 0 && (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">暂无链接</div>
                                                            )}
                                                            {sec.data.map((u, idx) => (
                                                                <button
                                                                    key={`${sec.key}-${idx}-${u}`}
                                                                    onClick={() => handleLoadMD(u, sec.key, sec.title)}
                                                                    className="group flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                                                >
                                                                    <span className="truncate">{u || '空链接'}</span>
                                                                    <span className="text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">预览</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {isActivePreview && (
                                                            <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/70 p-4 dark:border-indigo-900/40 dark:bg-slate-900/70">
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
                                    </>
                                ) : (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {detailLoading ? '加载中...' : '暂无数据'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

