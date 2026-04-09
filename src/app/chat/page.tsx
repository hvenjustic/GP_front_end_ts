import type { Metadata } from 'next';
import ChatClient from './ChatClient';

export const metadata: Metadata = {
  title: '对话展示 | 网站信息知识图谱'
};

export default function ChatPage() {
  return <ChatClient />;
}
