import type { ReactNode } from 'react';
import {
  FiArrowUpRight,
  FiBookOpen,
  FiCheckCircle,
  FiCpu,
  FiLayers,
  FiMessageCircle,
  FiTrendingUp,
  FiZap
} from 'react-icons/fi';
import HomeProjectPanel from '@/components/HomeProjectPanel';
import QuickActions from '@/components/QuickActions';

const statHighlights = [
  {
    label: '抽取策略',
    value: '6 段 Prompt · 分块建图',
    detail: '按知识域拆分抽取任务，结合页面切块降低长文本输入的不稳定性。',
    accent: 'from-indigo-500/20 to-sky-500/15'
  },
  {
    label: '任务编排',
    value: 'Crawl / Graph 双队列',
    detail: '爬取和建图解耦执行，支持状态机管理、失败恢复和批量入队。',
    accent: 'from-emerald-500/15 to-lime-400/15'
  },
  {
    label: 'Agent 联动',
    value: 'SSE 流式 · Tool Trace',
    detail: '支持实时对话、工具调用过程展示和按产品找公司的图谱查询能力。',
    accent: 'from-amber-400/20 to-orange-500/20'
  }
];

const tracks = [
  {
    title: '网站采集与预处理',
    icon: FiLayers,
    points: ['企业官网 URL 录入与批量任务管理', 'Firecrawl 抓取页面并保留最新快照', 'Markdown 清洗与页面级切分']
  },
  {
    title: '多段图谱抽取',
    icon: FiCpu,
    points: ['part_1 ~ part_6 拆分知识域', '长页面按标题块和字符数分块', '实体归一、关系清洗、图谱落库']
  },
  {
    title: '查询与 Agent 分析',
    icon: FiMessageCircle,
    points: ['按产品关键词匹配企业', 'SSE 对话与工具 trace 回放', '结果页、图谱页、地图页联动展示']
  }
];

const activity = [
  {
    title: '状态机统一',
    body: '站点任务从 NEW 到 GRAPH_DONE 使用统一状态机，便于前后端同步展示。',
    tag: 'graph',
    when: '当前版本'
  },
  {
    title: '图谱抽取分段化',
    body: '抽取 Prompt 已拆为 6 个部分，覆盖组织、产品、工艺等不同知识域。',
    tag: 'prompt',
    when: '当前版本'
  },
  {
    title: '对话 trace 持久化',
    body: 'Agent 对话支持工具规划、工具调用、工具结果的流式展示与历史回放。',
    tag: 'agent',
    when: '当前版本'
  }
];

const blueprint = `konwledge-graph
├── GP_back_end_py
│   ├── app
│   │   ├── services          # 爬取、建图、查询、Agent
│   │   ├── handlers          # API 处理
│   │   └── repositories      # 数据访问
│   ├── prompts
│   │   └── graph_extract     # 图谱抽取 Prompt
│   └── tests                 # 后端测试
└── GP_front_end_ts
    └── src
        ├── app
        │   ├── page.tsx      # 首页 · 项目总览
        │   ├── result        # 站点结果列表
        │   ├── graph         # 地理分布
        │   ├── products      # 产品实体库
        │   ├── agent         # Agent 面板
        │   └── chat          # 静态对话演示
        └── components
            ├── HomeProjectPanel.tsx
            ├── QuickActions.tsx
            └── navBar/Navbar.tsx`;

const Pill = ({ text }: { text: string }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/50 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-indigo-200">
    <FiCheckCircle className="h-3 w-3" />
    {text}
  </span>
);

const Card = ({ children }: { children: ReactNode }) => (
  <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-gray-800/60 dark:bg-slate-900/70">
    {children}
  </div>
);

export default function Home() {
  return (
    <div className="relative isolate px-6 pb-16">
      <section className="mx-auto mt-8 max-w-[108rem] overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-8 shadow-lg backdrop-blur md:p-12 dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Pill text="企业官网抽取" />
              <Pill text="知识图谱构建" />
              <Pill text="Agent 辅助分析" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                生物制造知识图谱自动构建与分析平台。
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                这是毕业设计的前端展示层，围绕企业官网采集、图谱抽取、图谱可视化、地理分布和 Agent 对话构建完整演示链路。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#tracks"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-500"
              >
                查看流程
                <FiArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="/products/"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                查看产品页
              </a>
            </div>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-md">
            {statHighlights.map((item) => (
              <Card key={item.label}>
                <div className={`rounded-xl bg-gradient-to-br ${item.accent} p-4`}>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-[108rem] gap-6 lg:grid-cols-3" id="tracks">
        {tracks.map((track) => (
          <Card key={track.title}>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-200">
                <track.icon className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{track.title}</h3>
                  <FiArrowUpRight className="h-4 w-4 text-slate-400" />
                </div>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {track.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <FiCheckCircle className="mt-0.5 h-4 w-4 text-emerald-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <HomeProjectPanel />

      <section className="mx-auto mt-10 max-w-[108rem]" id="activity">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">动态</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">项目当前重点</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <FiTrendingUp className="h-4 w-4" />
            当前版本
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {activity.map((item) => (
            <Card key={item.title}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.body}</p>
                </div>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
                  {item.tag}
                </span>
              </div>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{item.when}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-[108rem]" id="blueprint">
        <div className="mb-4 flex items-center gap-2">
          <FiLayers className="h-4 w-4 text-indigo-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">目录蓝图</h2>
        </div>
        <Card>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <pre className="max-h-[320px] overflow-auto rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100 shadow-inner">
{blueprint}
            </pre>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <FiBookOpen className="h-4 w-4 text-indigo-500" />
                <span>阅读建议</span>
              </div>
              <p>先看后端的 <code>app/services</code>，可以快速抓住爬取、建图、查询和 Agent 的主逻辑。</p>
              <p>前端建议从 <code>/result</code>、<code>/graph</code>、<code>/agent</code> 三个页面进入，最适合答辩演示。</p>
              <p>抽取策略相关内容集中在 <code>prompts/graph_extract</code>，适合在论文中解释知识设计和 Prompt 分工。</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto mt-10 max-w-[108rem]" id="actions">
        <div className="mb-4 flex items-center gap-2">
          <FiZap className="h-4 w-4 text-amber-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">收尾与演示</h2>
        </div>
        <QuickActions />
      </section>
    </div>
  );
}
