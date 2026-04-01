import type { Metadata } from 'next';
import AgentConsole from './AgentConsole';

export const metadata: Metadata = {
  title: 'Agent | 网站信息知识图谱'
};

export default function AgentPage() {
  return <AgentConsole />;
}
