'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredToken, subscribeAuthToken } from '@/components/auth/authStorage';
import { getAuthMe } from '@/lib/userCenterApi';
import { isAdminRole } from '@/lib/userRole';
import AgentConsole from './AgentConsole';

export default function AgentAccessGate() {
  const router = useRouter();
  const [authToken, setAuthToken] = useState('');
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAuthToken(getStoredToken());
    return subscribeAuthToken((token) => setAuthToken(token));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const verifyAccess = async () => {
      const token = (authToken || getStoredToken()).trim();
      if (!token) {
        router.replace('/chat');
        return;
      }

      try {
        const user = await getAuthMe();
        if (cancelled) return;
        if (isAdminRole(user.role)) {
          setAllowed(true);
          return;
        }
      } catch {
        if (cancelled) return;
      }

      setAllowed(false);
      router.replace('/chat');
    };

    setAllowed(false);
    void verifyAccess();

    return () => {
      cancelled = true;
    };
  }, [authToken, router]);

  if (!allowed) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-3xl items-center justify-center px-6">
        <div className="w-full rounded-3xl border border-slate-200/80 bg-white/90 px-8 py-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">正在校验管理员权限</div>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">非管理员会自动跳转到用户工作台。</div>
        </div>
      </div>
    );
  }

  return <AgentConsole mode="admin" />;
}
