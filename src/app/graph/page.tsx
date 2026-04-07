import type { Metadata } from 'next';
import GraphClient from './GraphClient';

export const metadata: Metadata = {
  title: '地理分布 | 网站信息知识图谱'
};

export default function GraphPage() {
  return <GraphClient />;
}
