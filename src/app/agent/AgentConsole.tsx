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
  FiSend,
  FiShoppingCart,
  FiTrendingUp
} from 'react-icons/fi';
import { AGENT_API_BASE } from '@/config/api';

type ChatMessage = {
  role: 'user' | 'agent';
  text: string;
  citations?: string[];
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

const initialChat: ChatMessage[] = [
  { role: 'user', text: '帮我推荐 4000 元以内拍照好的手机，最好有分期' },
  { role: 'agent', text: '已找到 3 款高分机型：小米 14、荣耀 200、三星 A55。需要偏好安卓还是 iOS？' },
  { role: 'user', text: '安卓，并且电池大一些' },
  { role: 'agent', text: '建议荣耀 200（5000mAh），附带 12 期免息。需要加购快充头和壳膜吗？' }
];

const automations = [
  { title: '库存巡检与自动上架', status: '监控中', owner: '运营 Agent', steps: ['读取库存节点', '触发补货工单', '库存恢复自动上架'] },
  { title: '智能调价与关联推荐', status: '试运行', owner: '定价 Agent', steps: ['竞品比价', '生成加购/替代推荐', '等待确认执行'] },
  { title: '客服对话助手', status: '活跃', owner: '对话 Agent', steps: ['意图识别', '知识检索', '多轮回复草稿'] }
];

const workQueue = [
  { title: '补货申请 · AirPods Pro 2', detail: '库存 < 5 · 华北仓', eta: '等待确认', priority: '高' },
  { title: '上架草案 · 小米 14 Ultra', detail: '规格/图像已整理', eta: '10 分钟前', priority: '中' },
  { title: '调价建议 · Galaxy S24', detail: '比竞品高 12% · 建议降价 600 元', eta: '5 分钟前', priority: '高' }
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

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div
    className={`glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70 ${className}`}
  >
    {children}
  </div>
);

export default function AgentConsole() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isStreaming, [input, isStreaming]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const appendAgentToken = (delta: string) => {
    setStreamBuffer((prev) => prev + delta);
  };

  const finalizeAgentMessage = (citations?: string[]) => {
    setMessages((prev) => [...prev, { role: 'agent', text: streamBuffer || '（空响应）', citations }]);
    setStreamBuffer('');
    setIsStreaming(false);
  };

  const startMockStream = () => {
    setIsStreaming(true);
    const mock = [
      { delay: 200, delta: '收到，正在从知识图谱检索库存与竞品...' },
      { delay: 900, delta: ' 推荐荣耀 200（5000mAh），华北仓现货；' },
      { delay: 1500, delta: ' 可选 12 期免息，附带 65W 快充套装。' }
    ];
    mock.forEach(({ delay, delta }, idx) => {
      setTimeout(() => {
        appendAgentToken(delta);
        if (idx === mock.length - 1) finalizeAgentMessage(['graph:stock', 'graph:pricing']);
      }, delay);
    });
  };

  const startSSEStream = (query: string) => {
    const url = `${AGENT_API_BASE}/api/chat/agent/stream?message=${encodeURIComponent(query)}`;
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
    });

    es.addEventListener('meta', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as StreamMeta;
      console.info('stream meta', payload);
    });

    es.onerror = () => {
      console.warn('SSE 连接失败，使用 mock 流数据');
      es.close();
      startMockStream();
    };
  };

  const handleSend = () => {
    if (!canSend) return;
    const text = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    startSSEStream(text);
  };

  return (
    <div className="relative isolate h-[calc(100vh-80px)] overflow-hidden px-6 pb-0">
      <section className="mx-auto mt-4 flex h-full max-w-[108rem] flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-6 shadow-lg backdrop-blur md:p-8 dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
              <FiCpu className="h-4 w-4" />
              知识图谱电商 Agent
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-500"
              >
                查看执行日志
                <FiArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                接入 LangChain
              </a>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">运营指挥台 · 三栏布局</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            左：Agent 执行进度与统计 · 中：与用户实时聊天 · 右：审核待办与运营编排。接口接入后可替换为实时数据。
          </p>
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
                  需人工确认
                </span>
              </div>
              <div className="space-y-3">
                {workQueue.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200/70 p-3 shadow-sm dark:border-slate-800/70"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">更新: {item.eta}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <FiClock className="h-4 w-4" />
                        {item.priority}
                      </span>
                      <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                        审核
                      </button>
                    </div>
                  </div>
                ))}
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
            <Card className="h-full w-full">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FiMessageCircle className="h-4 w-4 text-indigo-500" />
                  用户对话
                </div>
                <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  Chat
                </span>
              </div>
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-200/60 bg-white/70 p-3 dark:border-slate-800/60 dark:bg-slate-900/60">
                  {messages.map((msg, idx) => (
                    <div key={`${msg.role}-${idx}`} className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
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
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl bg-indigo-600 px-4 py-2 text-sm text-white shadow-sm">
                        {streamBuffer || 'Agent 正在回应...'}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                    <FiShoppingCart className="h-4 w-4 text-indigo-500" />
                    <span className="text-slate-600 dark:text-slate-300">
                      示例：想买 4000 元内拍照好、续航大的安卓手机
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                      placeholder="输入你的问题，稍后对接 LangChain"
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
