'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  FiArrowUpRight,
  FiChevronDown,
  FiCreditCard,
  FiDatabase,
  FiGitBranch,
  FiGlobe,
  FiLogIn,
  FiLogOut,
  FiRefreshCw,
  FiSearch,
  FiShoppingCart,
  FiTag,
  FiTrash2,
  FiUser,
  FiUserPlus
} from 'react-icons/fi';
import { API_BASE } from '@/config/api';
import ProductGraph from './ProductGraph';

const AUTH_TOKEN_KEY = 'kg_auth_token';

type ProductItem = {
  id: number;
  source_site_id: number;
  name: string;
  url: string;
  price_points: number;
  entity_count: number;
  relation_count: number;
};

type ProductListResponse = {
  items: ProductItem[];
  total: number;
  page: number;
  page_size: number;
};

type ShopUser = {
  id: number;
  email?: string | null;
  nickname?: string | null;
  company_name?: string | null;
  role: string;
  status: string;
  points_balance: number;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: ShopUser;
};

type CartItem = {
  id: number;
  product_id: number;
  product_name: string;
  product_url?: string | null;
  quantity: number;
  unit_points: number;
  subtotal_points: number;
};

type CartResponse = {
  user: ShopUser;
  cart_id?: number | null;
  status: string;
  total_items: number;
  total_points: number;
  items: CartItem[];
};

type Order = {
  id: number;
  order_no: string;
  status: string;
  total_points: number;
  item_count: number;
  paid_at?: string | null;
  created_at?: string | null;
};

type OrderListResponse = {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
};

type AuthMode = 'login' | 'register';

const formatPoints = (value?: number | null) => `${Number(value || 0).toLocaleString()} 积分`;

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const getStoredToken = () => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

const setStoredToken = (token: string) => {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

const buildAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
});

export default function ProductsClient() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [user, setUser] = useState<ShopUser | null>(null);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [token, setToken] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerNickname, setRegisterNickname] = useState('');
  const [registerCompany, setRegisterCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [protectedLoading, setProtectedLoading] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const fetchProducts = async () => {
    const res = await fetch(`${API_BASE}/api/products?page=1&page_size=100`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`商品加载失败：${res.status}`);
    const data = (await res.json()) as ProductListResponse;
    setProducts(data.items || []);
  };

  const clearAuthState = () => {
    setToken('');
    setStoredToken('');
    setUser(null);
    setCart(null);
    setOrders([]);
  };

  const fetchProtectedData = async (authToken: string) => {
    const [meRes, cartRes, ordersRes] = await Promise.all([
      fetch(`${API_BASE}/api/auth/me`, { cache: 'no-store', headers: { Authorization: `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/api/cart`, { cache: 'no-store', headers: { Authorization: `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/api/orders?page=1&page_size=10`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${authToken}` }
      })
    ]);

    if ([meRes.status, cartRes.status, ordersRes.status].some((status) => status === 401 || status === 403)) {
      clearAuthState();
      throw new Error('登录已失效，请重新登录');
    }
    if (!meRes.ok) throw new Error(`用户加载失败：${meRes.status}`);
    if (!cartRes.ok) throw new Error(`购物车加载失败：${cartRes.status}`);
    if (!ordersRes.ok) throw new Error(`订单加载失败：${ordersRes.status}`);

    setUser((await meRes.json()) as ShopUser);
    setCart((await cartRes.json()) as CartResponse);
    const orderJson = (await ordersRes.json()) as OrderListResponse;
    setOrders(orderJson.items || []);
  };

  const fetchPageData = async (authToken?: string) => {
    setLoading(true);
    setError('');
    try {
      await fetchProducts();
      if (authToken) {
        await fetchProtectedData(authToken);
      } else {
        setUser(null);
        setCart(null);
        setOrders([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
      setCart(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshProtectedData = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    setProtectedLoading(true);
    setError('');
    try {
      await fetchProtectedData(activeToken);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '刷新失败');
    } finally {
      setProtectedLoading(false);
    }
  };

  useEffect(() => {
    const initialToken = getStoredToken();
    if (initialToken) {
      setToken(initialToken);
      void fetchPageData(initialToken);
      return;
    }
    void fetchPageData();
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((item) => item.name.toLowerCase().includes(keyword) || item.url.toLowerCase().includes(keyword));
  }, [products, search]);

  const handleAuthSuccess = async (payload: AuthResponse) => {
    setToken(payload.access_token);
    setStoredToken(payload.access_token);
    setUser(payload.user);
    await refreshProtectedData(payload.access_token);
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthSubmitting(true);
    setFeedback('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          nickname: registerNickname,
          company_name: registerCompany
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `请求失败：${res.status}`);
      await handleAuthSuccess(json as AuthResponse);
      setFeedback('注册成功，已自动登录');
      setRegisterPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '注册失败');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthSubmitting(true);
    setFeedback('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `请求失败：${res.status}`);
      await handleAuthSuccess(json as AuthResponse);
      setFeedback('登录成功');
      setLoginPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '登录失败');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearAuthState();
    setFeedback('已退出登录');
    setError('');
  };

  const handleAddToCart = async (productId: number) => {
    if (!token) {
      setError('请先登录后再加入购物车');
      setFeedback('');
      return;
    }
    if (addingProductId) return;
    setAddingProductId(productId);
    setFeedback('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/cart/items`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({ product_id: productId, quantity: 1 })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `请求失败：${res.status}`);
      setCart(json as CartResponse);
      setFeedback('商品已加入购物车');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加入购物车失败');
    } finally {
      setAddingProductId(null);
    }
  };

  const handleRemoveCartItem = async (itemId: number) => {
    if (!token) {
      setError('请先登录后再操作购物车');
      return;
    }
    if (removingItemId) return;
    setRemovingItemId(itemId);
    setFeedback('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/cart/items/${encodeURIComponent(String(itemId))}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `请求失败：${res.status}`);
      setCart((json as { cart: CartResponse }).cart);
      setFeedback('购物车商品已移除');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '移除商品失败');
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleCheckout = async () => {
    if (!token) {
      setError('请先登录后再下单');
      return;
    }
    if (checkoutLoading || !cart?.items.length) return;
    setCheckoutLoading(true);
    setFeedback('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/orders/checkout`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `请求失败：${res.status}`);
      const order = json as Order;
      setFeedback(`下单成功，订单号 ${order.order_no}`);
      await refreshProtectedData(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '下单失败');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="relative isolate px-6 pb-16">
      <section className="mx-auto mt-8 max-w-[108rem] overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-8 shadow-lg backdrop-blur md:p-12 dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <FiTag className="h-4 w-4" />
              图谱商品
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                商品中心
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                商品列表公开可见，但购物车、订单和积分结算全部改为 JWT 登录态控制。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-500"
              >
                前往商品列表
                <FiArrowUpRight className="h-4 w-4" />
              </a>
              <button
                onClick={() => void fetchPageData(token || undefined)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
              >
                <FiRefreshCw className={`h-4 w-4 ${(loading || protectedLoading) ? 'animate-spin' : ''}`} />
                刷新数据
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <FiUser className="h-4 w-4" />
                当前用户
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {user?.nickname || '未登录'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user?.company_name || '请先登录或注册'}</p>
            </div>
            <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 px-4 py-4 shadow-sm dark:border-sky-900/40 dark:bg-sky-900/20">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">
                <FiCreditCard className="h-4 w-4" />
                可用积分
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {formatPoints(user?.points_balance)}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                <FiShoppingCart className="h-4 w-4" />
                购物车
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {cart?.total_items || 0} 件 / {formatPoints(cart?.total_points)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-[108rem] gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div id="catalog">
          <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
                <FiSearch className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索商品名称或商品 URL"
                  className="w-full bg-transparent outline-none placeholder:text-slate-400 dark:text-white"
                />
              </div>
            </div>
          </div>

          {(error || feedback) && (
            <div className="mt-4 space-y-3">
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200">
                  {error}
                </div>
              )}
              {feedback && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
                  {feedback}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>
              共 {filteredProducts.length} 个商品
              {search ? `，已根据「${search}」过滤` : ''}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {filteredProducts.map((product) => {
              const expanded = expandedProductId === product.id;
              const isAdding = addingProductId === product.id;
              return (
                <div
                  key={product.id}
                  className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 shadow-sm transition hover:shadow-md dark:border-gray-800/60 dark:bg-slate-900/70"
                >
                  <div
                    className="flex cursor-pointer flex-col gap-4 p-5"
                    onClick={() => setExpandedProductId(expanded ? null : product.id)}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="text-lg font-semibold text-slate-900 dark:text-white">
                          {product.name || '未命名商品'}
                        </span>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <FiGlobe className="h-4 w-4 shrink-0" />
                          <span className="truncate">{product.url}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[34rem]">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                            <FiTag className="h-3.5 w-3.5" />
                            商品价格
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                            {formatPoints(product.price_points)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-900/20">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">
                            <FiDatabase className="h-3.5 w-3.5" />
                            实体数量
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                            {product.entity_count.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-900/50 dark:bg-violet-900/20">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                            <FiGitBranch className="h-3.5 w-3.5" />
                            关系数量
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                            {product.relation_count.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleAddToCart(product.id);
                        }}
                        disabled={isAdding}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200"
                      >
                        <FiShoppingCart className={`h-4 w-4 ${isAdding ? 'animate-pulse' : ''}`} />
                        {isAdding ? '加入中' : '加入购物车'}
                      </button>

                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{expanded ? '收起图谱' : '展开图谱'}</span>
                        <FiChevronDown
                          className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-slate-100 p-5 dark:border-slate-800">
                      <ProductGraph id={String(product.source_site_id)} isEmbedded={true} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!loading && !filteredProducts.length && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
              暂无商品数据。先完成图谱构建，商品会自动同步到商品表并展示在这里。
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">账户信息</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {user.email || '—'}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
                  >
                    <FiLogOut className="h-4 w-4" />
                    退出
                  </button>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-900/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">
                    当前积分
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                    {formatPoints(user.points_balance)}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuthMode('login')}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      authMode === 'login'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'
                    }`}
                  >
                    登录
                  </button>
                  <button
                    onClick={() => setAuthMode('register')}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      authMode === 'register'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'
                    }`}
                  >
                    注册
                  </button>
                </div>

                {authMode === 'login' ? (
                  <form className="mt-4 space-y-3" onSubmit={handleLogin}>
                    <input
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="邮箱"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="密码"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      <FiLogIn className="h-4 w-4" />
                      {authSubmitting ? '登录中' : '登录'}
                    </button>
                  </form>
                ) : (
                  <form className="mt-4 space-y-3" onSubmit={handleRegister}>
                    <input
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="邮箱"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="密码"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      value={registerNickname}
                      onChange={(e) => setRegisterNickname(e.target.value)}
                      placeholder="昵称"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      value={registerCompany}
                      onChange={(e) => setRegisterCompany(e.target.value)}
                      placeholder="公司名称"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      <FiUserPlus className="h-4 w-4" />
                      {authSubmitting ? '注册中' : '注册并登录'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">购物车</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {user ? `${cart?.total_items || 0} 件商品，合计 ${formatPoints(cart?.total_points)}` : '登录后可查看购物车'}
                </p>
              </div>
              {user && (
                <button
                  onClick={() => void refreshProtectedData()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
                >
                  <FiRefreshCw className={`h-4 w-4 ${protectedLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {!user ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
                  请先登录后再加入购物车和下单
                </div>
              ) : cart?.items?.length ? (
                cart.items.map((item) => {
                  const removing = removingItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {item.product_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {item.quantity} 件 x {formatPoints(item.unit_points)}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleRemoveCartItem(item.id)}
                          disabled={removing}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 dark:border-rose-900/50 dark:text-rose-200"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                          {removing ? '移除中' : '移除'}
                        </button>
                      </div>
                      <div className="mt-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                        小计 {formatPoints(item.subtotal_points)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
                  购物车为空
                </div>
              )}
            </div>

            <button
              onClick={() => void handleCheckout()}
              disabled={!user || checkoutLoading || !cart?.items?.length}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <FiCreditCard className={`h-4 w-4 ${checkoutLoading ? 'animate-pulse' : ''}`} />
              {checkoutLoading ? '积分结算中' : '积分下单'}
            </button>
          </div>

          <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">最近订单</h2>
            <div className="mt-4 space-y-3">
              {!user ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
                  登录后可查看订单
                </div>
              ) : orders.length ? (
                orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{order.order_no}</span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {order.item_count} 件商品，合计 {formatPoints(order.total_points)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      下单时间 {formatTime(order.paid_at || order.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
                  暂无订单
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
