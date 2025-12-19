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
  FiServer
} from 'react-icons/fi';

type CrawlResponse = {
  queued: number;
  queue_key: string;
  pending: number;
};

type StatusResponse = {
  pending: number;
  queue_key: string;
};

const API_BASE = process.env.NEXT_PUBLIC_GO_API ?? 'http://www.hvenjustic.top:5010';

const parseOptionalNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const Card = ({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) => (
  <div
    id={id}
    className={`glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70 ${className}`}
  >
    {children}
  </div>
);

export default function TaskPage() {
  const [urlsText, setUrlsText] = useState('https://example.com');
  const [defaultDepth, setDefaultDepth] = useState('3');
  const [defaultPages, setDefaultPages] = useState('1000');
  const [pending, setPending] = useState<number | null>(null);
  const [queueKey, setQueueKey] = useState('crawl_tasks');
  const [autoPoll, setAutoPoll] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildPayload = () => {
    const batchDepth = parseOptionalNumber(defaultDepth);
    const batchPages = parseOptionalNumber(defaultPages);
    const normalized = urlsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!normalized.length) {
      throw new Error('请至少输入一个 URL');
    }

    return {
      urls: normalized.map((url) => ({ url })),
      ...(batchDepth ? { max_depth: batchDepth } : {}),
      ...(batchPages ? { max_pages: batchPages } : {})
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

  useEffect(() => {
    if (autoPoll) {
      fetchStatus();
      pollingRef.current = setInterval(fetchStatus, 4000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [autoPoll, fetchStatus]);

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
      setQueueKey(data.queue_key);
      setPending(data.pending);
      setLastUpdate(Date.now());
      setFeedback(`已提交 ${data.queued} 条任务，队列剩余 ${data.pending} 条`);
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
      const batchDepth = parseOptionalNumber(defaultDepth);
      const batchPages = parseOptionalNumber(defaultPages);
      return JSON.stringify(
        {
          urls: [{ url: 'https://example.com' }],
          ...(batchDepth ? { max_depth: batchDepth } : {}),
          ...(batchPages ? { max_pages: batchPages } : {})
        },
        null,
        2
      );
    }
  }, [defaultDepth, defaultPages, urlsText]);

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
                调用后端 <code>/api/tasks</code> 与 <code>/api/tasks/status</code> 接口：输入待爬 URL、深度与页数即可追加到 Redis 队列，右侧实时展示剩余任务数。
                支持设置环境变量 <code>NEXT_PUBLIC_GO_API</code> 指向 Go 后端地址（默认 http://www.hvenjustic.top:5010）。
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
                onClick={fetchStatus}
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
              批量提交 + 可选覆盖
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">默认最大深度</span>
                <input
                  type="number"
                  min="1"
                  value={defaultDepth}
                  onChange={(e) => setDefaultDepth(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-indigo-400 dark:focus:ring-indigo-900"
                  placeholder="如 3"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">为空则使用后端配置默认值</p>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">默认最大页面数</span>
                <input
                  type="number"
                  min="1"
                  value={defaultPages}
                  onChange={(e) => setDefaultPages(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-indigo-400 dark:focus:ring-indigo-900"
                  placeholder="如 1000"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">单个任务未填写时将继承此值</p>
              </label>
            </div>

            <div className="space-y-3">
              <label className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 px-2 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-200">
                    URL
                  </span>
                  每行一个 URL（空行将被忽略）
                </div>
                <textarea
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  placeholder="https://example.com\nhttps://another.com/page"
                  className="h-44 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-indigo-400 dark:focus:ring-indigo-900"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">支持批量粘贴，提交时按行解析并自动跳过空行</p>
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
                  className={`relative h-6 w-11 rounded-full transition ${
                    autoPoll ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  aria-label="切换自动轮询"
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition ${
                      autoPoll ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
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
                onClick={fetchStatus}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-200"
              >
                <FiRefreshCw className="h-3 w-3" />
                手动刷新
              </button>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <FiList className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-semibold">请求预览</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              将按以下结构发送到 <code>{API_BASE}/api/tasks</code>，单个 URL 填写的覆盖参数会替换批量默认值。
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
