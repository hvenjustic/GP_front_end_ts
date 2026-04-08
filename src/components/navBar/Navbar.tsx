'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowUpRight, FiMenu, FiUser, FiX } from 'react-icons/fi';
import AuthDialog from '@/components/auth/AuthDialog';
import { clearStoredToken, getStoredToken, subscribeAuthDialogOpen, subscribeAuthToken } from '@/components/auth/authStorage';
import ThemeToggle from '@/components/ThemeToggle';
import { API_BASE } from '@/config/api';
import {
  RESULT_LIST_LAST_HREF_EVENT,
  RESULT_LIST_LAST_HREF_STORAGE_KEY,
  buildResultListHref,
  normalizeResultSort
} from '@/app/result/resultListNavigation';

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/graph/', label: '地理分布' },
  { href: '/products/', label: '产品实体' },
  { href: '/agent/', label: 'Agent' },
  { href: '/result/', label: '结果列表' },
  { href: '/chat/', label: '对话演示' }
];

export default function Navbar() {
  const pathname = usePathname();
  const normalizedPath = useMemo(() => (pathname === '/' ? '/' : pathname.replace(/\/+$/, '')), [pathname]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [resultNavHref, setResultNavHref] = useState('/result');

  const syncUserFromToken = async (token: string) => {
    if (!token) {
      setUserName('');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        clearStoredToken();
        setUserName('');
        return;
      }
      if (!res.ok) {
        setUserName('');
        return;
      }
      const data = (await res.json()) as { nickname?: string | null; email?: string | null };
      setUserName(String(data.nickname || data.email || '').trim());
    } catch {
      setUserName('');
    }
  };

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      if (normalizedPath === '/result') {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const nextHref = buildResultListHref(
          Math.max(1, Number(params.get('page')) || 1),
          Math.max(1, Number(params.get('page_size')) || 10),
          normalizeResultSort(params.get('sort'))
        );
        sessionStorage.setItem(RESULT_LIST_LAST_HREF_STORAGE_KEY, nextHref);
        setResultNavHref(nextHref);
        return;
      }

      const storedHref = sessionStorage.getItem(RESULT_LIST_LAST_HREF_STORAGE_KEY);
      setResultNavHref(storedHref || '/result');
    } catch {
      setResultNavHref('/result');
    }
  }, [normalizedPath]);

  useEffect(() => {
    const handleResultHrefChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ href?: string }>;
      const href = String(customEvent.detail?.href || '').trim();
      if (href) {
        setResultNavHref(href);
      }
    };

    window.addEventListener(RESULT_LIST_LAST_HREF_EVENT, handleResultHrefChanged as EventListener);
    return () => {
      window.removeEventListener(RESULT_LIST_LAST_HREF_EVENT, handleResultHrefChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    const initialToken = getStoredToken();
    void syncUserFromToken(initialToken);

    const unsubscribeAuth = subscribeAuthToken((token) => {
      void syncUserFromToken(token);
    });
    const unsubscribeDialog = subscribeAuthDialogOpen(() => {
      setIsAuthOpen(true);
    });
    return () => {
      unsubscribeAuth();
      unsubscribeDialog();
    };
  }, []);

  const authButton = userName ? (
    <div className="inline-flex max-w-[12rem] items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
      <FiUser className="h-4 w-4 shrink-0" />
      <span className="truncate">{userName}</span>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setIsAuthOpen(true)}
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-500"
    >
      登录
      <FiArrowUpRight className="h-4 w-4" />
    </button>
  );

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-white/30 bg-white/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Image src="/context-icon.svg" alt="Logo" width={40} height={30} className="h-9 w-auto" />
              企业官网图谱
            </Link>
            <span className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 md:inline-flex dark:border-slate-800 dark:text-slate-300">
              毕业设计
            </span>
            <span className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 md:inline-flex dark:border-slate-800 dark:text-slate-300">
              FastAPI + Next.js
            </span>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => {
              const normalizedHref = link.href === '/' ? '/' : link.href.replace(/\/+$/, '');
              const resolvedHref = normalizedHref === '/result' ? resultNavHref : link.href;
              const isActive =
                normalizedPath === normalizedHref || (normalizedHref !== '/' && normalizedPath.startsWith(normalizedHref));
              return (
                <Link
                  key={link.href}
                  href={resolvedHref}
                  className="group relative text-sm font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-2 left-0 h-0.5 bg-indigo-500 transition-all duration-200 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </Link>
              );
            })}
            <ThemeToggle />
            {authButton}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              {isOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="md:hidden"
            >
              <div className="space-y-1 border-t border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                {navLinks.map((link) => {
                  const normalizedHref = link.href === '/' ? '/' : link.href.replace(/\/+$/, '');
                  const resolvedHref = normalizedHref === '/result' ? resultNavHref : link.href;
                  return (
                    <Link
                      key={link.href}
                      href={resolvedHref}
                      className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {link.label}
                    </Link>
                  );
                })}
                {userName ? (
                  <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                    <FiUser className="h-4 w-4" />
                    <span className="truncate">{userName}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setIsAuthOpen(true);
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    登录
                    <FiArrowUpRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      <AuthDialog open={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
