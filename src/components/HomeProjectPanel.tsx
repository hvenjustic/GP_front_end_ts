'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  FiArrowUpRight,
  FiBookOpen,
  FiCpu,
  FiDatabase,
  FiGlobe,
  FiMapPin,
  FiMessageCircle,
} from 'react-icons/fi';
import { getStoredToken, subscribeAuthToken } from '@/components/auth/authStorage';
import { getAuthMe } from '@/lib/userCenterApi';
import { isAdminRole } from '@/lib/userRole';

const pipeline = [
  {
    step: '01',
    title: '站点录入与爬取',
    body: '录入企业官网 URL 后进入 crawl 队列，抓取页面正文、链接和基础状态。'
  },
  {
    step: '02',
    title: 'Markdown 清洗与分块',
    body: '将页面内容清洗为适合大模型处理的 Markdown，并按页或标题块进行切分。'
  },
  {
    step: '03',
    title: '多段 Prompt 图谱抽取',
    body: '围绕组织、产品、工艺等知识域拆分为多段抽取任务，降低长上下文干扰。'
  },
  {
    step: '04',
    title: '结果落库与查询分析',
    body: '图谱结果写入 MySQL 与 Neo4j，并在结果页、图谱页和 Agent 中联动展示。'
  }
];

const entries = [
  {
    href: '/result/',
    title: '结果列表',
    body: '查看站点状态、页面数、构图时长，并批量触发重爬或建图。',
    icon: FiDatabase,
    adminOnly: true
  },
  {
    href: '/graph/',
    title: '地理分布',
    body: '读取站点地理位置，在世界地图上展示采集样本分布。',
    icon: FiMapPin
  },
  {
    href: '/agent/',
    title: 'Agent 控制台',
    body: '通过 SSE 查看工具规划、调用、结果和最终回答。',
    icon: FiCpu,
    adminOnly: true
  },
  {
    href: '/chat/',
    title: '用户 Agent',
    body: '与管理员使用同一套控制台外观，但仅开放查询型对话能力。',
    icon: FiBookOpen
  },
  {
    href: '/products/',
    title: '产品实体库',
    body: '回看从已建图站点中同步出的产品实体，并展开关联图谱。',
    icon: FiGlobe
  }
];

const highlights = [
  '适合答辩展示的最小闭环是：站点结果 -> 图谱详情 -> 地图分布 -> Agent 问答。',
  '图谱抽取 Prompt 已按 part_1 ~ part_6 拆分，便于论文中解释抽取设计。',
  'Agent 页面可展示 trace 过程，适合说明系统不仅能回答，还能调用工具。'
];

export default function HomeProjectPanel() {
  const [showAdminEntries, setShowAdminEntries] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refreshRole = async (token: string) => {
      if (!token.trim()) {
        if (!cancelled) {
          setShowAdminEntries(false);
        }
        return;
      }

      try {
        const user = await getAuthMe();
        if (!cancelled) {
          setShowAdminEntries(isAdminRole(user.role));
        }
      } catch {
        if (!cancelled) {
          setShowAdminEntries(false);
        }
      }
    };

    const initialToken = getStoredToken();
    void refreshRole(initialToken);

    const unsubscribe = subscribeAuthToken((token) => {
      void refreshRole(token);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const visibleEntries = useMemo(
    () => entries.filter((item) => !item.adminOnly || showAdminEntries),
    [showAdminEntries]
  );

  return (
    <section className="mx-auto mt-10 grid max-w-[108rem] gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
        <div className="mb-4 flex items-center gap-2">
          <FiDatabase className="h-4 w-4 text-sky-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">系统主流程</h2>
        </div>
        <div className="space-y-3">
          {pipeline.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/50"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                  {item.step}
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
          <div className="mb-4 flex items-center gap-2">
            <FiMessageCircle className="h-4 w-4 text-indigo-500" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">演示入口</h2>
          </div>
          <div className="grid gap-3">
            {visibleEntries.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 dark:border-slate-800/70 dark:bg-slate-900/50 dark:hover:border-indigo-700"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-200">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-slate-900 dark:text-white">{item.title}</p>
                      <FiArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-500" />
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.body}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
          <div className="mb-4 flex items-center gap-2">
            <FiGlobe className="h-4 w-4 text-emerald-500" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">答辩讲解点</h2>
          </div>
          <div className="space-y-3">
            {highlights.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
