'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheck,
  FiClock,
  FiCopy,
  FiDatabase,
  FiMessageCircle,
  FiPackage,
  FiRefreshCw,
  FiSend,
  FiTrash2,
  FiTrendingUp
} from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
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
  graph_built_at?: string | null;
  updated_at?: string | null;
};

type ReviewResponse = {
  items: ReviewItem[];
  total: number;
  page: number;
  page_size: number;
};

type QueueStatusResponse = {
  pending: number;
  queue_key: string;
};

type ResultStatusItem = {
  id: number;
  status: string;
  has_processed_markdown?: boolean;
};

type ResultListResponse = {
  items: ResultStatusItem[];
  total: number;
  page: number;
  page_size: number;
};

type ProductListResponse = {
  total: number;
  page: number;
  page_size: number;
};

type ReviewAction = 'approve' | 'reject';

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
  { label: '爬取队列巡检', status: '待机', detail: '等待新的爬取任务进入队列', time: '刚刚', tone: 'slate' },
  { label: '图谱构建巡检', status: '待机', detail: '等待新的构建任务进入队列', time: '刚刚', tone: 'slate' },
  { label: '上架审核巡检', status: '待机', detail: '等待新的图谱进入审核流程', time: '刚刚', tone: 'slate' },
  { label: '构建资源盘点', status: '待机', detail: '等待计算可构建站点数量', time: '刚刚', tone: 'slate' }
];

const automations = [
  { title: '库存巡检与自动上架', status: '监控中', owner: '运营 Agent', steps: ['读取库存节点', '触发补货工单', '库存恢复自动上架'] },
  { title: '智能调价与关联推荐', status: '试运行', owner: '定价 Agent', steps: ['竞品比价', '生成加购/替代推荐', '等待确认执行'] },
  { title: '客服对话助手', status: '活跃', owner: '对话 Agent', steps: ['意图识别', '知识检索', '多轮回复草稿'] }
];

const toneColor: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30',
  indigo: 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30',
  amber: 'text-amber-600 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30',
  slate: 'text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/50',
  rose: 'text-rose-600 dark:text-rose-200 bg-rose-50 dark:bg-rose-900/30'
};

const AGENT_STORAGE_KEY = 'agent_console_state_v1';

type MarkdownTag = 'a' | 'blockquote' | 'code' | 'pre';

type MarkdownElementProps<T extends MarkdownTag> = ComponentPropsWithoutRef<T> & {
  children?: ReactNode;
  inline?: boolean;
  node?: unknown;
};

type MarkdownTableAlignment = 'left' | 'center' | 'right' | null;

type MarkdownBlock =
  | {
      type: 'markdown';
      content: string;
    }
  | {
      type: 'table';
      header: string[];
      rows: string[][];
      alignments: MarkdownTableAlignment[];
    };

const markdownClassName =
  'prose prose-sm max-w-none break-words text-inherit prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-li:text-inherit prose-blockquote:text-slate-600 prose-hr:border-slate-200 dark:prose-invert dark:prose-blockquote:text-slate-300 dark:prose-hr:border-slate-700';

const compactMarkdownClassName =
  'prose prose-sm max-w-none break-words text-inherit prose-p:my-0 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-1 prose-code:text-[0.85em] prose-headings:my-1 prose-blockquote:my-1 dark:prose-invert';

const RESULT_PAGE_SIZE = 100;
const BUILDABLE_STATUSES = new Set(['CRAWLED', 'GRAPH_FAILED', 'GRAPH_DONE', 'GRAPH_CANCELLED']);

const tableAlignmentClassName: Record<Exclude<MarkdownTableAlignment, null>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
};

const markdownComponents = {
  a: ({ href, children, ...props }: MarkdownElementProps<'a'>) => (
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
  pre: ({ children, ...props }: MarkdownElementProps<'pre'>) => (
    <pre
      {...props}
      className="my-3 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-[13px] leading-6 text-slate-100"
    >
      {children}
    </pre>
  ),
  code: ({ children, className, inline, ...props }: MarkdownElementProps<'code'>) => {
    const codeText = String(children ?? '').replace(/\n$/, '');
    const isBlock = Boolean(inline === false || className || codeText.includes('\n'));

    if (isBlock) {
      return (
        <code {...props} className={`block font-mono text-[13px] leading-6 text-slate-100 ${className ?? ''}`.trim()}>
          {codeText}
        </code>
      );
    }

    return (
      <code
        {...props}
        className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-rose-600 before:content-none after:content-none dark:bg-slate-700/80 dark:text-rose-200"
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children, ...props }: MarkdownElementProps<'blockquote'>) => (
    <blockquote
      {...props}
      className="my-3 border-l-4 border-slate-300 bg-slate-50/70 py-1 pl-4 italic text-slate-600 dark:border-slate-600 dark:bg-slate-700/20 dark:text-slate-300"
    >
      {children}
    </blockquote>
  )
};

const MarkdownContent = ({ content, className = markdownClassName }: { content: string; className?: string }) => (
  <div className={className}>
    <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
  </div>
);

const splitMarkdownTableRow = (line: string) => {
  let normalized = line.trim();
  if (normalized.startsWith('|')) normalized = normalized.slice(1);
  if (normalized.endsWith('|')) normalized = normalized.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  let escaped = false;
  let inCodeSpan = false;

  for (const char of normalized) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }

    if (char === '`') {
      inCodeSpan = !inCodeSpan;
      current += char;
      continue;
    }

    if (char === '|' && !inCodeSpan) {
      cells.push(current.trim().replace(/\\\|/g, '|'));
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim().replace(/\\\|/g, '|'));
  return cells;
};

const isMarkdownTableHeader = (line: string) => {
  if (!line.includes('|')) return false;
  const cells = splitMarkdownTableRow(line);
  return cells.length > 1 && cells.some((cell) => cell.length > 0);
};

const isMarkdownTableSeparator = (line: string, columnCount: number) => {
  if (!line.includes('|')) return false;
  const cells = splitMarkdownTableRow(line);
  if (cells.length !== columnCount) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
};

const getMarkdownTableAlignment = (cell: string): MarkdownTableAlignment => {
  const normalized = cell.replace(/\s/g, '');
  const alignLeft = normalized.startsWith(':');
  const alignRight = normalized.endsWith(':');

  if (alignLeft && alignRight) return 'center';
  if (alignRight) return 'right';
  if (alignLeft) return 'left';
  return null;
};

const getCodeFenceMarker = (line: string) => {
  const match = line.match(/^\s*(`{3,}|~{3,})/);
  return match ? match[1] : null;
};

const parseMarkdownBlocks = (content: string): MarkdownBlock[] => {
  const lines = content.split('\n');
  const blocks: MarkdownBlock[] = [];
  const markdownBuffer: string[] = [];
  let activeFenceMarker: string | null = null;

  const flushMarkdownBuffer = () => {
    if (markdownBuffer.length === 0) return;
    blocks.push({ type: 'markdown', content: markdownBuffer.join('\n') });
    markdownBuffer.length = 0;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMarker = getCodeFenceMarker(line);

    if (fenceMarker) {
      if (!activeFenceMarker) {
        activeFenceMarker = fenceMarker;
      } else if (fenceMarker[0] === activeFenceMarker[0] && fenceMarker.length >= activeFenceMarker.length) {
        activeFenceMarker = null;
      }
      markdownBuffer.push(line);
      continue;
    }

    if (activeFenceMarker) {
      markdownBuffer.push(line);
      continue;
    }

    const headerCells = splitMarkdownTableRow(line);
    const nextLine = lines[index + 1];

    if (nextLine && isMarkdownTableHeader(line) && isMarkdownTableSeparator(nextLine, headerCells.length)) {
      flushMarkdownBuffer();

      const rows: string[][] = [];
      let rowIndex = index + 2;

      while (rowIndex < lines.length) {
        const rowLine = lines[rowIndex];
        if (!rowLine.trim() || !rowLine.includes('|')) break;

        const rowCells = splitMarkdownTableRow(rowLine);
        if (rowCells.length !== headerCells.length || isMarkdownTableSeparator(rowLine, headerCells.length)) break;

        rows.push(rowCells);
        rowIndex += 1;
      }

      blocks.push({
        type: 'table',
        header: headerCells,
        rows,
        alignments: splitMarkdownTableRow(nextLine).map(getMarkdownTableAlignment)
      });

      index = rowIndex - 1;
      continue;
    }

    markdownBuffer.push(line);
  }

  flushMarkdownBuffer();
  return blocks;
};

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div
    className={`glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70 ${className}`}
  >
    {children}
  </div>
);

const AgentMarkdown = ({ content }: { content: string }) => {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === 'markdown') {
          return <MarkdownContent key={`markdown-${index}`} content={block.content} />;
        }

        return (
          <div
            key={`table-${index}`}
            className="my-2 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/70 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
          >
            <table className="min-w-full border-collapse text-sm text-slate-700 dark:text-slate-200">
              <thead className="bg-slate-100/80 dark:bg-slate-800/90">
                <tr>
                  {block.header.map((cell, cellIndex) => {
                    const alignment = block.alignments[cellIndex];
                    return (
                      <th
                        key={`header-${cellIndex}`}
                        className={`border-b border-slate-200 px-3 py-2 align-top font-semibold dark:border-slate-700 ${
                          alignment ? tableAlignmentClassName[alignment] : 'text-left'
                        }`}
                      >
                        <MarkdownContent content={cell} className={compactMarkdownClassName} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="border-t border-slate-200/80 dark:border-slate-700/80">
                    {row.map((cell, cellIndex) => {
                      const alignment = block.alignments[cellIndex];
                      return (
                        <td
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className={`px-3 py-2 align-top ${
                            alignment ? tableAlignmentClassName[alignment] : 'text-left'
                          }`}
                        >
                          <MarkdownContent content={cell} className={compactMarkdownClassName} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default function AgentConsole() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [streamTraces, setStreamTraces] = useState<TraceItem[]>([]);
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null);
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
  const [selectedReviewIds, setSelectedReviewIds] = useState<number[]>([]);
  const [reviewSubmittingAction, setReviewSubmittingAction] = useState<ReviewAction | null>(null);
  const [crawlPending, setCrawlPending] = useState<number | null>(null);
  const [graphPending, setGraphPending] = useState<number | null>(null);
  const [onSaleTotal, setOnSaleTotal] = useState<number | null>(null);
  const [buildableTotal, setBuildableTotal] = useState<number | null>(null);
  const [progressError, setProgressError] = useState('');
  const [progressUpdatedAt, setProgressUpdatedAt] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamBufferRef = useRef('');
  const streamTracesRef = useRef<TraceItem[]>([]);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const progressPollingRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamBuffer, streamTraces, isStreaming]);

  const canSend = useMemo(() => input.trim().length > 0 && !isStreaming, [input, isStreaming]);
  const selectedReviewIdSet = useMemo(() => new Set(selectedReviewIds), [selectedReviewIds]);
  const allReviewItemsSelected = useMemo(
    () => reviewItems.length > 0 && reviewItems.every((item) => selectedReviewIdSet.has(item.id)),
    [reviewItems, selectedReviewIdSet]
  );

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
      if (progressPollingRef.current) {
        window.clearInterval(progressPollingRef.current);
      }
      if (copyFeedbackTimerRef.current) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
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

  const formatMetricValue = (value: number | null) => {
    if (value === null) return '—';
    return String(value);
  };

  const isBuildableResult = (item: ResultStatusItem) => {
    const normalizedStatus = String(item.status || '').trim().toUpperCase();
    if (normalizedStatus === 'CRAWLED') {
      return true;
    }
    return BUILDABLE_STATUSES.has(normalizedStatus) && Boolean(item.has_processed_markdown);
  };

  const fetchQueuePending = async (path: string) => {
    const res = await fetch(`${AGENT_API_BASE}${path}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`请求失败：${res.status}`);
    }
    const json = (await res.json()) as QueueStatusResponse;
    return Number.isFinite(json.pending) ? json.pending : 0;
  };

  const fetchOnSaleProductTotal = async () => {
    const res = await fetch(`${AGENT_API_BASE}/api/products?page=1&page_size=1`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`请求失败：${res.status}`);
    }
    const json = (await res.json()) as ProductListResponse;
    return Number.isFinite(json.total) ? json.total : 0;
  };

  const fetchBuildableTotal = async () => {
    let page = 1;
    let total = 0;
    let buildable = 0;

    while (page === 1 || (page - 1) * RESULT_PAGE_SIZE < total) {
      const res = await fetch(
        `${AGENT_API_BASE}/api/results?page=${page}&page_size=${RESULT_PAGE_SIZE}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        throw new Error(`请求失败：${res.status}`);
      }

      const json = (await res.json()) as ResultListResponse;
      const items = Array.isArray(json.items) ? json.items : [];
      total = Number.isFinite(json.total) ? json.total : items.length;
      buildable += items.filter(isBuildableResult).length;

      if (items.length === 0) {
        break;
      }
      page += 1;
    }

    return buildable;
  };

  const refreshExecutionProgress = async () => {
    const results = await Promise.allSettled([
      fetchQueuePending('/api/tasks/status'),
      fetchQueuePending('/api/results/graph/status'),
      fetchOnSaleProductTotal(),
      fetchBuildableTotal()
    ]);

    const errors: string[] = [];

    if (results[0].status === 'fulfilled') {
      setCrawlPending(results[0].value);
    } else {
      errors.push(`爬取进度获取失败：${results[0].reason instanceof Error ? results[0].reason.message : '未知错误'}`);
    }

    if (results[1].status === 'fulfilled') {
      setGraphPending(results[1].value);
    } else {
      errors.push(`构建进度获取失败：${results[1].reason instanceof Error ? results[1].reason.message : '未知错误'}`);
    }

    if (results[2].status === 'fulfilled') {
      setOnSaleTotal(results[2].value);
    } else {
      errors.push(`上架进度获取失败：${results[2].reason instanceof Error ? results[2].reason.message : '未知错误'}`);
    }

    if (results[3].status === 'fulfilled') {
      setBuildableTotal(results[3].value);
    } else {
      errors.push(`可构建数量获取失败：${results[3].reason instanceof Error ? results[3].reason.message : '未知错误'}`);
    }

    setProgressUpdatedAt(Date.now());
    setProgressError(errors[0] || '');
  };

  useEffect(() => {
    void refreshExecutionProgress();
    progressPollingRef.current = window.setInterval(() => {
      void refreshExecutionProgress();
    }, 60000);

    return () => {
      if (progressPollingRef.current) {
        window.clearInterval(progressPollingRef.current);
        progressPollingRef.current = null;
      }
    };
  }, []);

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

  const executionProgressCards = [
    {
      label: '爬取进度',
      value: formatMetricValue(crawlPending),
      hint: crawlPending === null ? '等待同步队列状态' : `排队或执行中 ${crawlPending} 个任务`,
      icon: FiActivity,
      tone: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-200'
    },
    {
      label: '构建进度',
      value: formatMetricValue(graphPending),
      hint: graphPending === null ? '等待同步图谱状态' : `排队或构建中 ${graphPending} 个任务`,
      icon: FiDatabase,
      tone: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-200'
    },
    {
      label: '上架进度',
      value: formatMetricValue(onSaleTotal),
      hint:
        onSaleTotal === null
          ? '等待同步商品状态'
          : reviewTotal > 0
            ? `已上架商品 ${onSaleTotal} 个，待审核 ${reviewTotal} 个`
            : `已上架商品 ${onSaleTotal} 个`,
      icon: FiPackage,
      tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200'
    },
    {
      label: '可构建数量',
      value: formatMetricValue(buildableTotal),
      hint: buildableTotal === null ? '等待计算可构建任务' : `当前可直接构建 ${buildableTotal} 个站点`,
      icon: FiTrendingUp,
      tone: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-200'
    }
  ];

  const flashCopiedState = (messageKey: string) => {
    setCopiedMessageKey(messageKey);
    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopiedMessageKey(null);
      copyFeedbackTimerRef.current = null;
    }, 1600);
  };

  const copyMessageWithExecCommand = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    try {
      textarea.select();
      const copied = document.execCommand('copy');
      if (!copied) {
        throw new Error('execCommand returned false');
      }
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const copyMessageText = async (text: string, messageKey: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          copyMessageWithExecCommand(text);
        }
      } else {
        copyMessageWithExecCommand(text);
      }
      flashCopiedState(messageKey);
    } catch (error) {
      console.warn('复制消息失败', error);
    }
  };

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
      const nextItems = json.items || [];
      const nextIds = new Set(nextItems.map((item) => item.id));
      setReviewItems(nextItems);
      setReviewTotal(Number.isFinite(json.total) ? json.total : nextItems.length);
      setSelectedReviewIds((prev) => prev.filter((id) => nextIds.has(id)));
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : '未知错误');
      setReviewItems([]);
      setReviewTotal(0);
      setSelectedReviewIds([]);
    } finally {
      setReviewLoading(false);
    }
  };

  const submitReviewAction = async (ids: number[], action: ReviewAction) => {
    if (reviewSubmittingAction) return;
    const normalizedIds = [...new Set(ids.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
    if (!normalizedIds.length) {
      setReviewError('请先选择待审核图谱');
      return;
    }
    setReviewSubmittingAction(action);
    setReviewError('');
    try {
      const res = await fetch(`${AGENT_API_BASE}/api/products/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: normalizedIds, action })
      });
      if (!res.ok) {
        let message = `请求失败：${res.status}`;
        try {
          const payload = (await res.json()) as { error?: string; detail?: string };
          if (payload?.error || payload?.detail) {
            message = payload.error || payload.detail || message;
          }
        } catch {
          // ignore malformed error payload
        }
        throw new Error(message);
      }
      setSelectedReviewIds((prev) => prev.filter((id) => !normalizedIds.includes(id)));
      await fetchReviewItems();
      await refreshExecutionProgress();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setReviewSubmittingAction(null);
    }
  };

  const toggleReviewSelection = (id: number) => {
    setSelectedReviewIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAllReviewSelection = () => {
    if (allReviewItemsSelected) {
      setSelectedReviewIds([]);
      return;
    }
    setSelectedReviewIds(reviewItems.map((item) => item.id));
  };

  const handleBatchReview = (action: ReviewAction) => {
    void submitReviewAction(selectedReviewIds, action);
  };

  const handleSingleReview = (id: number, action: ReviewAction) => {
    void submitReviewAction([id], action);
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {executionProgressCards.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-800/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{item.value}</p>
                      </div>
                      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                        <item.icon className="h-5 w-5" />
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{progressUpdatedAt ? `最近同步：${formatTime(new Date(progressUpdatedAt).toISOString())}` : '最近同步：—'}</span>
                {progressError ? <span className="text-amber-600 dark:text-amber-300">{progressError}</span> : null}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FiTrendingUp className="h-4 w-4 text-indigo-500" />
                最近执行轨迹
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
                  待审核 {reviewTotal}
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
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={allReviewItemsSelected}
                    onChange={toggleAllReviewSelection}
                    disabled={reviewItems.length === 0 || reviewSubmittingAction !== null}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                  全选当前页
                </label>
                <button
                  onClick={() => handleBatchReview('approve')}
                  disabled={selectedReviewIds.length === 0 || reviewSubmittingAction !== null}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewSubmittingAction === 'approve' ? '批准中...' : `批准选中 ${selectedReviewIds.length}`}
                </button>
                <button
                  onClick={() => handleBatchReview('reject')}
                  disabled={selectedReviewIds.length === 0 || reviewSubmittingAction !== null}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reviewSubmittingAction === 'reject' ? '拒绝中...' : `拒绝选中 ${selectedReviewIds.length}`}
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
                    暂无待审核图谱
                  </div>
                )}
                {reviewItems.map((item) => {
                  const title = item.name || item.site_name || '待审核图谱';
                  const updatedLabel = formatTime(item.graph_built_at || item.updated_at);
                  const isChecked = selectedReviewIdSet.has(item.id);
                  const isSubmitting = reviewSubmittingAction !== null;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200/70 p-3 shadow-sm dark:border-slate-800/70"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleReviewSelection(item.id)}
                          disabled={isSubmitting}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                          <p className="break-all text-sm text-slate-600 dark:text-slate-300">{item.url}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">图谱完成: {updatedLabel}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                          <FiClock className="h-4 w-4" />
                          待审核
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSingleReview(item.id, 'reject')}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-200"
                          >
                            拒绝
                          </button>
                          <button
                            onClick={() => handleSingleReview(item.id, 'approve')}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                          >
                            批准
                          </button>
                        </div>
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
                  {messages.map((msg, idx) => {
                    const messageKey = `${msg.role}-${idx}`;
                    const isCopied = copiedMessageKey === messageKey;

                    return (
                      <div key={messageKey} className={`group flex flex-col ${msg.role === 'agent' ? 'items-start' : 'items-end'}`}>
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
                        <div className="max-w-[85%]">
                          <div
                            className={`relative rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm transition-all duration-300 ${msg.role === 'agent'
                                ? 'rounded-tl-none border border-slate-100 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                                : 'rounded-tr-none bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                              }`}
                          >
                            {msg.role === 'agent' ? (
                              <AgentMarkdown content={msg.text} />
                            ) : (
                              <div className="whitespace-pre-wrap">{msg.text}</div>
                            )}
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
                          <div
                            className={`mt-2 flex ${msg.role === 'agent' ? 'justify-start pl-1' : 'justify-end pr-1'} transition-opacity duration-200 ${
                              isCopied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => void copyMessageText(msg.text, messageKey)}
                              aria-label={isCopied ? '已复制消息' : '复制消息'}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                                isCopied
                                  ? 'text-emerald-700 dark:text-emerald-200'
                                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                              }`}
                            >
                              {isCopied ? <FiCheck className="h-3.5 w-3.5" /> : <FiCopy className="h-3.5 w-3.5" />}
                              {isCopied ? '已复制' : '复制'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

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
                          <AgentMarkdown content={streamBuffer} />
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
