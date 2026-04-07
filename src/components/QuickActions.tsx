'use client';

import { motion } from 'framer-motion';
import { FiArrowUpRight, FiCompass, FiDatabase, FiZap } from 'react-icons/fi';

const quickActions = [
  {
    title: '固定演示样站',
    body: '选定 3 到 5 个企业官网作为答辩样本，提前跑通重爬、建图和查询流程。',
    cta: '整理样本',
    icon: FiDatabase
  },
  {
    title: '校对抽取结果',
    body: '针对产品、组织、工艺等重点实体抽样核对，形成论文中的实验与误差分析素材。',
    cta: '抽样复核',
    icon: FiCompass
  },
  {
    title: '补齐展示材料',
    body: '准备 README、系统流程图、接口说明和演示截图，把项目收束成可答辩版本。',
    cta: '整理文档',
    icon: FiZap
  }
];

export default function QuickActions() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {quickActions.map((action) => (
        <motion.div
          key={action.title}
          whileHover={{ translateY: -4 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="glass-panel rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/80"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <action.icon className="h-4 w-4 text-indigo-500" />
            {action.title}
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{action.body}</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
            {action.cta}
            <FiArrowUpRight className="h-3 w-3" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
