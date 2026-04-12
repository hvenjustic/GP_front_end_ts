import type { Metadata } from 'next';
import AgentAccessGate from './AgentAccessGate';

export const metadata: Metadata = {
  title: 'Agent | 网站信息知识图谱'
};

export default function AgentPage() {
  return <AgentAccessGate />;
}
