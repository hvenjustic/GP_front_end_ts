export type SiteResultItem = {
    id: number;
    name?: string | null;
    site_name?: string | null;
    url: string;
    geo_location?: unknown;
    status: string;
    job_id?: string | null;
    crawl_task_id?: string | null;
    graph_task_id?: string | null;
    error_message?: string | null;
    crawl_count: number;
    page_count: number;
    crawled_at?: string | null;
    graph_built_at?: string | null;
    crawl_duration_ms?: number | null;
    graph_duration_ms?: number | null;
    graph_json?: string | null;
    has_processed_markdown?: boolean;
    created_at?: string | null;
    updated_at?: string | null;
};

export type ResultListResponse = {
    items: SiteResultItem[];
    total: number;
    page: number;
    page_size: number;
};

export type ResultDetailResponse = {
    item?: SiteResultItem | null;
};

export type ProcessedMarkdownResponse = {
    site_id: number;
    site_url: string;
    root_url: string;
    processed_markdown: string;
    generated: boolean;
};

const GRAPH_BUILDABLE_STATUSES = new Set(['CRAWLED', 'GRAPH_FAILED', 'GRAPH_CANCELLED']);

export const getSiteDisplayName = (item?: Pick<SiteResultItem, 'name' | 'site_name'> | null) => {
    const primary = item?.name?.trim();
    if (primary) return primary;
    const secondary = item?.site_name?.trim();
    if (secondary) return secondary;
    return '—';
};

export const normalizeStatus = (value?: string | null) => (value || '').trim().toUpperCase();

export const canBuildGraph = (item: SiteResultItem) => {
    const status = normalizeStatus(item.status);
    if (status === 'CRAWLED') return true;
    return Boolean(item.has_processed_markdown) && GRAPH_BUILDABLE_STATUSES.has(status);
};

export const formatStatus = (value?: string | null) => value?.trim() || '—';

export const formatTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const formatDuration = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    const minutes = value / 60_000;
    const display = minutes >= 1 ? minutes.toFixed(2) : minutes.toFixed(3);
    return `${display} 分钟`;
};

export const formatJson = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return '—';
        try {
            return JSON.stringify(JSON.parse(text), null, 2);
        } catch {
            return text;
        }
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};
