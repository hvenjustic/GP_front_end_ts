import type { Metadata } from 'next';
import GraphClient from './GraphClient';

export const metadata: Metadata = {
  title: '情报监控 | 网站信息知识图谱'
};

export default function GraphPage() {
  return <GraphClient />;
}
