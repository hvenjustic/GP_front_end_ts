import type { ComponentType, ReactNode } from 'react';
import type { Metadata } from 'next';
import {
  FiArrowUpRight,
  FiDatabase,
  FiGlobe,
  FiMessageCircle,
  FiSearch,
  FiSend,
  FiTool,
} from 'react-icons/fi';

export const metadata: Metadata = {
  title: '对话演示 | 网站信息知识图谱'
};

const chatFeatures = [
  {
    title: '图谱问答',
    description: '围绕组织、产品、工艺等实体进行自然语言查询，并返回结构化结果。',
    icon: FiMessageCircle
  },
  {
    title: '工具调用',
    description: '可将自然语言请求转为 crawl、build_graph、图谱检索等工具调用。',
    icon: FiTool
  },
  {
    title: '结果可追踪',
    description: '支持展示工具规划、调用结果与最终回答，便于答辩时解释系统过程。',
    icon: FiSearch
  },
  {
    title: '面向企业官网场景',
    description: '对话语义围绕企业官网采集、图谱构建和按产品找公司等场景展开。',
    icon: FiGlobe
  }
];

const MessageBubble = ({
  sender,
  tone,
  children
}: {
  sender: '用户' | '助手';
  tone?: 'accent';
  children: ReactNode;
}) => (
  <div
    className={`max-w-xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
      sender === '助手'
        ? 'bg-indigo-50 text-slate-800 dark:bg-indigo-900/30 dark:text-indigo-50'
        : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'
    } ${tone === 'accent' ? 'border border-indigo-200 dark:border-indigo-800/70' : ''}`}
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{sender}</p>
    <div className="mt-1 space-y-1 text-sm leading-relaxed">{children}</div>
  </div>
);

const FeatureCard = ({
  title,
  description,
  icon: Icon
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) => (
  <div className="glass-panel rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-200">
        <Icon className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </div>
  </div>
);

export default function ChatPage() {
  return (
    <div className="relative isolate px-6 pb-16">
      <section className="mx-auto mt-8 max-w-[108rem] overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-8 shadow-lg backdrop-blur md:p-12 dark:border-white/10 dark:bg-slate-900/80">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
              <FiSend className="h-4 w-4" />
              对话演示
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                面向企业官网知识图谱的静态对话演示页。
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                这个页面用于展示毕业设计中的典型问答场景：按产品找公司、触发图谱构建、解释回答依据。
                实时流式版本请查看 Agent 页面。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-500"
              >
                查看能力
                <FiArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="#transcript"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                预览对话
              </a>
            </div>
          </div>
          <div className="glass-panel space-y-3 rounded-2xl border border-gray-200/60 bg-white/70 p-5 text-sm shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" id="transcript">
              对话示例
            </p>
            <div className="space-y-3">
              <MessageBubble sender="用户">帮我找一下生产感冒药相关产品的企业。</MessageBubble>
              <MessageBubble sender="助手">
                我在图谱中匹配到 2 家企业：
                <ul className="list-disc pl-5">
                  <li>康宁药业股份有限公司：命中产品“感冒灵颗粒”。</li>
                  <li>华瑞制药有限公司：命中用途字段“用于感冒治疗和退热”。</li>
                </ul>
              </MessageBubble>
              <MessageBubble sender="用户">把 site_id 为 12 的站点加入图谱构建。</MessageBubble>
              <MessageBubble sender="助手" tone="accent">
                已准备调用 <code>build_graph(site_id=12)</code>。在实时 Agent 页面中，这一步会显示工具 trace。
                <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100">
                  预期结果：任务入队成功，随后可在结果页查看构建状态与图谱详情。
                </div>
              </MessageBubble>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-[108rem]" id="features">
        <div className="mb-4 flex items-center gap-2">
          <FiDatabase className="h-4 w-4 text-indigo-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">对话能力</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {chatFeatures.map((item) => (
            <FeatureCard key={item.title} title={item.title} description={item.description} icon={item.icon} />
          ))}
        </div>
      </section>
    </div>
  );
}
