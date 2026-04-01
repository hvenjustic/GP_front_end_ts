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
import QuickActions from '@/components/QuickActions';

const statHighlights = [
  {
    label: '图谱覆盖',
    value: '38k 节点 · 120k 关系',
    detail: '商品-品牌-属性-品类全链路关系，驱动推荐与问答。',
    accent: 'from-indigo-500/20 to-sky-500/15'
  },
  {
    label: '库存健康',
    value: '93% 安全库存',
    detail: '低库存实时告警，自动生成补货工单并进入 Agent 审核。',
    accent: 'from-emerald-500/15 to-lime-400/15'
  },
  {
    label: '对话满意度',
    value: '4.7 / 5 CSAT',
    detail: 'LangChain 检索增强对话，回复附引用与推荐 SKU。',
    accent: 'from-amber-400/20 to-orange-500/20'
  }
];

const tracks = [
  {
    title: '商品知识图谱',
    icon: FiLayers,
    points: ['品牌-品类-属性实体建模', '关系驱动关联推荐与检索', '节点信号供运营与对话调用']
  },
  {
    title: '运营 Agent 编排',
    icon: FiCpu,
    points: ['库存巡检与补货工单', '动态调价与促销建议', '审核队列 + 人工兜底']
  },
  {
    title: '对话助手',
    icon: FiMessageCircle,
    points: ['RAG 检索 + 引用输出', '多轮意图与商品匹配', '可嵌入客服或导购场景']
  }
];

const activity = [
  {
    title: '图谱数据导入',
    body: '完成 3 万商品与 12 万关系的批量导入，节点标签优化用于检索。',
    tag: 'graph',
    when: '刚刚'
  },
  {
    title: 'Agent 自动补货',
    body: '补货工单支持优先级与审批人，提交后写入审计日志。',
    tag: 'agent',
    when: '今天'
  },
  {
    title: '对话引用',
    body: '对话流新增引用标注，便于复核推荐依据并二次确认下单。',
    tag: 'chat',
    when: '今天'
  }
];

const blueprint = `template
├── package.json
├── next.config.js
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── src
    ├── app
    │   ├── layout.tsx
    │   ├── page.tsx          # 首页 · 项目概览
    │   ├── agent             # 运营 Agent 面板
    │   │   ├── page.tsx
    │   │   └── AgentConsole.tsx
    │   ├── chat              # 对话入口
    │   │   └── page.tsx
    │   └── products          # 商品陈列
    │       └── page.tsx
    └── components
        ├── ThemeToggle.tsx
        ├── QuickActions.tsx
        └── navBar
            └── Navbar.tsx`;

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
              <Pill text="知识图谱驱动" />
              <Pill text="运营 Agent" />
              <Pill text="对话导购" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                网站信息知识图谱 · 运营与导购的一体化前台。
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                基于 Next.js 与 Tailwind 的前端壳，嵌入了图谱商品关系、运营 Agent 面板、对话导购入口。可直接接入后端接口或 LangChain 服务。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#blueprint"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:bg-indigo-500"
              >
                查看结构
                <FiArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="#actions"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                接入后端
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

      <section className="mx-auto mt-10 max-w-[108rem]" id="activity">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">动态</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">项目最近更新</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <FiTrendingUp className="h-4 w-4" />
            今日更新
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
                <span>接入指引</span>
              </div>
              <p>依赖装好后直接运行 <code>npm run dev</code>，首页、Agent、商品、聊天四个页面均可预览。</p>
              <p>将接口对接到 <code>/api/agent</code>、<code>/api/products</code>、<code>/api/chat/agent</code>，即可展示实时数据与推荐。</p>
              <p>替换 <code>public/context-icon.svg</code> 进行品牌化，或在 <code>globals.css</code> 调整渐变与玻璃拟态样式。</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto mt-10 max-w-[108rem]" id="actions">
        <div className="mb-4 flex items-center gap-2">
          <FiZap className="h-4 w-4 text-amber-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">接入与上线</h2>
        </div>
        <QuickActions />
      </section>
    </div>
  );
}
