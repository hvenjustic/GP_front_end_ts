'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowUpRight,
  FiChevronDown,
  FiCreditCard,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiRefreshCw,
  FiShoppingBag,
  FiUser,
  FiX,
} from 'react-icons/fi';
import AuthDialog from '@/components/auth/AuthDialog';
import { getStoredToken, subscribeAuthDialogOpen, subscribeAuthToken } from '@/components/auth/authStorage';
import ThemeToggle from '@/components/ThemeToggle';
import {
  type ListOrdersResponse,
  type ListPurchasedGraphsResponse,
  type ListRechargeOrdersResponse,
  type ShopUser,
  createRechargeOrder,
  getAuthMe,
  listOrders,
  listPurchasedGraphs,
  listRechargeOrders,
  logoutUser,
} from '@/lib/userCenterApi';
import { isAdminRole } from '@/lib/userRole';
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
  { href: '/agent/', label: 'Agent', adminOnly: true },
  { href: '/result/', label: '结果列表', adminOnly: true },
  { href: '/chat/', label: '对话演示' }
];

const PAGE_SIZE = 5;

type WalletSection = 'balance' | 'recharge';

type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  maxWidthClassName?: string;
  children: ReactNode;
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function formatStatusLabel(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'paid') return '已支付';
  if (normalized === 'pending_payment') return '待支付';
  if (normalized === 'cancelled') return '已取消';
  if (normalized === 'expired') return '已过期';
  if (normalized === 'graph_done') return '图谱已构建';
  if (normalized === 'graphing') return '图谱构建中';
  if (normalized === 'paid') return '已支付';
  return String(value || '未知状态');
}

function statusClassName(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'paid' || normalized === 'graph_done') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200';
  }
  if (normalized === 'pending_payment' || normalized === 'graphing') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200';
  }
  if (normalized === 'cancelled' || normalized === 'expired') {
    return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200';
}

function formatYuanFromFen(fen: number) {
  return `¥${(Math.max(Number(fen) || 0, 0) / 100).toFixed(2)}`;
}

function getUserDisplayName(user: ShopUser | null) {
  return String(user?.nickname || user?.email || '').trim();
}

function ModalShell({ open, onClose, title, subtitle, maxWidthClassName = 'max-w-4xl', children }: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <button type="button" aria-label="关闭弹窗" className="absolute inset-0" onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[min(88vh,960px)] w-full flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl dark:border-slate-700 dark:bg-slate-950/95 ${maxWidthClassName}`}
      >
        <div className="flex items-start justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">用户中心</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label="关闭"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function PaginationFooter({
  page,
  pageSize,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-4 text-sm dark:border-slate-800">
      <div className="text-slate-500 dark:text-slate-400">
        第 {page} / {totalPages} 页，共 {total} 条
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
        >
          上一页
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const normalizedPath = useMemo(() => (pathname === '/' ? '/' : pathname.replace(/\/+$/, '')), [pathname]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [user, setUser] = useState<ShopUser | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [resultNavHref, setResultNavHref] = useState('/result');

  const [walletOpen, setWalletOpen] = useState(false);
  const [walletSection, setWalletSection] = useState<WalletSection>('balance');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [walletFeedback, setWalletFeedback] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeSubmitting, setRechargeSubmitting] = useState(false);
  const [rechargeOrders, setRechargeOrders] = useState<ListRechargeOrdersResponse | null>(null);
  const [rechargePage, setRechargePage] = useState(1);

  const [ordersOpen, setOrdersOpen] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersData, setOrdersData] = useState<ListOrdersResponse | null>(null);

  const [graphsOpen, setGraphsOpen] = useState(false);
  const [graphsLoading, setGraphsLoading] = useState(false);
  const [graphsError, setGraphsError] = useState('');
  const [graphsPage, setGraphsPage] = useState(1);
  const [graphsData, setGraphsData] = useState<ListPurchasedGraphsResponse | null>(null);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const visibleNavLinks = useMemo(
    () => navLinks.filter((link) => !link.adminOnly || isAdminRole(user?.role)),
    [user]
  );
  const displayName = getUserDisplayName(user);
  const rechargeFenPreview = useMemo(() => {
    const normalized = rechargeAmount.trim();
    if (!normalized) return 0;
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value * 100);
  }, [rechargeAmount]);

  const resetUserCenterState = () => {
    setUser(null);
    setIsUserMenuOpen(false);
    setWalletOpen(false);
    setOrdersOpen(false);
    setGraphsOpen(false);
    setWalletError('');
    setWalletFeedback('');
    setRechargeAmount('');
    setRechargeOrders(null);
    setOrdersData(null);
    setGraphsData(null);
  };

  const refreshCurrentUser = async () => {
    if (!getStoredToken().trim()) {
      setUser(null);
      return;
    }
    try {
      setUser(await getAuthMe());
    } catch {
      setUser(null);
    }
  };

  const loadWalletData = async (page = rechargePage) => {
    setWalletLoading(true);
    setWalletError('');
    try {
      const [userPayload, rechargePayload] = await Promise.all([getAuthMe(), listRechargeOrders(page, PAGE_SIZE)]);
      setUser(userPayload);
      setRechargeOrders(rechargePayload);
    } catch (requestError) {
      setWalletError(requestError instanceof Error ? requestError.message : '钱包信息加载失败');
    } finally {
      setWalletLoading(false);
    }
  };

  const loadOrders = async (page = ordersPage) => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      setOrdersData(await listOrders(page, PAGE_SIZE));
    } catch (requestError) {
      setOrdersError(requestError instanceof Error ? requestError.message : '订单加载失败');
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadPurchasedGraphs = async (page = graphsPage) => {
    setGraphsLoading(true);
    setGraphsError('');
    try {
      setGraphsData(await listPurchasedGraphs(page, PAGE_SIZE));
    } catch (requestError) {
      setGraphsError(requestError instanceof Error ? requestError.message : '已购图谱加载失败');
    } finally {
      setGraphsLoading(false);
    }
  };

  const openWalletModal = (section: WalletSection) => {
    setWalletSection(section);
    setWalletFeedback('');
    setWalletError('');
    setWalletOpen(true);
    setOrdersOpen(false);
    setGraphsOpen(false);
    setIsUserMenuOpen(false);
    setIsOpen(false);
  };

  const openOrdersModal = () => {
    setOrdersOpen(true);
    setWalletOpen(false);
    setGraphsOpen(false);
    setIsUserMenuOpen(false);
    setIsOpen(false);
  };

  const openGraphsModal = () => {
    setGraphsOpen(true);
    setWalletOpen(false);
    setOrdersOpen(false);
    setIsUserMenuOpen(false);
    setIsOpen(false);
  };

  const handleLogout = () => {
    logoutUser();
    resetUserCenterState();
    setIsOpen(false);
  };

  const handleCreateRechargeOrder = async () => {
    if (rechargeFenPreview <= 0) {
      setWalletError('请输入有效充值金额');
      return;
    }

    setRechargeSubmitting(true);
    setWalletError('');
    setWalletFeedback('');
    try {
      const created = await createRechargeOrder({ amount_fen: rechargeFenPreview });
      setWalletFeedback(`充值单已创建，单号 ${created.recharge_no}，当前状态为待支付。`);
      setRechargeAmount('');
      setRechargePage(1);
      await loadWalletData(1);
    } catch (requestError) {
      setWalletError(requestError instanceof Error ? requestError.message : '充值单创建失败');
    } finally {
      setRechargeSubmitting(false);
    }
  };

  useEffect(() => {
    setIsOpen(false);
    setIsUserMenuOpen(false);
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
    setAuthToken(initialToken);
    if (initialToken.trim()) {
      void refreshCurrentUser();
    } else {
      setUser(null);
    }

    const unsubscribeAuth = subscribeAuthToken((token) => {
      setAuthToken(token);
    });
    const unsubscribeDialog = subscribeAuthDialogOpen(() => {
      setIsAuthOpen(true);
    });
    return () => {
      unsubscribeAuth();
      unsubscribeDialog();
    };
  }, []);

  useEffect(() => {
    if (!authToken.trim()) {
      resetUserCenterState();
      return;
    }
    void refreshCurrentUser();
  }, [authToken]);

  useEffect(() => {
    if (!walletOpen || !authToken.trim()) return;
    void loadWalletData(rechargePage);
  }, [walletOpen, rechargePage, authToken]);

  useEffect(() => {
    if (!ordersOpen || !authToken.trim()) return;
    void loadOrders(ordersPage);
  }, [ordersOpen, ordersPage, authToken]);

  useEffect(() => {
    if (!graphsOpen || !authToken.trim()) return;
    void loadPurchasedGraphs(graphsPage);
  }, [graphsOpen, graphsPage, authToken]);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isUserMenuOpen]);

  const desktopAuthButton = displayName ? (
    <div ref={userMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsUserMenuOpen((prev) => !prev)}
        className="inline-flex max-w-[18rem] items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left shadow-sm transition hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-900/20"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <FiUser className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-emerald-700 dark:text-emerald-200">{displayName}</span>
          <span className="block truncate text-xs text-emerald-600/90 dark:text-emerald-200/80">
            {user?.points_balance ?? 0} 积分
          </span>
        </span>
        <FiChevronDown className={`h-4 w-4 text-emerald-700 transition ${isUserMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isUserMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-[20rem] rounded-3xl border border-slate-200/80 bg-white/95 p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950/95"
          >
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</div>
              <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{user?.email || '—'}</div>
              <div className="mt-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">当前积分</div>
              <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">{user?.points_balance ?? 0}</div>
            </div>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => openWalletModal('recharge')}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <FiCreditCard className="h-4 w-4 text-emerald-500" />
                  积分充值
                </span>
                <FiArrowUpRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openOrdersModal}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <FiShoppingBag className="h-4 w-4 text-amber-500" />
                  订单查询
                </span>
                <FiArrowUpRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openGraphsModal}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <FiPackage className="h-4 w-4 text-violet-500" />
                  已购知识图谱查询
                </span>
                <FiArrowUpRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <span className="inline-flex items-center gap-2">
                <FiLogOut className="h-4 w-4" />
                退出登录
              </span>
              <FiArrowUpRight className="h-4 w-4" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
            {visibleNavLinks.map((link) => {
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
            {desktopAuthButton}
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
                {visibleNavLinks.map((link) => {
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

                {displayName ? (
                  <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <FiUser className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-emerald-700 dark:text-emerald-200">{displayName}</div>
                        <div className="truncate text-xs text-emerald-600/90 dark:text-emerald-200/80">
                          {user?.points_balance ?? 0} 积分
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      <button
                        type="button"
                        onClick={() => openWalletModal('recharge')}
                        className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                      >
                        积分充值
                      </button>
                      <button
                        type="button"
                        onClick={openOrdersModal}
                        className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                      >
                        订单查询
                      </button>
                      <button
                        type="button"
                        onClick={openGraphsModal}
                        className="rounded-xl border border-white/70 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                      >
                        已购知识图谱查询
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        退出登录
                      </button>
                    </div>
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

      <ModalShell
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        title="钱包"
        subtitle="查看当前积分余额，创建待支付充值单并跟踪充值状态。"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.25fr_1fr]">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">当前积分余额</div>
              <div className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">{user?.points_balance ?? 0}</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                当前账号：{displayName || '未登录'} {user?.email ? `· ${user.email}` : ''}
              </div>
            </div>
            <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-5 dark:border-sky-900/40 dark:bg-sky-950/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">充值规则</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                <div>自定义金额，1 元 = 100 积分。</div>
                <div>当前阶段只创建待支付充值单，不跳转真实支付渠道。</div>
                <div>只有后续回调把充值单标记为已支付后，积分才会正式入账。</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setWalletSection('balance')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                walletSection === 'balance'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              积分余额
            </button>
            <button
              type="button"
              onClick={() => setWalletSection('recharge')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                walletSection === 'recharge'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              积分充值
            </button>
          </div>

          {walletError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              {walletError}
            </div>
          ) : null}

          {walletFeedback ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              {walletFeedback}
            </div>
          ) : null}

          {walletSection === 'recharge' ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">创建充值单</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">输入人民币金额，系统会按 1 元 = 100 积分换算。</div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadWalletData(rechargePage)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  <FiRefreshCw className={`h-3.5 w-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">充值金额（元）</label>
                  <input
                    value={rechargeAmount}
                    onChange={(event) => setRechargeAmount(event.target.value)}
                    placeholder="例如 99.90"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/30">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">预计到账积分</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{rechargeFenPreview}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    对应金额 {formatYuanFromFen(rechargeFenPreview)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleCreateRechargeOrder()}
                disabled={rechargeSubmitting}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCreditCard className="h-4 w-4" />
                {rechargeSubmitting ? '创建中...' : '创建充值单'}
              </button>
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">最近充值单</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">用于确认待支付状态和后续积分入账结果。</div>
              </div>
              <button
                type="button"
                onClick={() => void loadWalletData(rechargePage)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                <FiRefreshCw className={`h-3.5 w-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>

            {walletLoading ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                <FiRefreshCw className="mr-2 inline-block h-4 w-4 animate-spin" />
                正在加载钱包数据...
              </div>
            ) : null}

            {!walletLoading && !(rechargeOrders?.items.length || 0) ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                暂无充值单记录。
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {(rechargeOrders?.items || []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.recharge_no}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        创建时间：{formatDateTime(item.created_at)}
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(item.status)}`}>
                      {formatStatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm dark:bg-slate-950/70">
                      充值金额
                      <div className="mt-1 font-semibold text-slate-900 dark:text-white">{formatYuanFromFen(item.amount_fen)}</div>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm dark:bg-slate-950/70">
                      积分数量
                      <div className="mt-1 font-semibold text-slate-900 dark:text-white">{item.points_amount}</div>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm dark:bg-slate-950/70">
                      支付流水
                      <div className="mt-1 truncate font-semibold text-slate-900 dark:text-white">{item.provider_trade_no || '待生成'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <PaginationFooter
              page={rechargePage}
              pageSize={PAGE_SIZE}
              total={rechargeOrders?.total || 0}
              onPrev={() => setRechargePage((current) => Math.max(current - 1, 1))}
              onNext={() => setRechargePage((current) => current + 1)}
            />
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={ordersOpen}
        onClose={() => setOrdersOpen(false)}
        title="订单查询"
        subtitle="分页查看当前账号的已下单图谱订单。"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">展示订单号、时间、状态、积分合计和商品摘要。</div>
          <button
            type="button"
            onClick={() => void loadOrders(ordersPage)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {ordersError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
            {ordersError}
          </div>
        ) : null}

        {ordersLoading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <FiRefreshCw className="mr-2 inline-block h-4 w-4 animate-spin" />
            正在加载订单...
          </div>
        ) : null}

        {!ordersLoading && !(ordersData?.items.length || 0) ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            暂无订单记录。
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {(ordersData?.items || []).map((order) => (
            <div
              key={order.id}
              className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">{order.order_no}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    下单时间：{formatDateTime(order.paid_at || order.created_at)}
                  </div>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(order.status)}`}>
                  {formatStatusLabel(order.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950/60">
                  商品数量
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{order.item_count}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950/60">
                  总积分
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{order.total_points}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950/60">
                  积分变化
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                    {order.points_before ?? '—'} → {order.points_after ?? '—'}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">商品摘要</div>
                <div className="mt-3 space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
                      <div className="min-w-0 truncate">{item.product_name}</div>
                      <div className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        x{item.quantity} · {item.subtotal_points} 积分
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <PaginationFooter
          page={ordersPage}
          pageSize={PAGE_SIZE}
          total={ordersData?.total || 0}
          onPrev={() => setOrdersPage((current) => Math.max(current - 1, 1))}
          onNext={() => setOrdersPage((current) => current + 1)}
        />
      </ModalShell>

      <ModalShell
        open={graphsOpen}
        onClose={() => setGraphsOpen(false)}
        title="已购知识图谱"
        subtitle="按购买记录查看已购图谱，并直接打开任务详情或图谱视图。"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">每条记录保留一次购买，不对历史重复购买做去重。</div>
          <button
            type="button"
            onClick={() => void loadPurchasedGraphs(graphsPage)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${graphsLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {graphsError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
            {graphsError}
          </div>
        ) : null}

        {graphsLoading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <FiRefreshCw className="mr-2 inline-block h-4 w-4 animate-spin" />
            正在加载已购图谱...
          </div>
        ) : null}

        {!graphsLoading && !(graphsData?.items.length || 0) ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            暂无已购图谱记录。
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {(graphsData?.items || []).map((item) => (
            <div
              key={`${item.order_id}-${item.product_id}`}
              className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">{item.product_name}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">订单号：{item.order_no}</div>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(item.site_status)}`}>
                  {formatStatusLabel(item.site_status)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950/60">
                  购买时间
                  <div className="mt-1 font-semibold text-slate-900 dark:text-white">{formatDateTime(item.paid_at)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950/60">
                  来源站点
                  <div className="mt-1 font-semibold text-slate-900 dark:text-white">#{item.source_site_id}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950/60">
                  图谱完成时间
                  <div className="mt-1 font-semibold text-slate-900 dark:text-white">{formatDateTime(item.graph_built_at)}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">来源 URL</div>
                <div className="mt-2 break-all">{item.source_url_snapshot || '—'}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/result/detail?id=${encodeURIComponent(String(item.source_site_id))}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600"
                >
                  查看任务详情
                  <FiArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/result/detail/graph?id=${encodeURIComponent(String(item.source_site_id))}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  打开图谱
                  <FiArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <PaginationFooter
          page={graphsPage}
          pageSize={PAGE_SIZE}
          total={graphsData?.total || 0}
          onPrev={() => setGraphsPage((current) => Math.max(current - 1, 1))}
          onNext={() => setGraphsPage((current) => current + 1)}
        />
      </ModalShell>

      <AuthDialog open={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
