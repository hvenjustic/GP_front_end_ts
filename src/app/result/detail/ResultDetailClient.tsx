'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiRefreshCw, FiExternalLink } from 'react-icons/fi';

const API_BASE = process.env.NEXT_PUBLIC_GO_API ?? 'http://www.hvenjustic.top:4010';

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
    id?: number | string;
    url?: string;
    site_name?: string | null;
    graph_json?: string | null;
    crawled_at?: string | null;
    llm_processed_at?: string | null;
    page_count?: number;
    is_crawled?: boolean;
    crawl_count?: number;
    crawl_duration_ms?: number;
    llm_duration_ms?: number;
    created_at?: string | null;
    updated_at?: string | null;
    crawl_job?: CrawlJobMeta | null;
};

type ResultDetailResponse = {
    item?: ResultItem;
};


export default function ResultDetailClient() {
    const searchParams = useSearchParams();
    const id = useMemo(() => searchParams.get('id')?.trim() || '', [searchParams]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState<ResultDetailResponse | null>(null);

    const fetchDetail = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/results/${encodeURIComponent(id)}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`请求失败：${res.status}`);
            const json = (await res.json()) as ResultDetailResponse;
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : '未知错误');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const formatTime = (value?: string | null) => {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    };

    const formatStatus = (item?: ResultItem | null) => {
        if (!item) return '—';
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

    const detail = data?.item;

    const handleOpenGraph = () => {
        if (!id) return;
        const target = `/result/detail/graph?id=${encodeURIComponent(id)}`;
        window.open(target, '_blank', 'noopener,noreferrer');
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
                        <div>任务状态：{formatStatus(detail)}</div>
                        <div>重试次数：{detail?.crawl_count ?? 0}</div>
                        <div>页面数：{detail?.page_count ?? detail?.crawl_job?.crawled_count ?? 0}</div>
                        <div>抓取时间：{formatTime(detail?.crawled_at || detail?.crawl_job?.finished_at)}</div>
                        <div>任务更新时间：{formatTime(detail?.crawl_job?.updated_at || detail?.updated_at)}</div>
                        <div>抓取耗时：{detail?.crawl_duration_ms ? `${detail.crawl_duration_ms} ms` : '—'}</div>
                        <div>抽取时间：{formatTime(detail?.llm_processed_at)}</div>
                        <div>抽取耗时：{detail?.llm_duration_ms ? `${detail.llm_duration_ms} ms` : '—'}</div>
                        <div>创建：{formatTime(detail?.created_at)}</div>
                        <div>更新：{formatTime(detail?.updated_at)}</div>
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
                    {detail?.crawl_job ? (
                        <div className="rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                            <div>job_id：{detail.crawl_job.job_id}</div>
                            <div>进度：{formatProgress(detail.crawl_job)} | 失败 {detail.crawl_job.failed_count}</div>
                            <div>当前深度：{detail.crawl_job.current_depth}</div>
                            <div>开始：{formatTime(detail.crawl_job.started_at)} | 完成：{formatTime(detail.crawl_job.finished_at)}</div>
                            {detail.crawl_job.error_message && <div className="mt-1 text-red-500">错误：{detail.crawl_job.error_message}</div>}
                        </div>
                    ) : (
                        <div className="text-sm text-slate-500 dark:text-slate-400">暂无 crawl_job 记录。</div>
                    )}
                </div>
            </div>
        </div>
    );
}
