import type { Metadata } from 'next';
import ChatClient from './ChatClient';

export const metadata: Metadata = {
  title: '用户 Agent | 网站信息知识图谱'
};

export default function ChatPage() {
  return <ChatClient />;
}
