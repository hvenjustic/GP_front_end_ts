'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';

const API_BASE = process.env.NEXT_PUBLIC_GO_API ?? 'http://www.hvenjustic.top:5010';

export default function ResultDetailClient() {
  const searchParams = useSearchParams();
  const id = useMemo(() => searchParams.get('id')?.trim() || '', [searchParams]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<unknown>(null);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/results/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      const json = (await res.json()) as unknown;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

        <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
          <pre className="max-h-[70vh] overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 shadow-inner">
            {data ? JSON.stringify(data, null, 2) : loading ? '加载中...' : id ? '暂无数据' : '—'}
          </pre>
        </div>
      </div>
    </div>
  );
}


