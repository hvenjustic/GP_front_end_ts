'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiCheckCircle,
  FiChevronDown,
  FiDatabase,
  FiGitBranch,
  FiGlobe,
  FiLayers,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiShoppingCart,
  FiZap,
} from 'react-icons/fi';
import { getStoredToken, openAuthDialog, subscribeAuthToken } from '@/components/auth/authStorage';
import { API_BASE } from '@/config/api';
import { addCartItem, buyNow } from '@/lib/shopApi';
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

type ProductActionState = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

const actionToneClassName: Record<ProductActionState['tone'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200',
  error: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200',
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200',
};

export default function ProductsClient() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [pendingActions, setPendingActions] = useState<Record<number, 'cart' | 'buy' | undefined>>({});
  const [productFeedback, setProductFeedback] = useState<Record<number, ProductActionState | undefined>>({});

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/products?page=1&page_size=100`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`产品实体加载失败：${res.status}`);
      const data = (await res.json()) as ProductListResponse;
      setProducts(data.items || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  useEffect(() => {
    setAuthToken(getStoredToken());
    return subscribeAuthToken((token) => setAuthToken(token));
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((item) => item.name.toLowerCase().includes(keyword) || item.url.toLowerCase().includes(keyword));
  }, [products, search]);

  const siteCount = useMemo(() => new Set(products.map((item) => item.source_site_id)).size, [products]);
  const totalEntityCount = useMemo(
    () => products.reduce((sum, item) => sum + Number(item.entity_count || 0), 0),
    [products]
  );
  const totalRelationCount = useMemo(
    () => products.reduce((sum, item) => sum + Number(item.relation_count || 0), 0),
    [products]
  );

  const updateActionState = (productId: number, action?: 'cart' | 'buy') => {
    setPendingActions((prev) => ({ ...prev, [productId]: action }));
  };

  const updateFeedback = (productId: number, feedback: ProductActionState) => {
    setProductFeedback((prev) => ({ ...prev, [productId]: feedback }));
  };

  const handleAddCart = async (product: ProductItem) => {
    updateActionState(product.id, 'cart');
    try {
      const cart = await addCartItem(product.id, 1);
      updateFeedback(product.id, {
        tone: 'success',
        text: `已加入购物车。当前购物车共 ${cart.total_items} 件商品，合计 ${cart.total_points} 积分。`,
      });
    } catch (requestError) {
      updateFeedback(product.id, {
        tone: authToken ? 'error' : 'info',
        text: requestError instanceof Error ? requestError.message : '加入购物车失败',
      });
    } finally {
      updateActionState(product.id);
    }
  };

  const handleBuyNow = async (product: ProductItem) => {
    updateActionState(product.id, 'buy');
    try {
      const order = await buyNow(product.id, 1);
      updateFeedback(product.id, {
        tone: 'success',
        text: `立即结算成功，订单号 ${order.order_no}，本次扣除 ${order.total_points} 积分。`,
      });
    } catch (requestError) {
      updateFeedback(product.id, {
        tone: authToken ? 'error' : 'info',
        text: requestError instanceof Error ? requestError.message : '立即结算失败',
      });
    } finally {
      updateActionState(product.id);
    }
  };

  return (
    <div className="relative isolate px-6 pb-16">
      <section className="mx-auto mt-4 max-w-[108rem] overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-8 shadow-lg backdrop-blur md:p-12 dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <FiLayers className="h-4 w-4" />
              图谱产品实体
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                产品实体库
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                展示从已完成建图的企业官网中同步出的产品实体。你可以按名称或来源 URL 检索，并展开查看对应站点图谱。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-500"
              >
                查看实体列表
                <FiArrowUpRight className="h-4 w-4" />
              </a>
              <button
                onClick={() => void fetchProducts()}
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
                <FiGlobe className="h-4 w-4" />
                来源站点
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{siteCount}</p>
            </div>
            <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 px-4 py-4 shadow-sm dark:border-sky-900/40 dark:bg-sky-900/20">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">
                <FiDatabase className="h-4 w-4" />
                实体总数
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {totalEntityCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-violet-200/80 bg-violet-50/70 px-4 py-4 shadow-sm dark:border-violet-900/40 dark:bg-violet-900/20">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                <FiGitBranch className="h-4 w-4" />
                关系总数
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {totalRelationCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-[108rem]">
        <div id="catalog">
          <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
                <FiSearch className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索产品名称或来源 URL"
                  className="w-full bg-transparent outline-none placeholder:text-slate-400 dark:text-white"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>
                共 {filteredProducts.length} 个产品实体
                {search ? `，已根据「${search}」过滤` : ''}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {filteredProducts.map((product) => {
                const expanded = expandedProductId === product.id;
                const feedback = productFeedback[product.id];
                const pendingAction = pendingActions[product.id];
                const isLoggedIn = Boolean(authToken.trim());
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
                            {product.name || '未命名产品'}
                          </span>
                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <FiGlobe className="h-4 w-4 shrink-0" />
                            <span className="truncate">{product.url}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 xl:min-w-[43rem]">
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                              <FiGlobe className="h-3.5 w-3.5" />
                              来源站点
                            </div>
                            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                              #{product.source_site_id}
                            </p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                              <FiZap className="h-3.5 w-3.5" />
                              价格
                            </div>
                            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                              {product.price_points.toLocaleString()} 积分
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
                        <Link
                          href={`/result/detail?id=${encodeURIComponent(String(product.source_site_id))}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200"
                        >
                          查看站点详情
                          <FiArrowUpRight className="h-4 w-4" />
                        </Link>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleAddCart(product);
                            }}
                            disabled={Boolean(pendingAction)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-slate-600"
                          >
                            <FiShoppingCart className="h-4 w-4" />
                            {pendingAction === 'cart' ? '加入中...' : '加入购物车'}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleBuyNow(product);
                            }}
                            disabled={Boolean(pendingAction)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiZap className="h-4 w-4" />
                            {pendingAction === 'buy' ? '结算中...' : '立即结算'}
                          </button>
                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <span>{expanded ? '收起图谱' : '展开图谱'}</span>
                            <FiChevronDown
                              className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                          {isLoggedIn ? (
                            <>
                              <FiCheckCircle className="h-4 w-4 text-emerald-500" />
                              已登录，可直接加入购物车或立即结算
                            </>
                          ) : (
                            <>
                              <FiLock className="h-4 w-4 text-slate-500" />
                              登录后才可购买
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openAuthDialog();
                                }}
                                className="inline-flex items-center gap-1 font-semibold text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                              >
                                去登录
                                <FiArrowUpRight className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                        <Link
                          href="/chat/"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                        >
                          前往购物车页
                          <FiArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>

                      {feedback ? (
                        <div
                          className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${actionToneClassName[feedback.tone]}`}
                        >
                          <div className="flex items-start gap-2">
                            {feedback.tone === 'success' ? (
                              <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span>{feedback.text}</span>
                          </div>
                        </div>
                      ) : null}
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
                暂无产品实体数据。先完成图谱构建，产品实体会自动同步并展示在这里。
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
