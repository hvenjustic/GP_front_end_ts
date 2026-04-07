'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiArrowUpRight,
  FiChevronDown,
  FiCreditCard,
  FiDatabase,
  FiGitBranch,
  FiGlobe,
  FiRefreshCw,
  FiSearch,
  FiShoppingCart,
  FiTag,
  FiUser
} from 'react-icons/fi';
import { API_BASE } from '@/config/api';
import { clearStoredToken, getStoredToken, openAuthDialog, subscribeAuthToken } from '@/components/auth/authStorage';
import ProductGraph from './ProductGraph';

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

const formatPoints = (value?: number | null) => `${Number(value || 0).toLocaleString()} 积分`;

export default function ProductsClient() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [user, setUser] = useState<ShopUser | null>(null);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
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
    clearStoredToken();
    setUser(null);
    setCart(null);
  };

  const fetchProtectedData = async (authToken: string) => {
    const [meRes, cartRes] = await Promise.all([
      fetch(`${API_BASE}/api/auth/me`, { cache: 'no-store', headers: { Authorization: `Bearer ${authToken}` } }),
      fetch(`${API_BASE}/api/cart`, { cache: 'no-store', headers: { Authorization: `Bearer ${authToken}` } })
    ]);

    if ([meRes.status, cartRes.status].some((status) => status === 401 || status === 403)) {
      clearAuthState();
      throw new Error('登录已失效，请重新登录');
    }
    if (!meRes.ok) throw new Error(`用户加载失败：${meRes.status}`);
    if (!cartRes.ok) throw new Error(`购物车加载失败：${cartRes.status}`);

    setUser((await meRes.json()) as ShopUser);
    setCart((await cartRes.json()) as CartResponse);
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
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
      setCart(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialToken = getStoredToken();
    setToken(initialToken);
    void fetchPageData(initialToken || undefined);

    const unsubscribe = subscribeAuthToken((nextToken) => {
      setToken(nextToken);
      void fetchPageData(nextToken || undefined);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((item) => item.name.toLowerCase().includes(keyword) || item.url.toLowerCase().includes(keyword));
  }, [products, search]);

  const handleAddToCart = async (productId: number) => {
    if (!token) {
      setError('请先点击右上角登录后再加入购物车');
      setFeedback('');
      openAuthDialog();
      return;
    }
    if (addingProductId) return;
    setAddingProductId(productId);
    setFeedback('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/cart/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
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
                商品页保留商品浏览与加购，登录解锁、购物车和最近订单已收口到首页统一展示。
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
                <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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

      <section className="mx-auto mt-10 max-w-[108rem]">
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
      </section>
    </div>
  );
}
