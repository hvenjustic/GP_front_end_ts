export const RESULT_LIST_LAST_HREF_STORAGE_KEY = 'result-list:last-href';
export const RESULT_LIST_LAST_HREF_EVENT = 'result-list:last-href-changed';

export const RESULT_SORT_OPTIONS = ['id_asc', 'id_desc'] as const;

export type ResultSortOption = (typeof RESULT_SORT_OPTIONS)[number];

export const DEFAULT_RESULT_SORT: ResultSortOption = 'id_asc';

export function normalizeResultSort(value: string | null | undefined): ResultSortOption {
    if (!value) return DEFAULT_RESULT_SORT;
    return RESULT_SORT_OPTIONS.includes(value as ResultSortOption)
        ? (value as ResultSortOption)
        : DEFAULT_RESULT_SORT;
}

export function buildResultListHref(page: number, pageSize: number, sort: ResultSortOption): string {
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.max(1, Math.floor(pageSize));
    return `/result?page=${safePage}&page_size=${safePageSize}&sort=${sort}`;
}
