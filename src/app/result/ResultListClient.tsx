'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiArrowRight, FiInfo, FiPlay, FiRefreshCw } from 'react-icons/fi';
import { API_BASE } from '@/config/api';

type CrawlJobMeta = {
    job_id: string;
    status: string;
    discovered_count: number;
    queued_count: number;
    crawled_count: number;
    failed_count: number;
    current_depth: number;
    error_message?: string | null;
    created_at: string;
    started_at?: string | null;
    updated_at: string;
    finished_at?: string | null;
};

type ResultItem = {
    id: number;
    name?: string | null;
    site_name?: string | null;
    url: string;
    crawled_at: string | null;
    llm_processed_at: string | null;
    is_crawled: boolean;
    crawl_count: number;
    page_count: number;
    graph_json?: string | null;
    crawl_duration_ms?: number;
    llm_duration_ms?: number;
    created_at?: string | null;
    updated_at?: string | null;
    crawl_job?: CrawlJobMeta | null;
};

type ResultListResponse = {
    items: ResultItem[];
    total: number;
    page: number;
    page_size: number;
};

type QueueAckResponse = {
    queued: number;
    queue_key: string;
    pending: number;
};

type ResultDetail = ResultItem;

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
    const [graphLoadingId, setGraphLoadingId] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [crawlSubmitting, setCrawlSubmitting] = useState(false);
    const [crawlFeedback, setCrawlFeedback] = useState('');
    const [crawlError, setCrawlError] = useState('');

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
        try {
            const res = await fetch(`${API_BASE}/api/results/${id}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`请求失败：${res.status}`);
            const json = (await res.json()) as { item?: ResultDetail };
            setDetailData(json?.item ?? null);
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

    useEffect(() => {
        if (!data?.items?.length) {
            setSelectedIds([]);
            return;
        }
        const idSet = new Set(data.items.map((item) => item.id));
        setSelectedIds((prev) => prev.filter((id) => idSet.has(id)));
    }, [data]);

    const allIds = useMemo(() => (data?.items || []).map((item) => item.id), [data]);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

    const toggleSelectAll = () => {
        if (!allIds.length) return;
        if (allSelected) {
            setSelectedIds((prev) => prev.filter((id) => !allIds.includes(id)));
            return;
        }
        setSelectedIds((prev) => Array.from(new Set([...prev, ...allIds])));
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    };

    const buildHref = (nextPage: number) => `/result?page=${nextPage}&page_size=${pageSize}`;

    const formatTime = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    };

    const normalizeStatus = (value?: string | null) => (value || '').trim().toLowerCase();

    const isCrawlDone = (item: ResultItem) => {
        const status = normalizeStatus(item.crawl_job?.status);
        if (status) {
            return ['done', 'completed', 'success', 'succeeded', 'finished'].includes(status);
        }
        return item.is_crawled;
    };

    const formatStatus = (item: ResultItem) => {
        const status = item.crawl_job?.status?.trim();
        if (status) return status;
        return item.is_crawled ? 'completed' : 'pending';
    };

    const formatProgress = (job?: CrawlJobMeta | null) => {
        if (!job) return '—';
        if (job.discovered_count > 0) {
            return `${job.crawled_count}/${job.discovered_count}`;
        }
        if (job.crawled_count > 0) {
            return `${job.crawled_count}`;
        }
        return '0';
    };

    const pickUpdatedAt = (item: ResultItem) => item.crawl_job?.updated_at || item.updated_at || null;

    const handleBuildGraph = async (id: number) => {
        setGraphLoadingId(id);
        try {
            const res = await fetch(`${API_BASE}/api/results/graph`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            const json = (await res.json()) as QueueAckResponse & { error?: string };
            if (!res.ok) {
                throw new Error(json?.error || '请求失败');
            }
            alert(`图谱生成已入队，队列 ${json.queue_key} 待处理 ${json.pending ?? 0} 条`);
        } catch (e) {
            alert(`图谱生成失败：${e instanceof Error ? e.message : '未知错误'}`);
        } finally {
            setGraphLoadingId(null);
        }
    };

    const handleEnqueueCrawl = async () => {
        if (!selectedIds.length) return;
        setCrawlSubmitting(true);
        setCrawlFeedback('');
        setCrawlError('');
        try {
            const res = await fetch(`${API_BASE}/api/tasks/crawl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
            });
            const json = (await res.json()) as QueueAckResponse & { error?: string };
            if (!res.ok) {
                throw new Error(json?.error || '请求失败');
            }
            setCrawlFeedback(`已加入队列 ${json.queued} 条，当前待处理 ${json.pending ?? 0} 条`);
            setSelectedIds([]);
            fetchList();
        } catch (e) {
            setCrawlError(e instanceof Error ? e.message : '未知错误');
        } finally {
            setCrawlSubmitting(false);
        }
    };

    return (
        <div className="px-6 pb-16">
            <div className="mx-auto mt-8 max-w-[108rem] space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">结果列表</h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleEnqueueCrawl}
                            disabled={crawlSubmitting || selectedIds.length === 0}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:border-emerald-700"
                        >
                            <FiPlay className={`h-4 w-4 ${crawlSubmitting ? 'animate-spin' : ''}`} />
                            Crawl{selectedIds.length ? ` (${selectedIds.length})` : ''}
                        </button>
                        <button
                            onClick={fetchList}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                        >
                            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            刷新
                        </button>
                    </div>
                </div>

                <Card className="overflow-hidden p-0">
                    {error && <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</div>}
                    {crawlError && (
                        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                            Crawl 入队失败：{crawlError}
                        </div>
                    )}
                    {crawlFeedback && (
                        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
                            {crawlFeedback}
                        </div>
                    )}
                    <div className="overflow-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleSelectAll}
                                            aria-label="全选"
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">名称</th>
                                    <th className="px-4 py-3">url</th>
                                    <th className="px-4 py-3">crawl_status</th>
                                    <th className="px-4 py-3">progress</th>
                                    <th className="px-4 py-3">page_count</th>
                                    <th className="px-4 py-3">updated_at</th>
                                    <th className="px-4 py-3">action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {(data?.items || []).map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                aria-label={`选择任务 ${item.id}`}
                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-300">
                                            <Link href={`/result/detail?id=${item.id}`}>{item.id}</Link>
                                        </td>
                                        <td className="px-4 py-3">{item.name || item.site_name || '-'}</td>
                                        <td className="px-4 py-3 max-w-[520px] truncate" title={item.url}>
                                            {item.url}
                                        </td>
                                        <td className="px-4 py-3">{formatStatus(item)}</td>
                                        <td className="px-4 py-3">{formatProgress(item.crawl_job)}</td>
                                        <td className="px-4 py-3">{item.page_count ?? 0}</td>
                                        <td className="px-4 py-3">{formatTime(pickUpdatedAt(item))}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => fetchDetail(item.id)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:text-indigo-200"
                                                >
                                                    <FiInfo className="h-3 w-3" />
                                                    详情
                                                </button>
                                                <button
                                                    onClick={() => handleBuildGraph(item.id)}
                                                    disabled={graphLoadingId === item.id || !isCrawlDone(item)}
                                                    title={!isCrawlDone(item) ? '任务未完成，暂不可抽取' : undefined}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:border-emerald-700"
                                                >
                                                    <FiRefreshCw className={`h-3 w-3 ${graphLoadingId === item.id ? 'animate-spin' : ''}`} />
                                                    图谱生成
                                                </button>
                                            </div>
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
                                            <div>站点：{detailData.name ?? detailData.site_name ?? '—'}</div>
                                            <div>URL：{detailData.url}</div>
                                            <div>任务状态：{formatStatus(detailData)}</div>
                                            <div>重试次数：{detailData.crawl_count ?? 0}</div>
                                            <div>页面数：{detailData.page_count ?? 0}</div>
                                            <div>抓取时间：{formatTime(detailData.crawled_at || detailData.crawl_job?.finished_at)}</div>
                                            <div>任务更新时间：{formatTime(detailData.crawl_job?.updated_at || detailData.updated_at)}</div>
                                            <div>抽取时间：{formatTime(detailData.llm_processed_at)}</div>
                                            <div>抽取耗时：{detailData.llm_duration_ms ? `${detailData.llm_duration_ms} ms` : '—'}</div>
                                            <div className="md:col-span-2">
                                                图谱 JSON（graph_json）：
                                                <div className="mt-1 max-h-36 overflow-auto rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                    {detailData.graph_json || '—'}
                                                </div>
                                            </div>
                                        </div>
                                        {detailData.crawl_job ? (
                                            <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                                                <div>job_id：{detailData.crawl_job.job_id}</div>
                                                <div>进度：{formatProgress(detailData.crawl_job)} | 失败 {detailData.crawl_job.failed_count}</div>
                                                <div>当前深度：{detailData.crawl_job.current_depth}</div>
                                                <div>开始：{formatTime(detailData.crawl_job.started_at)} | 完成：{formatTime(detailData.crawl_job.finished_at)}</div>
                                                {detailData.crawl_job.error_message && (
                                                    <div className="mt-1 text-red-500">错误：{detailData.crawl_job.error_message}</div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500 dark:text-slate-400">暂无 crawl_job 记录。</div>
                                        )}
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
