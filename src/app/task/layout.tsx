import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '任务队列 | 网站信息知识图谱'
};

export default function TaskLayout({ children }: { children: ReactNode }) {
  return children;
}
