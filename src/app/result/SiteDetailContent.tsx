'use client';

import type { ReactNode } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import {
    formatDuration,
    formatJson,
    formatStatus,
    formatTime,
    type SiteResultItem,
} from './siteResult';

type SiteDetailContentProps = {
    item?: SiteResultItem | null;
    onOpenGraph?: (() => void) | null;
};

type DetailField = {
    label: string;
    value: ReactNode;
    fullWidth?: boolean;
};

const DetailCard = ({ label, value, fullWidth = false }: DetailField) => (
    <div
        className={`rounded-xl border border-slate-200 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 ${
            fullWidth ? 'md:col-span-2' : ''
        }`}
    >
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-2 break-words text-sm text-slate-800 dark:text-slate-100">{value}</div>
    </div>
);

export default function SiteDetailContent({ item, onOpenGraph }: SiteDetailContentProps) {
    if (!item) {
        return <div className="text-sm text-slate-500 dark:text-slate-400">暂无数据</div>;
    }

    const fields: DetailField[] = [
        { label: 'id', value: item.id },
        { label: 'site_name', value: item.site_name?.trim() || '—' },
        { label: 'url', value: item.url || '—' },
        { label: 'status', value: formatStatus(item.status) },
        { label: 'job_id', value: item.job_id?.trim() || '—' },
        { label: 'crawl_task_id', value: item.crawl_task_id?.trim() || '—' },
        { label: 'graph_task_id', value: item.graph_task_id?.trim() || '—' },
        { label: 'crawl_count', value: item.crawl_count ?? 0 },
        { label: 'page_count', value: item.page_count ?? 0 },
        { label: 'crawled_at', value: formatTime(item.crawled_at) },
        { label: 'graph_built_at', value: formatTime(item.graph_built_at) },
        { label: 'crawl_duration_ms', value: formatDuration(item.crawl_duration_ms) },
        { label: 'graph_duration_ms', value: formatDuration(item.graph_duration_ms) },
        { label: 'created_at', value: formatTime(item.created_at) },
        { label: 'updated_at', value: formatTime(item.updated_at) },
        {
            label: 'error_message',
            value: item.error_message?.trim() || '—',
            fullWidth: true,
        },
        {
            label: 'geo_location',
            value: (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {formatJson(item.geo_location)}
                </pre>
            ),
            fullWidth: true,
        },
        {
            label: 'graph_json',
            value: (
                <div className="space-y-2">
                    <div>
                        <button
                            onClick={onOpenGraph || undefined}
                            disabled={!onOpenGraph || !item.graph_json}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:border-emerald-700"
                        >
                            <FiExternalLink className="h-4 w-4" />
                            图渲染
                        </button>
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {formatJson(item.graph_json)}
                    </pre>
                </div>
            ),
            fullWidth: true,
        },
    ];

    return (
        <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
                <DetailCard
                    key={field.label}
                    label={field.label}
                    value={field.value}
                    fullWidth={field.fullWidth}
                />
            ))}
        </div>
    );
}
