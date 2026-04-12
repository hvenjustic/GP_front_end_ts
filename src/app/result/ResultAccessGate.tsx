'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredToken, subscribeAuthToken } from '@/components/auth/authStorage';
import { getAuthMe } from '@/lib/userCenterApi';
import { isAdminRole } from '@/lib/userRole';
import ResultListClient from './ResultListClient';

export default function ResultAccessGate() {
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
        router.replace('/products');
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
      router.replace('/products');
    };

    setAllowed(false);
    void verifyAccess();

    return () => {
      cancelled = true;
    };
  }, [authToken, router]);

  if (!allowed) {
    return (
      <div className="px-6 pb-16">
        <div className="mx-auto mt-8 max-w-[108rem]">
          <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
            正在校验管理员权限，非管理员将自动跳转到产品页。
          </div>
        </div>
      </div>
    );
  }

  return <ResultListClient />;
}
