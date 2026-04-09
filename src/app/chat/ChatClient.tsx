'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiLock,
  FiMessageCircle,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiShoppingCart,
  FiTrash2,
} from 'react-icons/fi';
import { getStoredToken, openAuthDialog, subscribeAuthToken } from '@/components/auth/authStorage';
import { AGENT_API_BASE } from '@/config/api';
import {
  type CartItem,
  type CartResponse,
  checkoutCart,
  getCart,
  removeCartItem,
  subscribeCartChanged,
} from '@/lib/shopApi';

type TraceItem = {
  step: string;
  stage?: string;
  level?: 'info' | 'warning' | 'error' | string;
  time?: string;
  payload?: Record<string, unknown> | null;
};

type ChatMessage = {
  role: 'user' | 'agent';
  text: string;
  traces?: TraceItem[];
};

type StreamToken = {
  type: 'token';
  delta: string;
};

type StreamDone = {
  type: 'done';
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
};

type MarkdownAnchorProps = ComponentPropsWithoutRef<'a'> & {
  children?: ReactNode;
};

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & {
  children?: ReactNode;
  inline?: boolean;
};

const TOOL_SCOPE = 'graph_query_only';
const quickPrompts = [
  '帮我找生产感冒药相关产品的企业',
  '查询图谱里和阿莫西林相关的公司',
  '帮我找一下主营退热止痛产品的企业',
];

const markdownComponents = {
  a: ({ href, children, ...props }: MarkdownAnchorProps) => (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-sky-600 underline decoration-sky-300 underline-offset-2 transition hover:text-sky-500 dark:text-sky-300 dark:decoration-sky-500/40 dark:hover:text-sky-200"
    >
      {children}
    </a>
  ),
  pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => (
    <pre
      {...props}
      className="my-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[13px] leading-6 text-slate-100"
    >
      {children}
    </pre>
  ),
  code: ({ children, className, inline, ...props }: MarkdownCodeProps) => {
    const content = String(children ?? '').replace(/\n$/, '');
    if (inline === false || className || content.includes('\n')) {
      return (
        <code {...props} className={`block font-mono text-[13px] leading-6 text-slate-100 ${className ?? ''}`.trim()}>
          {content}
        </code>
      );
    }
    return (
      <code
        {...props}
        className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-700 before:content-none after:content-none dark:bg-slate-700/80 dark:text-emerald-200"
      >
        {children}
      </code>
    );
  },
};

const compactTraceValue = (value: unknown, maxLength = 180) => {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'string'
      ? value
      : Array.isArray(value) || typeof value === 'object'
        ? JSON.stringify(value, null, 0)
        : String(value);
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
};

const formatTraceTime = (value?: string | null) => {
  if (!value) return '刚刚';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const traceToneClassName = (trace: TraceItem) => {
  if (trace.level === 'error' || trace.stage === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200';
  }
  if (trace.level === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200';
  }
  if (trace.stage === 'tool_result') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200';
  }
  if (trace.stage === 'tool_call') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200';
};

const traceTitle = (trace: TraceItem) => {
  const payload = trace.payload;
  const toolName = typeof payload?.name === 'string' && payload.name.trim() ? payload.name.trim() : '';
  if (trace.stage === 'tool_call' && toolName) return `调用 ${toolName}`;
  if (trace.stage === 'tool_result' && toolName) return `${toolName} 已返回结果`;
  if (trace.stage === 'tool_plan') return trace.step || '已生成工具计划';
  return trace.step || '处理中';
};

const traceDetail = (trace: TraceItem) => {
  if (trace.stage === 'tool_call') return compactTraceValue(trace.payload?.args);
  if (trace.stage === 'tool_result') return compactTraceValue(trace.payload?.result_preview);
  if (trace.stage === 'assistant_progress') return compactTraceValue(trace.payload?.round);
  return '';
};

const MarkdownMessage = ({ content }: { content: string }) => (
  <div className="prose prose-sm max-w-none break-words text-inherit prose-p:text-inherit prose-headings:text-inherit prose-li:text-inherit dark:prose-invert">
    <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
  </div>
);

const CartRow = ({
  item,
  removing,
  onRemove,
}: {
  item: CartItem;
  removing: boolean;
  onRemove: () => void;
}) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.product_name}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {item.product_url || '无来源地址'}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
      >
        <FiTrash2 className="h-3.5 w-3.5" />
        {removing ? '删除中' : '删除'}
      </button>
    </div>

    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
      <div className="rounded-xl bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        数量
        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.quantity}</div>
      </div>
      <div className="rounded-xl bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        单价
        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.unit_points} 积分</div>
      </div>
      <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
        小计
        <div className="mt-1 text-sm font-semibold">{item.subtotal_points} 积分</div>
      </div>
    </div>
  </div>
);

export default function ChatClient() {
  const [authToken, setAuthToken] = useState('');
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState('');
  const [cartFeedback, setCartFeedback] = useState('');
  const [cartSubmitting, setCartSubmitting] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [streamTraces, setStreamTraces] = useState<TraceItem[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamBufferRef = useRef('');
  const streamTracesRef = useRef<TraceItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const totalItems = cart?.total_items || 0;
  const totalPoints = cart?.total_points || 0;
  const pointsBalance = cart?.user.points_balance ?? null;
  const canSend = useMemo(() => input.trim().length > 0 && !isStreaming, [input, isStreaming]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadCart = async (options?: { silent?: boolean }) => {
    if (!getStoredToken().trim()) {
      setCart(null);
      setCartError('');
      setCartFeedback('');
      if (!options?.silent) {
        setCartLoading(false);
      }
      return;
    }

    if (!options?.silent) {
      setCartLoading(true);
    }
    setCartError('');
    try {
      const nextCart = await getCart();
      setCart(nextCart);
    } catch (requestError) {
      setCart(null);
      setCartError(requestError instanceof Error ? requestError.message : '购物车加载失败');
    } finally {
      if (!options?.silent) {
        setCartLoading(false);
      }
    }
  };

  useEffect(() => {
    setAuthToken(getStoredToken());
    const unsubscribeAuth = subscribeAuthToken((token) => {
      setAuthToken(token);
    });
    const unsubscribeCart = subscribeCartChanged(() => {
      void loadCart({ silent: true });
    });
    return () => {
      unsubscribeAuth();
      unsubscribeCart();
    };
  }, []);

  useEffect(() => {
    if (!authToken.trim()) {
      setCart(null);
      setCartError('');
      setCartFeedback('');
      return;
    }
    void loadCart();
  }, [authToken]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamBuffer, streamTraces, isStreaming]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

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

  const appendStreamTrace = (trace: TraceItem) => {
    streamTracesRef.current = [...streamTracesRef.current, trace];
    setStreamTraces(streamTracesRef.current);
  };

  const finalizeAgentMessage = (traces?: TraceItem[]) => {
    const finalText = streamBufferRef.current.trim() || '（空响应）';
    const finalTraces = Array.isArray(traces) && traces.length > 0 ? traces : streamTracesRef.current;
    setMessages((prev) => [...prev, { role: 'agent', text: finalText, traces: finalTraces }]);
    streamBufferRef.current = '';
    streamTracesRef.current = [];
    setStreamBuffer('');
    setStreamTraces([]);
    setIsStreaming(false);
  };

  const startStream = (query: string) => {
    stopStream();
    const params = new URLSearchParams({ message: query, tool_scope: TOOL_SCOPE });
    if (sessionId) {
      params.set('session_id', sessionId);
    }

    const es = new EventSource(`${AGENT_API_BASE}/api/chat/agent/stream?${params.toString()}`);
    eventSourceRef.current = es;
    setIsStreaming(true);

    es.addEventListener('token', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamToken;
      streamBufferRef.current += payload.delta;
      setStreamBuffer(streamBufferRef.current);
    });

    es.addEventListener('trace', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamTrace;
      if (!payload.step) return;
      appendStreamTrace({
        step: payload.step,
        stage: payload.stage,
        level: payload.level,
        time: payload.time,
        payload: payload.payload || null,
      });
    });

    es.addEventListener('meta', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamMeta;
      if (payload.label === 'session_id' && payload.value) {
        setSessionId(payload.value);
      }
    });

    es.addEventListener('done', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamDone;
      finalizeAgentMessage(payload.trace);
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      appendStreamTrace({
        step: '流式连接失败，请稍后重试。',
        stage: 'error',
        level: 'error',
      });
      finalizeAgentMessage();
    };
  };

  const sendMessage = (text: string) => {
    const normalized = text.trim();
    if (!normalized || isStreaming) return;
    setMessages((prev) => [...prev, { role: 'user', text: normalized }]);
    setInput('');
    startStream(normalized);
  };

  const handleRemoveCartItem = async (item: CartItem) => {
    setCartSubmitting(`remove-${item.id}`);
    setCartError('');
    setCartFeedback('');
    try {
      const payload = await removeCartItem(item.id);
      setCart(payload.cart);
      setCartFeedback(`已从购物车移除「${item.product_name}」。`);
    } catch (requestError) {
      setCartError(requestError instanceof Error ? requestError.message : '删除失败');
    } finally {
      setCartSubmitting('');
    }
  };

  const handleCheckout = async () => {
    if (!cart?.items.length) return;
    setCartSubmitting('checkout');
    setCartError('');
    setCartFeedback('');
    try {
      const order = await checkoutCart();
      setCartFeedback(`结算成功，订单号 ${order.order_no}，本次扣除 ${order.total_points} 积分。`);
      await loadCart({ silent: true });
    } catch (requestError) {
      setCartError(requestError instanceof Error ? requestError.message : '结算失败');
    } finally {
      setCartSubmitting('');
    }
  };

  return (
    <div className="relative isolate h-[calc(100vh-80px)] overflow-hidden px-3 pb-0">
      <section className="mx-auto mt-1 flex h-full max-w-[108rem] flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">对话展示</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">购物车与图谱查询联动页</h1>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            Agent 仅开放图谱查询工具
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 sm:grid-cols-2 sm:grid-rows-1">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <div className="shrink-0 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <FiShoppingCart className="h-4 w-4 text-emerald-500" />
                    购物车
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">左侧列表可滚动，支持删除单项和整车结算。</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!authToken.trim()) {
                        openAuthDialog();
                        return;
                      }
                      void loadCart();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                  >
                    <FiRefreshCw className={`h-3.5 w-3.5 ${cartLoading ? 'animate-spin' : ''}`} />
                    刷新
                  </button>
                  {!authToken.trim() ? (
                    <button
                      type="button"
                      onClick={openAuthDialog}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      <FiLock className="h-3.5 w-3.5" />
                      登录
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">商品数</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{totalItems}</div>
                </div>
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">购物车合计</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{totalPoints}</div>
                </div>
                <div className="rounded-2xl border border-sky-200/80 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">可用积分</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                    {pointsBalance === null ? '—' : pointsBalance}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!authToken.trim() ? (
                <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <FiLock className="h-10 w-10 text-slate-400" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">登录后查看购物车</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                    产品页加入购物车后，这里会实时展示购物车列表、积分合计和结算结果。
                  </p>
                  <button
                    type="button"
                    onClick={openAuthDialog}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    打开登录框
                    <FiArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {authToken.trim() && cartLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                  <FiRefreshCw className="mr-2 inline-block h-4 w-4 animate-spin" />
                  正在加载购物车...
                </div>
              ) : null}

              {authToken.trim() && cartError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                  {cartError}
                </div>
              ) : null}

              {authToken.trim() && cartFeedback ? (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {cartFeedback}
                </div>
              ) : null}

              {authToken.trim() && !cartLoading && !cartError && totalItems === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <FiShoppingCart className="h-10 w-10 text-slate-400" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">购物车还是空的</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                    去产品实体库展开图谱后，可以把商品加入购物车，再回到这里统一结算。
                  </p>
                </div>
              ) : null}

              {authToken.trim() && totalItems > 0 ? (
                <div className="space-y-3">
                  {(cart?.items || []).map((item) => (
                    <CartRow
                      key={item.id}
                      item={item}
                      removing={cartSubmitting === `remove-${item.id}`}
                      onRemove={() => void handleRemoveCartItem(item)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">当前结算</p>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{totalPoints} 积分</div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCheckout()}
                  disabled={!authToken.trim() || totalItems === 0 || cartSubmitting === 'checkout'}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiCheckCircle className="h-4 w-4" />
                  {cartSubmitting === 'checkout' ? '结算中...' : '结算全部商品'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <div className="shrink-0 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <FiMessageCircle className="h-4 w-4 text-sky-500" />
                    图谱查询 Agent
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    右侧消息区可滚动，输入框固定底部，仅支持通过图谱查询工具按产品找企业。
                  </p>
                </div>
                <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
                  tool_scope = {TOOL_SCOPE}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    disabled={isStreaming}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  >
                    <FiSearch className="h-3.5 w-3.5" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 && !isStreaming ? (
                <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
                  <FiDatabase className="h-10 w-10 text-slate-400" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">从产品关键词开始查询</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                    例如输入“感冒药”“阿莫西林”或“退热止痛”，Agent 会调用图谱查询工具返回匹配到的企业与命中产品。
                  </p>
                </div>
              ) : null}

              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isAgent = message.role === 'agent';
                  return (
                    <div
                      key={`${message.role}-${index}-${message.text.slice(0, 16)}`}
                      className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm ${
                          isAgent
                            ? 'border border-sky-100 bg-sky-50 text-slate-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-slate-100'
                            : 'border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
                        }`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {isAgent ? 'Agent' : '用户'}
                        </div>
                        <div className="mt-2 text-sm leading-6">
                          <MarkdownMessage content={message.text} />
                        </div>
                        {isAgent && message.traces && message.traces.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {message.traces.map((trace, traceIndex) => (
                              <div
                                key={`${trace.step}-${traceIndex}`}
                                className={`rounded-2xl border px-3 py-2 text-xs ${traceToneClassName(trace)}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold">{traceTitle(trace)}</span>
                                  <span className="opacity-80">{formatTraceTime(trace.time)}</span>
                                </div>
                                {traceDetail(trace) ? <div className="mt-1 leading-5 opacity-90">{traceDetail(trace)}</div> : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {isStreaming ? (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-3xl border border-sky-100 bg-sky-50 px-4 py-3 text-slate-800 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-slate-100">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Agent 正在回答
                      </div>
                      {streamTraces.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {streamTraces.map((trace, traceIndex) => (
                            <div
                              key={`${trace.step}-${traceIndex}`}
                              className={`rounded-2xl border px-3 py-2 text-xs ${traceToneClassName(trace)}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{traceTitle(trace)}</span>
                                <span className="opacity-80">{formatTraceTime(trace.time)}</span>
                              </div>
                              {traceDetail(trace) ? <div className="mt-1 leading-5 opacity-90">{traceDetail(trace)}</div> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 text-sm leading-6">
                        <MarkdownMessage content={streamBuffer || '正在整理回答...'} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div ref={messagesEndRef} className="h-2" />
            </div>

            <div className="shrink-0 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <FiClock className="h-3.5 w-3.5" />
                  当前页面只支持知识图谱查询，请输入产品或用途关键词。
                </div>
                <div className="mt-3 flex items-end gap-3">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="例如：帮我找生产感冒药的企业"
                    rows={3}
                    className="min-h-[5.5rem] flex-1 resize-none bg-transparent text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage(input);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => sendMessage(input)}
                    disabled={!canSend}
                    className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <FiSend className="h-4 w-4" />
                    发送
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
