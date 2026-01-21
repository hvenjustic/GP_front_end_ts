'use client';
import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiList,
  FiRefreshCw,
  FiSend,
  FiServer,
  FiTrash2
} from 'react-icons/fi';
import { API_BASE } from '@/config/api';

type CrawlResponse = {
  created: number;
};

type StatusResponse = {
  pending: number;
  queue_key: string;
};

type ClearQueueResponse = {
  queue_name: string;
  removed_keys: number;
};

const DEFAULT_QUEUE_KEY = 'crawl4ai:queue';
const ACTIVE_SET_KEY = 'crawl4ai:active';
const PREPROCESS_QUEUE_KEY = 'kg:preprocess:queue';
const PREPROCESS_ACTIVE_KEY = 'kg:preprocess:active';
const GRAPH_QUEUE_KEY = 'kg:graph:queue';
const GRAPH_ACTIVE_KEY = 'kg:graph:active';

const Card = ({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) => (
  <div
    id={id}
    className={`glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70 ${className}`}
  >
    {children}
  </div>
);

export default function TaskPage() {
  const [urlsText, setUrlsText] = useState('示例站点 https://example.com');
  const [pending, setPending] = useState<number | null>(null);
  const [queueKey, setQueueKey] = useState(DEFAULT_QUEUE_KEY);
  const [preprocessPending, setPreprocessPending] = useState<number | null>(null);
  const [preprocessQueueKey, setPreprocessQueueKey] = useState(PREPROCESS_QUEUE_KEY);
  const [preprocessLastUpdate, setPreprocessLastUpdate] = useState<number | null>(null);
  const [graphPending, setGraphPending] = useState<number | null>(null);
  const [graphQueueKey, setGraphQueueKey] = useState(GRAPH_QUEUE_KEY);
  const [graphLastUpdate, setGraphLastUpdate] = useState<number | null>(null);
  const [autoPoll, setAutoPoll] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildPayload = () => {
    const normalized = urlsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!normalized.length) {
      throw new Error('请至少输入一条任务（名称 + URL）');
    }

    const urls = normalized.map((line, index) => {
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        throw new Error(`第 ${index + 1} 行格式不正确，需要“名称 URL”`);
      }
      const url = parts[parts.length - 1];
      const name = parts.slice(0, -1).join(' ');
      return { name, url };
    });

    return {
      urls
    };
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/status`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`状态查询失败：${res.status}`);
      }
      const data = (await res.json()) as StatusResponse;
      setPending(data.pending);
      setQueueKey(data.queue_key);
      setLastUpdate(Date.now());
      setError('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(`无法获取任务进度：${msg}`);
    }
  }, []);

  const fetchPreprocessStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/results/preprocess/status`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`状态查询失败：${res.status}`);
      }
      const data = (await res.json()) as StatusResponse;
      setPreprocessPending(data.pending);
      setPreprocessQueueKey(data.queue_key);
      setPreprocessLastUpdate(Date.now());
      setError('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(`无法获取预处理进度：${msg}`);
    }
  }, []);

  const fetchGraphStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/results/graph/status`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`状态查询失败：${res.status}`);
      }
      const data = (await res.json()) as StatusResponse;
      setGraphPending(data.pending);
      setGraphQueueKey(data.queue_key);
      setGraphLastUpdate(Date.now());
      setError('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(`无法获取图谱生成进度：${msg}`);
    }
  }, []);

  const fetchAllStatus = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchPreprocessStatus(), fetchGraphStatus()]);
  }, [fetchGraphStatus, fetchPreprocessStatus, fetchStatus]);

  const clearQueue = useCallback(
    async (targetKey: string, label: string) => {
      setClearing(targetKey);
      setFeedback('');
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/queues/clear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queue_name: targetKey })
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `清空失败：${res.status}`);
        }
        const data = (await res.json()) as ClearQueueResponse;
        setFeedback(`${label}已清空，删除键 ${data.removed_keys ?? 0} 个`);
        await fetchAllStatus();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '未知错误';
        setError(`清空队列失败：${msg}`);
      } finally {
        setClearing(null);
      }
    },
    [fetchAllStatus]
  );

  useEffect(() => {
    if (autoPoll) {
      fetchAllStatus();
      pollingRef.current = setInterval(fetchAllStatus, 10000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [autoPoll, fetchAllStatus]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback('');
    setError('');
    let payload;
    try {
      payload = buildPayload();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : '请求体构建失败');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `服务返回 ${res.status}`);
      }
      const data = (await res.json()) as CrawlResponse;
      setFeedback(`已录入 ${data.created} 条任务，请到结果页选择后点击 Crawl 启动`);
      await fetchAllStatus();
      setAutoPoll(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(`任务提交失败：${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const payloadPreview = useMemo(() => {
    try {
      return JSON.stringify(buildPayload(), null, 2);
    } catch {
      return JSON.stringify(
        {
          urls: [{ name: '示例站点', url: 'https://example.com' }]
        },
        null,
        2
      );
    }
  }, [urlsText]);

  return (
    <div className="relative isolate px-6 pb-16">
      <section className="mx-auto mt-8 max-w-[108rem] overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-8 shadow-lg backdrop-blur md:p-12 dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
              <FiServer className="h-4 w-4" />
              爬虫任务
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                创建任务并自动轮询进度
              </h1>
              <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-300">
                调用后端 <code>/api/tasks</code> 接口批量录入站点任务，录入后可在结果页勾选并点击 <strong>Crawl</strong> 开始入队。
                队列状态仍可通过 <code>/api/tasks/status</code> 查看，后端地址统一在 <code>src/config/api.ts</code> 中配置，也可通过环境变量 <code>NEXT_PUBLIC_PY_API</code> 覆盖。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#task-form"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-500"
              >
                开始创建
                <FiSend className="h-4 w-4" />
              </a>
              <button
                onClick={fetchAllStatus}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                <FiRefreshCw className="h-4 w-4" />
                立即拉取进度
              </button>
            </div>
          </div>
          <Card className="w-full max-w-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-200">
                <FiActivity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">当前待处理</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {pending ?? '—'} <span className="text-base font-semibold text-slate-500">条</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">队列键：{queueKey}</p>
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all"
                style={{ width: pending && pending > 0 ? '45%' : '10%' }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <FiClock className="h-4 w-4" />
              {lastUpdate ? `最近更新：${new Date(lastUpdate).toLocaleTimeString()}` : '尚未请求'}
            </div>
          </Card>
        </div>
      </section>

      <div className="mx-auto mt-8 grid max-w-[108rem] gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card id="task-form" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <FiList className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-semibold">创建任务</h2>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
              批量提交
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <label className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 px-2 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-200">
                    URL
                  </span>
                  每行一个任务：名称 + URL（空行将被忽略）
                </div>
                <textarea
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  placeholder="华润医药 https://www.crpcg.com/\n信立泰 https://www.salubris.com/"
                  className="h-44 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-indigo-400 dark:focus:ring-indigo-900"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">支持批量粘贴，名称与 URL 之间可用空格或 Tab 分隔</p>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100">
                <FiAlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            {feedback && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
                <FiCheckCircle className="h-4 w-4" />
                {feedback}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting && <FiRefreshCw className="h-4 w-4 animate-spin" />}
                提交任务
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrlsText('');
                  setFeedback('');
                  setError('');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                重置表单
              </button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <FiActivity className="h-5 w-5 text-emerald-500" />
                <h2 className="text-lg font-semibold">队列进度</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">自动轮询</span>
                <button
                  onClick={() => setAutoPoll((prev) => !prev)}
                  className={`relative h-6 w-11 rounded-full transition ${autoPoll ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  aria-label="切换自动轮询"
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition ${autoPoll ? 'translate-x-5' : ''
                      }`}
                  />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => clearQueue(queueKey || DEFAULT_QUEUE_KEY, '任务队列')}
                disabled={!!clearing}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-900/40 dark:text-rose-100"
              >
                {clearing === (queueKey || DEFAULT_QUEUE_KEY) ? (
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <FiTrash2 className="h-4 w-4" />
                )}
                清空任务队列
              </button>
              <button
                onClick={() => clearQueue(ACTIVE_SET_KEY, '活跃队列')}
                disabled={!!clearing}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:-translate-y-0.5 hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/60 dark:bg-amber-900/40 dark:text-amber-100"
              >
                {clearing === ACTIVE_SET_KEY ? (
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <FiTrash2 className="h-4 w-4" />
                )}
                清空活跃队列
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-900/40">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">剩余任务数</p>
                <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-100">
                  {pending ?? '—'}
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">
                  数值来自 /api/tasks/status，低于 3 条时可关注新增
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">队列键</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{queueKey}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Redis rpush/blpop 消费</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <FiClock className="h-4 w-4" />
              {lastUpdate ? `最近拉取：${new Date(lastUpdate).toLocaleTimeString()}` : '等待首次查询'}
              <button
                onClick={fetchAllStatus}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-200"
              >
                <FiRefreshCw className="h-3 w-3" />
                手动刷新
              </button>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <FiActivity className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold">预处理队列进度</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <FiClock className="h-4 w-4" />
                {preprocessLastUpdate ? `最近拉取：${new Date(preprocessLastUpdate).toLocaleTimeString()}` : '等待首次查询'}
                <button
                  onClick={fetchPreprocessStatus}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-200"
                >
                  <FiRefreshCw className="h-3 w-3" />
                  手动刷新
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => clearQueue(preprocessQueueKey || PREPROCESS_QUEUE_KEY, '预处理队列')}
                disabled={!!clearing}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:-translate-y-0.5 hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/60 dark:bg-amber-900/40 dark:text-amber-100"
              >
                {clearing === (preprocessQueueKey || PREPROCESS_QUEUE_KEY) ? (
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <FiTrash2 className="h-4 w-4" />
                )}
                清空任务队列
              </button>
              <button
                onClick={() => clearQueue(PREPROCESS_ACTIVE_KEY, '预处理活跃队列')}
                disabled={!!clearing}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:-translate-y-0.5 hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/60 dark:bg-amber-900/40 dark:text-amber-100"
              >
                {clearing === PREPROCESS_ACTIVE_KEY ? (
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <FiTrash2 className="h-4 w-4" />
                )}
                清空活跃队列
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-900/40">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">剩余任务数</p>
                <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-100">
                  {preprocessPending ?? '—'}
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">队列 + 活跃总数</p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">队列键</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{preprocessQueueKey}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Redis rpush/brpop 消费</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <FiActivity className="h-5 w-5 text-emerald-500" />
                <h2 className="text-lg font-semibold">图谱生成队列进度</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <FiClock className="h-4 w-4" />
                {graphLastUpdate ? `最近拉取：${new Date(graphLastUpdate).toLocaleTimeString()}` : '等待首次查询'}
                <button
                  onClick={fetchGraphStatus}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-200"
                >
                  <FiRefreshCw className="h-3 w-3" />
                  手动刷新
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => clearQueue(graphQueueKey || GRAPH_QUEUE_KEY, '图谱生成队列')}
                disabled={!!clearing}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-900/60 dark:bg-sky-900/40 dark:text-sky-100"
              >
                {clearing === (graphQueueKey || GRAPH_QUEUE_KEY) ? (
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <FiTrash2 className="h-4 w-4" />
                )}
                清空任务队列
              </button>
              <button
                onClick={() => clearQueue(GRAPH_ACTIVE_KEY, '图谱活跃队列')}
                disabled={!!clearing}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-900/60 dark:bg-sky-900/40 dark:text-sky-100"
              >
                {clearing === GRAPH_ACTIVE_KEY ? (
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <FiTrash2 className="h-4 w-4" />
                )}
                清空活跃队列
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-900/40">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">剩余任务数</p>
                <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-100">
                  {graphPending ?? '—'}
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">队列 + 活跃总数</p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">队列键</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{graphQueueKey}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Redis rpush/brpop 消费</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <FiList className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold">请求预览</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              将按以下结构发送到 <code>{API_BASE}/api/tasks</code>，每条记录包含 name 与 url。
            </p>
            <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 shadow-inner">
              {payloadPreview}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
