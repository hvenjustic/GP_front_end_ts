'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiClock,
  FiDatabase,
  FiMessageCircle,
  FiPackage,
  FiRefreshCw,
  FiSend,
  FiTrash2,
  FiTrendingUp
} from 'react-icons/fi';
import { AGENT_API_BASE } from '@/config/api';

type ChatMessage = {
  role: 'user' | 'agent';
  text: string;
  citations?: string[];
  traces?: TraceItem[];
};

type TraceItem = {
  step: string;
  stage?: string;
  level?: 'info' | 'warning' | 'error' | string;
  time?: string;
  payload?: Record<string, unknown> | null;
};

type AgentSession = {
  session_id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type AgentMessage = {
  id: number;
  role: string;
  content?: string | null;
  status?: string | null;
  tool_name?: string | null;
  tool_payload?: {
    trace?: TraceItem[];
    [key: string]: unknown;
  } | null;
  created_at?: string | null;
};

type AgentSessionDetailResponse = {
  session: AgentSession;
  messages: AgentMessage[];
};

type ReviewItem = {
  id: number;
  name?: string | null;
  site_name?: string | null;
  url: string;
  llm_processed_at?: string | null;
  updated_at?: string | null;
  on_sale: boolean;
};

type ReviewResponse = {
  items: ReviewItem[];
  total: number;
  page: number;
  page_size: number;
};

type StreamToken = {
  type: 'token';
  delta: string;
  messageId: string;
};

type StreamDone = {
  type: 'done';
  messageId: string;
  citations?: string[];
  trace?: TraceItem[];
};

type StreamMeta = {
  type: 'meta';
  label: string;
  value: string;
};

type StreamTrace = {
  type: 'trace';
  step: string;
  stage?: string;
  level?: 'info' | 'warning' | 'error' | string;
  time?: string;
  payload?: Record<string, unknown> | null;
  messageId?: string;
  sessionId?: string;
};

const executionTimeline = [
  { label: '库存巡检', status: '完成', detail: '检查 128 个 SKU，发现 8 个低库存', time: '刚刚', tone: 'emerald' },
  { label: '价格对比', status: '执行中', detail: '对接竞品 API 计算差价', time: '进行中', tone: 'indigo' },
  { label: '推荐生成', status: '排队', detail: '等待 LangChain 调用推荐链', time: '排队', tone: 'amber' },
  { label: '客服草稿', status: '待审', detail: '3 条回复等待人工确认', time: '5 分钟前', tone: 'slate' }
];

const automations = [
  { title: '库存巡检与自动上架', status: '监控中', owner: '运营 Agent', steps: ['读取库存节点', '触发补货工单', '库存恢复自动上架'] },
  { title: '智能调价与关联推荐', status: '试运行', owner: '定价 Agent', steps: ['竞品比价', '生成加购/替代推荐', '等待确认执行'] },
  { title: '客服对话助手', status: '活跃', owner: '对话 Agent', steps: ['意图识别', '知识检索', '多轮回复草稿'] }
];

const liveStats = [
  { label: '待处理补货', value: '8', hint: '库存低于安全阈值', icon: FiPackage },
  { label: '价格异常', value: '3', hint: '与竞品差价超 15%', icon: FiTrendingUp },
  { label: '图谱同步', value: '15 分钟前', hint: '最近写入时间', icon: FiDatabase }
];

const toneColor: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30',
  indigo: 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30',
  amber: 'text-amber-600 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30',
  slate: 'text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/50',
  rose: 'text-rose-600 dark:text-rose-200 bg-rose-50 dark:bg-rose-900/30'
};

const AGENT_STORAGE_KEY = 'agent_console_state_v1';

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div
    className={`glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70 ${className}`}
  >
    {children}
  </div>
);

export default function AgentConsole() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [streamTraces, setStreamTraces] = useState<TraceItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyDetailLoadingId, setHistoryDetailLoadingId] = useState<string | null>(null);
  const [historyDeletingId, setHistoryDeletingId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewUpdatingId, setReviewUpdatingId] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamBufferRef = useRef('');
  const streamTracesRef = useRef<TraceItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamBuffer, streamTraces, isStreaming]);

  const canSend = useMemo(() => input.trim().length > 0 && !isStreaming, [input, isStreaming]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AGENT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        messages?: ChatMessage[];
        sessionId?: string | null;
        activeSessionTitle?: string | null;
      };
      if (Array.isArray(parsed.messages)) {
        const safeMessages = parsed.messages.filter(
          (item) => item && (item.role === 'user' || item.role === 'agent') && typeof item.text === 'string'
        );
        if (safeMessages.length > 0) {
          setMessages(safeMessages);
        }
      }
      if (typeof parsed.sessionId === 'string') {
        setSessionId(parsed.sessionId);
      }
      if (typeof parsed.activeSessionTitle === 'string') {
        setActiveSessionTitle(parsed.activeSessionTitle);
      }
    } catch {
      // ignore sessionStorage parse error
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        AGENT_STORAGE_KEY,
        JSON.stringify({ messages, sessionId, activeSessionTitle })
      );
    } catch {
      // ignore sessionStorage write error
    }
  }, [messages, sessionId, activeSessionTitle]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    fetchReviewItems();
  }, []);

  const formatTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  };

  const traceTimeline = useMemo(() => {
    const latestAgentTrace = [...messages]
      .reverse()
      .find((msg) => msg.role === 'agent' && Array.isArray(msg.traces) && msg.traces.length > 0)?.traces || [];
    const current = streamTraces.length > 0 ? streamTraces : latestAgentTrace;
    if (!current.length) return executionTimeline;
    return current
      .slice(-8)
      .map((item) => ({
        label: item.stage || 'process',
        status: item.level === 'error' ? '错误' : item.level === 'warning' ? '注意' : '进行中',
        detail: item.step,
        time: item.time ? formatTime(item.time) : '刚刚',
        tone: item.level === 'error' ? 'rose' : item.level === 'warning' ? 'amber' : 'indigo'
      }))
      .reverse();
  }, [messages, streamTraces]);

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    streamBufferRef.current = '';
    streamTracesRef.current = [];
    setStreamBuffer('');
    setStreamTraces([]);
    setIsStreaming(false);
  };

  const appendAgentToken = (delta: string) => {
    streamBufferRef.current += delta;
    setStreamBuffer(streamBufferRef.current);
  };

  const appendTrace = (trace: TraceItem) => {
    streamTracesRef.current = [...streamTracesRef.current, trace];
    setStreamTraces(streamTracesRef.current);
  };

  const finalizeAgentMessage = (citations?: string[], traces?: TraceItem[]) => {
    const finalText = streamBufferRef.current;
    const finalTraces =
      Array.isArray(traces) && traces.length > 0
        ? traces
        : streamTracesRef.current;
    setMessages((prev) => [
      ...prev,
      { role: 'agent', text: finalText || '（空响应）', citations, traces: finalTraces }
    ]);
    streamBufferRef.current = '';
    streamTracesRef.current = [];
    setStreamBuffer('');
    setStreamTraces([]);
    setIsStreaming(false);
  };

  const startSSEStream = (query: string) => {
    stopStream();
    streamBufferRef.current = '';
    streamTracesRef.current = [];
    setStreamBuffer('');
    setStreamTraces([]);
    const params = new URLSearchParams({ message: query });
    if (sessionId) params.set('session_id', sessionId);
    const url = `${AGENT_API_BASE}/api/chat/agent/stream?${params.toString()}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setIsStreaming(true);

    es.addEventListener('token', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamToken;
      appendAgentToken(payload.delta);
    });

    es.addEventListener('done', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamDone;
      finalizeAgentMessage(payload.citations, payload.trace);
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('meta', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamMeta;
      if (payload.label === 'session_id' && payload.value) {
        setSessionId(payload.value);
      }
    });

    es.addEventListener('trace', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamTrace;
      if (!payload.step) return;
      appendTrace({
        step: payload.step,
        stage: payload.stage,
        level: payload.level,
        time: payload.time,
        payload: payload.payload || null
      });
    });

    es.onerror = () => {
      console.warn('SSE 连接失败');
      es.close();
      eventSourceRef.current = null;
      finalizeAgentMessage(undefined, [
        ...streamTracesRef.current,
        { step: '流式连接失败', stage: 'error', level: 'error' }
      ]);
      setMessages((prev) => {
        if (!prev.length) {
          return [{ role: 'agent', text: '连接失败，请稍后重试。' }];
        }
        const next = [...prev];
        const last = next[next.length - 1];
        if (last.role === 'agent' && (last.text || '') === '（空响应）') {
          next[next.length - 1] = { ...last, text: '连接失败，请稍后重试。' };
        }
        return next;
      });
    };
  };

  const handleSend = () => {
    if (!canSend) return;
    const text = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    startSSEStream(text);
  };

  const sendQuickMessage = (text: string) => {
    if (!text.trim() || isStreaming) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    startSSEStream(text.trim());
  };

  const fetchSessions = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/agent/sessions?limit=50`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      const json = (await res.json()) as AgentSession[];
      setSessions(json || []);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '未知错误');
      setSessions([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchReviewItems = async () => {
    setReviewLoading(true);
    setReviewError('');
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/products/review?page=1&page_size=20`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      const json = (await res.json()) as ReviewResponse;
      setReviewItems(json.items || []);
      setReviewTotal(Number.isFinite(json.total) ? json.total : (json.items || []).length);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : '未知错误');
      setReviewItems([]);
      setReviewTotal(0);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSetOnSale = async (taskId: number) => {
    if (reviewUpdatingId) return;
    setReviewUpdatingId(taskId);
    setReviewError('');
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/products/on_sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [taskId] })
      });
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      await fetchReviewItems();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setReviewUpdatingId(null);
    }
  };

  const handleFetchBuildable = () => {
    sendQuickMessage('列出可构建的任务列表');
  };

  const handleBatchBuild = () => {
    const raw = window.prompt('请输入任务 ID，多个用英文逗号分隔');
    if (!raw) return;
    const ids = raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item);
    if (!ids.length) return;
    sendQuickMessage(`构建图谱任务 ${ids.join(', ')}`);
  };

  const openHistory = () => {
    setHistoryOpen(true);
    fetchSessions();
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryError('');
  };

  const resetChat = () => {
    stopStream();
    setMessages([]);
    setSessionId(null);
    setActiveSessionTitle(null);
    closeHistory();
    try {
      sessionStorage.removeItem(AGENT_STORAGE_KEY);
    } catch {
      // ignore sessionStorage clear error
    }
  };

  const mapHistoryMessages = (items: AgentMessage[]) => {
    const mapped: ChatMessage[] = [];
    items.forEach((item) => {
      const role = item.role === 'assistant' ? 'agent' : item.role === 'user' ? 'user' : null;
      if (!role) return;
      const text = (item.content || '').trim();
      const traces =
        role === 'agent' && item.tool_name === 'agent_trace' && Array.isArray(item.tool_payload?.trace)
          ? item.tool_payload?.trace.filter((trace) => trace && typeof trace.step === 'string')
          : undefined;
      mapped.push({ role, text: text || '（空响应）', traces });
    });
    return mapped;
  };

  const loadHistorySession = async (session: AgentSession) => {
    setHistoryDetailLoadingId(session.session_id);
    setHistoryError('');
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/agent/sessions/${session.session_id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      const json = (await res.json()) as AgentSessionDetailResponse;
      stopStream();
      setMessages(mapHistoryMessages(json.messages || []));
      setSessionId(json.session.session_id);
      setActiveSessionTitle(json.session.title || null);
      setHistoryOpen(false);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setHistoryDetailLoadingId(null);
    }
  };

  const deleteHistorySession = async (session: AgentSession) => {
    if (!session.session_id) {
      return;
    }
    if (isStreaming) {
      setHistoryError('正在对话中，无法删除当前会话。');
      return;
    }
    const titleLabel = session.title || '未命名对话';
    const confirmed = window.confirm(`确定删除对话「${titleLabel}」吗？此操作不可恢复。`);
    if (!confirmed) {
      return;
    }
    setHistoryDeletingId(session.session_id);
    setHistoryError('');
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/agent/sessions/${session.session_id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        let message = '删除失败';
        try {
          const payload = await res.json();
          if (payload?.detail) {
            message = payload.detail;
          }
        } catch {
          // ignore malformed error payload
        }
        throw new Error(message);
      }
      setSessions((prev) => prev.filter((item) => item.session_id !== session.session_id));
      if (sessionId === session.session_id) {
        setSessionId(null);
        setActiveSessionTitle(null);
        setMessages([]);
      }
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setHistoryDeletingId(null);
    }
  };

  return (
    <div className="relative isolate h-[calc(100vh-80px)] overflow-hidden px-3 pb-0">
      <section className="mx-auto mt-1 flex h-full max-w-[108rem] flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-2 shadow-lg backdrop-blur md:p-3 dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-1" />
        </div>

        <div className="mt-6 grid flex-1 min-h-0 gap-4 md:grid-cols-[1fr_1fr_2.2fr]">
          {/* 执行进度 */}
          <div className="space-y-4 overflow-y-auto pr-1 md:col-span-1">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FiActivity className="h-4 w-4 text-indigo-500" />
                  执行进度
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  实时
                </span>
              </div>
              <div className="space-y-3">
                {traceTimeline.map((item, idx) => (
                  <div
                    key={`${item.label}-${idx}`}
                    className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-800/70"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneColor[item.tone]}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">时间：{item.time}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FiTrendingUp className="h-4 w-4 text-indigo-500" />
                关键指标
              </div>
              <div className="space-y-3">
                {liveStats.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-800/70">
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <stat.icon className="h-4 w-4 text-indigo-500" />
                      {stat.label}
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-slate-900 dark:text-white">{stat.value}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{stat.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 待办与编排 */}
          <div className="space-y-4 overflow-y-auto pr-1 md:col-span-1">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FiAlertTriangle className="h-4 w-4 text-amber-500" />
                  审核待办
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-100">
                  待上架 {reviewTotal}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={handleFetchBuildable}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  可构建任务列表
                </button>
                <button
                  onClick={handleBatchBuild}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  批量构建
                </button>
              </div>
              <div className="space-y-3">
                {reviewLoading && (
                  <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 text-xs text-slate-500 dark:border-slate-800/70 dark:bg-slate-800/50 dark:text-slate-300">
                    加载中...
                  </div>
                )}
                {!reviewLoading && reviewError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-200">
                    {reviewError}
                  </div>
                )}
                {!reviewLoading && !reviewError && reviewItems.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-300">
                    暂无待上架商品
                  </div>
                )}
                {reviewItems.map((item) => {
                  const title = item.name || item.site_name || '待上架商品';
                  const updatedLabel = formatTime(item.llm_processed_at || item.updated_at);
                  const isUpdating = reviewUpdatingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200/70 p-3 shadow-sm dark:border-slate-800/70"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{item.url}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">图谱完成: {updatedLabel}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                          <FiClock className="h-4 w-4" />
                          待上架
                        </span>
                        <button
                          onClick={() => handleSetOnSale(item.id)}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                          {isUpdating ? '上架中...' : '上架'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FiActivity className="h-4 w-4 text-indigo-500" />
                运营编排
              </div>
              <div className="space-y-3">
                {automations.map((flow) => (
                  <div key={flow.title} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-800/70">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{flow.title}</p>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
                        {flow.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Owner: {flow.owner}</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                      {flow.steps.map((step) => (
                        <li key={step} className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
                          {step}
                        </li>
                      ))}
                    </ul>
                    <button className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600">
                      触发一次
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 聊天交互（占 1/2，右侧全高） */}
          <div className="flex min-h-0 w-full">
            <Card className="relative h-full w-full !p-0 overflow-hidden flex flex-col bg-gradient-to-b from-sky-50 to-white shadow-xl border-none">
              {historyOpen && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-5 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-slate-800 dark:text-white">历史对话</div>
                      <button
                        onClick={closeHistory}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        关闭
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        onClick={resetChat}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-200"
                      >
                        <FiMessageCircle className="h-3.5 w-3.5" />
                        新对话
                      </button>
                      <button
                        onClick={fetchSessions}
                        disabled={historyLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
                      >
                        <FiRefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                        刷新
                      </button>
                    </div>
                    {historyError && (
                      <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200">
                        {historyError}
                      </div>
                    )}
                    <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                      {historyLoading && (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                          <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" /> 加载中...
                        </div>
                      )}
                      {!historyLoading && sessions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                          <FiMessageCircle className="mb-2 h-8 w-8 opacity-20" />
                          <p className="text-xs">暂无历史对话</p>
                        </div>
                      )}
                      {sessions.map((session) => {
                        const updatedLabel = formatTime(session.updated_at || session.created_at);
                        const isActive = session.session_id === sessionId;
                        const isLoading = historyDetailLoadingId === session.session_id;
                        const isDeleting = historyDeletingId === session.session_id;
                        return (
                          <div
                            key={session.session_id}
                            className="group flex items-center gap-2"
                          >
                            <button
                              onClick={() => loadHistorySession(session)}
                              disabled={isLoading || isDeleting}
                              className={`flex-1 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${isActive
                                  ? 'border-indigo-200 bg-indigo-50 shadow-sm ring-1 ring-indigo-200 dark:border-indigo-700 dark:bg-indigo-900/30'
                                  : 'border-transparent bg-slate-50 hover:bg-slate-100 hover:shadow-sm dark:bg-slate-800/50 dark:hover:bg-slate-800'
                                }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-medium ${isActive ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {session.title || '未命名对话'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {isLoading ? '加载中…' : updatedLabel}
                                </span>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteHistorySession(session)}
                              disabled={isLoading || isDeleting}
                              aria-label="删除对话"
                              className="invisible inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:visible group-hover:opacity-100 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-sky-100 bg-white/60 px-5 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                    <FiMessageCircle className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-white">智能助手</span>
                    {activeSessionTitle && (
                      <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{activeSessionTitle}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openHistory}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-indigo-600 hover:ring-indigo-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                  >
                    <FiClock className="h-3.5 w-3.5" />
                    历史
                  </button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                <div className="mx-auto max-w-3xl space-y-6">
                  {messages.map((msg, idx) => (
                    <div key={`${msg.role}-${idx}`} className={`flex flex-col ${msg.role === 'agent' ? 'items-start' : 'items-end'}`}>
                      {/* Agent Thinking Box */}
                      {msg.role === 'agent' && Array.isArray(msg.traces) && msg.traces.length > 0 && (
                        <div className="mb-2 ml-1 w-full max-w-[90%] rounded-xl border border-sky-100 bg-sky-50/80 p-3 backdrop-blur-sm transition-all duration-500 dark:border-sky-900/30 dark:bg-sky-900/20">
                          <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                            思考过程
                          </div>
                          <div className="mt-2 space-y-2">
                            {msg.traces.map((trace, traceIdx) => (
                              <div key={`${idx}-trace-${traceIdx}`} className="group relative border-l-2 border-sky-200 pl-3 transition-all hover:border-sky-400 dark:border-sky-800">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{trace.stage || '分析中'}</span>
                                  {trace.time && <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">{formatTime(trace.time)}</span>}
                                </div>
                                <div className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{trace.step}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`relative max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm transition-all duration-300 ${msg.role === 'agent'
                            ? 'rounded-tl-none border border-slate-100 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                            : 'rounded-tr-none bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                          }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1 border-t border-dashed border-current/20 pt-2 opacity-80">
                            {msg.citations.map((cite, i) => (
                              <span key={i} className="inline-flex items-center rounded bg-current/10 px-1.5 py-0.5 text-[10px]">
                                引用 {i + 1}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Streaming State */}
                  {isStreaming && (
                    <div className="flex flex-col items-start">
                      {/* Streaming Thinking */}
                      {(streamTraces.length > 0) && (
                        <div className="mb-2 ml-1 w-full max-w-[90%] rounded-xl border border-amber-100 bg-amber-50/80 p-3 backdrop-blur-sm transition-all duration-300 dark:border-amber-900/30 dark:bg-amber-900/20">
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <FiRefreshCw className="h-3 w-3 animate-spin" />
                            正在思考...
                          </div>
                          <div className="mt-2 space-y-2">
                            {streamTraces.slice(-3).map((trace, traceIdx) => (
                              <div key={`stream-trace-${traceIdx}`} className="border-l-2 border-amber-200 pl-3 transition-all duration-500 dark:border-amber-800">
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{trace.stage || '处理中'}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">{trace.step}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Streaming Message Bubble */}
                      <div className="relative max-w-[85%] rounded-2xl rounded-tl-none border border-slate-100 bg-white px-5 py-3 text-sm leading-relaxed text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
                        {streamBuffer ? (
                          <span className="whitespace-pre-wrap">{streamBuffer}</span>
                        ) : (
                          <div className="flex items-center gap-1 py-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></span>
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></span>
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} className="h-4" />
                </div>
              </div>

              {/* Input Area */}
              <div className="shrink-0 bg-white/80 p-4 backdrop-blur dark:bg-slate-900/80">
                <div className="mx-auto max-w-3xl">
                  <div className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-500 dark:focus-within:ring-indigo-900">
                    <input
                      className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                      placeholder="输入您的问题..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSend();
                      }}
                    />
                    <button
                      className={`group flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white transition-all hover:bg-indigo-700 ${!canSend ? 'cursor-not-allowed opacity-50 bg-slate-400' : 'shadow-md shadow-indigo-200 dark:shadow-none'
                        }`}
                      onClick={handleSend}
                      disabled={!canSend}
                    >
                      <FiSend className={`h-4 w-4 transition-transform ${canSend ? 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5' : ''}`} />
                    </button>
                  </div>
                  <div className="mt-2 text-center text-[10px] text-slate-400">
                    AI 可能会生成错误信息，请核对重要事实
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
