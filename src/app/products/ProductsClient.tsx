'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiArrowUpRight,
  FiRefreshCw,
  FiSearch,
  FiGlobe,
  FiActivity,
  FiChevronDown
} from 'react-icons/fi';
import { API_BASE } from '@/config/api';
import ProductGraph from './ProductGraph';

type Task = {
  id: number;
  name: string;
  site_name: string;
  url: string;
  is_crawled: boolean;
  crawl_count: number;
  page_count: number;
  created_at: string;
};

type ListResultsResponse = {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
};

export default function ProductsClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/results?page=1&page_size=100`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = (await res.json()) as ListResultsResponse;
      setTasks(data.items || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filtered = useMemo(() => {
    const matchSearch = (text: string) => text.toLowerCase().includes(search.trim().toLowerCase());
    if (!search.trim()) return tasks;
    return tasks.filter((task) => 
      matchSearch(task.name || '') || 
      matchSearch(task.site_name || '') || 
      matchSearch(task.url || '')
    );
  }, [tasks, search]);

  return (
    <div className="relative isolate px-6 pb-16">
      <section className="mx-auto mt-8 max-w-[108rem] overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-8 shadow-lg backdrop-blur md:p-12 dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
              <FiGlobe className="h-4 w-4" />
              站点任务
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                站点任务列表
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                查看已提交的站点任务，点击列表项展开查看详细的知识图谱可视化。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-500"
              >
                前往任务列表
                <FiArrowUpRight className="h-4 w-4" />
              </a>
              <button
                onClick={fetchTasks}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新列表
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-[108rem]" id="catalog">
        <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <FiSearch className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索任务名称、站点或 URL"
                className="w-full bg-transparent outline-none placeholder:text-slate-400 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <span>
            共 {filtered.length} 个任务
            {search ? `，已根据「${search}」过滤` : ''}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {filtered.map((task) => (
            <div
              key={task.id}
              className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 shadow-sm transition hover:shadow-md dark:border-gray-800/60 dark:bg-slate-900/70"
            >
              <div 
                className="flex cursor-pointer items-center justify-between p-5"
                onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
              >
                 <div className="flex flex-col gap-1">
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      {task.name || '未命名任务'}
                    </span>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <FiGlobe className="h-4 w-4" />
                      <span className="truncate max-w-md">{task.url}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <FiChevronDown 
                      className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${expandedTaskId === task.id ? 'rotate-180' : ''}`} 
                    />
                 </div>
              </div>

              {expandedTaskId === task.id && (
                <div className="border-t border-slate-100 p-5 dark:border-slate-800">
                  <ProductGraph id={String(task.id)} isEmbedded={true} />
                </div>
              )}
            </div>
          ))}
        </div>

        {!loading && !filtered.length && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            未找到匹配的任务，请调整搜索条件或刷新列表。
          </div>
        )}
      </section>
    </div>
  );
}
