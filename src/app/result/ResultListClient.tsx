'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiArrowRight, FiDownload, FiInfo, FiPlay, FiRefreshCw } from 'react-icons/fi';
import { getStoredToken, openAuthDialog, subscribeAuthToken } from '@/components/auth/authStorage';
import { API_BASE } from '@/config/api';
import SiteDetailContent from './SiteDetailContent';
import {
    buildResultListHref,
    DEFAULT_RESULT_SORT,
    RESULT_LIST_LAST_HREF_EVENT,
    normalizeResultSort,
    RESULT_LIST_LAST_HREF_STORAGE_KEY,
    type ResultSortOption,
} from './resultListNavigation';
import {
    canBuildGraph,
    formatDuration,
    formatStatus,
    getSiteDisplayName,
    type ProcessedMarkdownResponse,
    type ResultDetailResponse,
    type ResultListResponse,
    type SiteResultItem,
} from './siteResult';

type QueueAckResponse = {
    queued: number;
    queue_key: string;
    pending: number;
};

const clampInt = (value: string | null, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
};

// 结果列表列宽比例统一在这里调整。
const RESULT_TABLE_COLUMN_WIDTHS = {
    select: '2%',
    id: '6%',
    siteName: '14%',
    url: '20%',
    status: '10%',
    pageCount: '9%',
    crawlDuration: '10%',
    graphDuration: '11%',
    processedMarkdown: '9%',
    action: '9%',
} as const;

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div
        className={`glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70 ${className}`}
    >
        {children}
    </div>
);

export default function ResultListClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const page = useMemo(() => clampInt(searchParams.get('page'), 1, 1, 10_000), [searchParams]);
    const pageSize = 10;
    const sort = useMemo(() => normalizeResultSort(searchParams.get('sort')), [searchParams]);

    const [authToken, setAuthToken] = useState('');
    const [data, setData] = useState<ResultListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [detailId, setDetailId] = useState<number | null>(null);
    const [detailData, setDetailData] = useState<SiteResultItem | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [processedMdError, setProcessedMdError] = useState('');
    const [processedMdPendingId, setProcessedMdPendingId] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [crawlSubmitting, setCrawlSubmitting] = useState(false);
    const [crawlFeedback, setCrawlFeedback] = useState('');
    const [crawlError, setCrawlError] = useState('');
    const [graphSubmitting, setGraphSubmitting] = useState(false);
    const [graphFeedback, setGraphFeedback] = useState('');
    const [graphError, setGraphError] = useState('');

    const totalPages = useMemo(() => {
        if (!data) return 1;
        return Math.max(1, Math.ceil((data.total || 0) / (data.page_size || pageSize)));
    }, [data, pageSize]);

    const buildHref = (nextPage: number, nextSort: ResultSortOption = sort) =>
        buildResultListHref(nextPage, pageSize, nextSort);

    const buildAdminHeaders = () => {
        const token = authToken.trim() || getStoredToken().trim();
        if (!token) {
            openAuthDialog();
            throw new Error('请先登录管理员账号');
        }
        return {
            Authorization: `Bearer ${token}`,
        };
    };

    useEffect(() => {
        setAuthToken(getStoredToken());
        return subscribeAuthToken((token) => setAuthToken(token));
    }, []);

    const fetchList = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/results?page=${page}&page_size=${pageSize}&sort=${sort}`, {
                cache: 'no-store',
                headers: buildAdminHeaders(),
            });
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
        setDetailData(null);
        setDetailLoading(true);
        setDetailError('');
        try {
            const res = await fetch(`${API_BASE}/api/results/${id}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`请求失败：${res.status}`);
            const json = (await res.json()) as ResultDetailResponse;
            setDetailData(json?.item ?? null);
        } catch (e) {
            setDetailError(e instanceof Error ? e.message : '未知错误');
            setDetailData(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const downloadProcessedMarkdown = async (id: number) => {
        setProcessedMdError('');
        setProcessedMdPendingId(id);
        try {
            const res = await fetch(`${API_BASE}/api/results/${id}/processed_markdown`, { cache: 'no-store' });
            const json = (await res.json()) as ProcessedMarkdownResponse & { error?: string };
            if (!res.ok) {
                throw new Error(json?.error || `请求失败：${res.status}`);
            }

            const fileName = `site_${id}_processed.md`;
            const blob = new Blob([json.processed_markdown || ''], { type: 'text/markdown;charset=utf-8' });
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch (e) {
            setProcessedMdError(e instanceof Error ? e.message : '未知错误');
        } finally {
            setProcessedMdPendingId(null);
        }
    };

    useEffect(() => {
        fetchList();
    }, [page, pageSize, sort]);

    useEffect(() => {
        try {
            const href = buildHref(page, sort);
            sessionStorage.setItem(RESULT_LIST_LAST_HREF_STORAGE_KEY, href);
            window.dispatchEvent(new CustomEvent(RESULT_LIST_LAST_HREF_EVENT, { detail: { href } }));
        } catch {
            // ignore sessionStorage write error
        }
    }, [page, sort]);

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

    const selectedItems = useMemo(() => {
        if (!data?.items?.length) return [];
        const idSet = new Set(selectedIds);
        return data.items.filter((item) => idSet.has(item.id));
    }, [data, selectedIds]);

    const selectedGraphIds = useMemo(
        () => selectedItems.filter(canBuildGraph).map((item) => item.id),
        [selectedItems],
    );

    const handleSortChange = (nextSort: ResultSortOption) => {
        router.push(buildHref(1, nextSort), { scroll: false });
    };

    const handleBuildGraphBatch = async () => {
        if (!selectedGraphIds.length) return;
        setGraphSubmitting(true);
        setGraphFeedback('');
        setGraphError('');
        try {
            const headers = new Headers(buildAdminHeaders());
            headers.set('Content-Type', 'application/json');
            const res = await fetch(`${API_BASE}/api/results/graph/batch`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ids: selectedGraphIds }),
            });
            const json = (await res.json()) as QueueAckResponse & { error?: string };
            if (!res.ok) {
                throw new Error(json?.error || '请求失败');
            }
            setGraphFeedback(`图谱生成已入队 ${json.queued} 条，当前待处理 ${json.pending ?? 0} 条`);
            setSelectedIds((prev) => prev.filter((id) => !selectedGraphIds.includes(id)));
            fetchList();
        } catch (e) {
            setGraphError(e instanceof Error ? e.message : '未知错误');
        } finally {
            setGraphSubmitting(false);
        }
    };

    const handleEnqueueCrawl = async () => {
        if (!selectedIds.length) return;
        setCrawlSubmitting(true);
        setCrawlFeedback('');
        setCrawlError('');
        try {
            const headers = new Headers(buildAdminHeaders());
            headers.set('Content-Type', 'application/json');
            const res = await fetch(`${API_BASE}/api/tasks/crawl`, {
                method: 'POST',
                headers,
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

    const handleOpenGraph = () => {
        if (!detailId) return;
        const target = `/result/detail/graph?id=${encodeURIComponent(String(detailId))}`;
        window.open(target, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="px-6 pb-16">
            <div className="mx-auto mt-1 max-w-[108rem] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">结果列表</h1>
                        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                            <span className="font-medium">排序</span>
                            <select
                                value={sort}
                                onChange={(event) => handleSortChange(normalizeResultSort(event.target.value))}
                                className="bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-white"
                            >
                                <option value={DEFAULT_RESULT_SORT}>ID 从小到大</option>
                                <option value="id_desc">ID 从大到小</option>
                            </select>
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleEnqueueCrawl}
                            disabled={crawlSubmitting || selectedIds.length === 0}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:border-emerald-700"
                        >
                            <FiPlay className={`h-4 w-4 ${crawlSubmitting ? 'animate-spin' : ''}`} />
                            重新爬取{selectedIds.length ? ` (${selectedIds.length})` : ''}
                        </button>
                        <button
                            onClick={handleBuildGraphBatch}
                            disabled={graphSubmitting || selectedGraphIds.length === 0}
                            title={
                                selectedIds.length > 0 && selectedGraphIds.length === 0
                                    ? '请先选择可构图记录：CRAWLED 状态可直接构图；GRAPH_FAILED 或 GRAPH_CANCELLED 需已有 PROCESSED_MD'
                                    : undefined
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200 dark:hover:border-indigo-700"
                        >
                            <FiRefreshCw className={`h-4 w-4 ${graphSubmitting ? 'animate-spin' : ''}`} />
                            构建图谱{selectedGraphIds.length ? ` (${selectedGraphIds.length})` : ''}
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
                            爬取入队失败：{crawlError}
                        </div>
                    )}
                    {crawlFeedback && (
                        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
                            {crawlFeedback}
                        </div>
                    )}
                    {graphError && (
                        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                            图谱生成失败：{graphError}
                        </div>
                    )}
                    {graphFeedback && (
                        <div className="border-b border-indigo-200 bg-indigo-50 px-5 py-3 text-sm text-indigo-700">
                            {graphFeedback}
                        </div>
                    )}
                    {processedMdError && (
                        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                            PROCESSED_MD 下载失败：{processedMdError}
                        </div>
                    )}
                    <div className="overflow-auto">
                        <table className="w-full table-fixed text-left text-sm">
                            <colgroup>
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.select }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.id }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.siteName }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.url }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.status }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.pageCount }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.crawlDuration }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.graphDuration }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.processedMarkdown }} />
                                <col style={{ width: RESULT_TABLE_COLUMN_WIDTHS.action }} />
                            </colgroup>
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
                                    <th className="px-4 py-3">site_name</th>
                                    <th className="px-4 py-3">url</th>
                                    <th className="px-4 py-3">status</th>
                                    <th className="px-4 py-3">page_count</th>
                                    <th className="px-4 py-3">爬取用时(分钟)</th>
                                    <th className="px-4 py-3">构建图谱用时(分钟)</th>
                                    <th className="px-4 py-3">PROCESSED_MD</th>
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
                                        <td className="px-4 py-3 overflow-hidden">
                                            <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap" title={getSiteDisplayName(item)}>
                                                {getSiteDisplayName(item)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 overflow-hidden" title={item.url}>
                                            <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap">
                                                {item.url}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{formatStatus(item.status)}</td>
                                        <td className="px-4 py-3">{item.page_count ?? 0}</td>
                                        <td className="px-4 py-3">{formatDuration(item.crawl_duration_ms)}</td>
                                        <td className="px-4 py-3">{formatDuration(item.graph_duration_ms)}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => downloadProcessedMarkdown(item.id)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-700 dark:hover:text-emerald-200"
                                            >
                                                <FiDownload className={`h-3 w-3 ${processedMdPendingId === item.id ? 'animate-spin' : ''}`} />
                                                下载
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => fetchDetail(item.id)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:text-indigo-200"
                                                >
                                                    <FiInfo className="h-3 w-3" />
                                                    详情
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && (data?.items || []).length === 0 && (
                                    <tr>
                                        <td className="px-4 py-10 text-center text-slate-500 dark:text-slate-400" colSpan={10}>
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
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                    page <= 1
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
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                    page >= totalPages
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
                        <div className="max-h-[90vh] w-[min(90vw,980px)] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
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
                            <div className="max-h-[calc(90vh-4rem)] overflow-auto px-5 py-4">
                                {detailLoading && !detailData ? (
                                    <div className="text-sm text-slate-500 dark:text-slate-400">加载中...</div>
                                ) : (
                                    <SiteDetailContent item={detailData} onOpenGraph={handleOpenGraph} />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
