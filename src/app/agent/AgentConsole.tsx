'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowUpRight,
  FiClock,
  FiCpu,
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
};

type StreamMeta = {
  type: 'meta';
  label: string;
  value: string;
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
  slate: 'text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/50'
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamBuffer, isStreaming]);

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
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        AGENT_STORAGE_KEY,
        JSON.stringify({ messages, sessionId, activeSessionTitle })
      );
    } catch {}
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

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    streamBufferRef.current = '';
    setStreamBuffer('');
    setIsStreaming(false);
  };

  const appendAgentToken = (delta: string) => {
    streamBufferRef.current += delta;
    setStreamBuffer(streamBufferRef.current);
  };

  const finalizeAgentMessage = (citations?: string[]) => {
    const finalText = streamBufferRef.current;
    setMessages((prev) => [...prev, { role: 'agent', text: finalText || '（空响应）', citations }]);
    streamBufferRef.current = '';
    setStreamBuffer('');
    setIsStreaming(false);
  };

  const startSSEStream = (query: string) => {
    stopStream();
    streamBufferRef.current = '';
    setStreamBuffer('');
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
      finalizeAgentMessage(payload.citations);
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('meta', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamMeta;
      if (payload.label === 'session_id' && payload.value) {
        setSessionId(payload.value);
      }
    });

    es.onerror = () => {
      console.warn('SSE 连接失败');
      es.close();
      eventSourceRef.current = null;
      stopStream();
      setMessages((prev) => [...prev, { role: 'agent', text: '连接失败，请稍后重试。' }]);
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
    } catch {}
  };

  const mapHistoryMessages = (items: AgentMessage[]) => {
    const mapped: ChatMessage[] = [];
    items.forEach((item) => {
      const role = item.role === 'assistant' ? 'agent' : item.role === 'user' ? 'user' : null;
      if (!role) return;
      const text = (item.content || '').trim();
      mapped.push({ role, text: text || '（空响应）' });
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
        } catch {}
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
                {executionTimeline.map((item) => (
                  <div
                    key={item.label}
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
            <Card className="relative h-full w-full">
              {historyOpen && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/30 p-4">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">历史对话</div>
                      <button
                        onClick={closeHistory}
                        className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        关闭
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        onClick={resetChat}
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 dark:border-indigo-700 dark:text-indigo-200"
                      >
                        新对话
                      </button>
                      <button
                        onClick={fetchSessions}
                        disabled={historyLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
                      >
                        <FiRefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                        刷新
                      </button>
                    </div>
                    {historyError && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
                        {historyError}
                      </div>
                    )}
                    <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
                      {historyLoading && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                          加载中...
                        </div>
                      )}
                      {!historyLoading && sessions.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-300">
                          暂无历史对话
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
                            className="flex items-center gap-2"
                          >
                            <button
                              onClick={() => loadHistorySession(session)}
                              disabled={isLoading || isDeleting}
                              className={`flex-1 rounded-xl border px-3 py-2 text-left text-xs transition ${
                                isActive
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-100'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold">
                                  {session.title || '未命名对话'}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {isLoading ? '加载中…' : updatedLabel}
                                </span>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteHistorySession(session)}
                              disabled={isLoading || isDeleting}
                              aria-label="删除对话"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60 dark:border-rose-800/60 dark:text-rose-300 dark:hover:border-rose-700 dark:hover:text-rose-200"
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
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FiMessageCircle className="h-4 w-4 text-indigo-500" />
                  用户对话
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openHistory}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 transition hover:border-indigo-300 dark:border-indigo-700 dark:text-indigo-200"
                  >
                    <FiClock className="h-3.5 w-3.5" />
                    历史
                  </button>
                  {activeSessionTitle && (
                    <span
                      title={activeSessionTitle}
                      className="max-w-[160px] truncate rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      当前：{activeSessionTitle}
                    </span>
                  )}
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    Chat
                  </span>
                </div>
              </div>
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-slate-200/60 bg-white/70 p-3 dark:border-slate-800/60 dark:bg-slate-900/60">
                  <div className="flex-1 space-y-3 overflow-y-auto">
                  {messages.map((msg, idx) => (
                    <div key={`${msg.role}-${idx}`} className={`flex ${msg.role === 'agent' ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                          msg.role === 'agent'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                        }`}
                      >
                        <p>{msg.text}</p>
                        {msg.citations && msg.citations.length > 0 && (
                          <p className="mt-1 text-[11px] text-indigo-100 dark:text-indigo-200">
                            引用: {msg.citations.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isStreaming && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-2xl bg-indigo-600 px-4 py-2 text-sm text-white shadow-sm">
                        {streamBuffer || 'Agent 正在回应...'}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-slate-200/60 pt-3 dark:border-slate-800/60">
                    <input
                      className="flex-1 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                      placeholder="输入你的问题"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSend();
                      }}
                    />
                    <button
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      onClick={handleSend}
                      disabled={!canSend}
                    >
                      发送
                      <FiSend className="h-4 w-4" />
                    </button>
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
