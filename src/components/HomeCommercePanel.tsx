'use client';

import { useEffect, useState } from 'react';
import {
  FiCreditCard,
  FiLogOut,
  FiRefreshCw,
  FiShoppingCart,
  FiTrash2,
  FiUser,
} from 'react-icons/fi';
import { API_BASE } from '@/config/api';
import {
  clearStoredToken,
  getStoredToken,
  openAuthDialog,
  subscribeAuthToken,
} from '@/components/auth/authStorage';

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

const formatPoints = (value?: number | null) => `${Number(value || 0).toLocaleString()} 积分`;

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const buildAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export default function HomeCommercePanel() {
  const [user, setUser] = useState<ShopUser | null>(null);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const clearAuthState = () => {
    setToken('');
    clearStoredToken();
    setUser(null);
    setCart(null);
    setOrders([]);
  };

  const fetchProtectedData = async (authToken: string) => {
    const [meRes, cartRes, ordersRes] = await Promise.all([
      fetch(`${API_BASE}/api/auth/me`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${authToken}` },
      }),
      fetch(`${API_BASE}/api/cart`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${authToken}` },
      }),
      fetch(`${API_BASE}/api/orders?page=1&page_size=10`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${authToken}` },
      }),
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

  const refreshProtectedData = async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) {
      setUser(null);
      setCart(null);
      setOrders([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await fetchProtectedData(activeToken);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '刷新失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialToken = getStoredToken();
    setToken(initialToken);
    void refreshProtectedData(initialToken || undefined);

    const unsubscribe = subscribeAuthToken((nextToken) => {
      setToken(nextToken);
      setFeedback('');
      setError('');
      void refreshProtectedData(nextToken || undefined);
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    clearAuthState();
    setFeedback('已退出登录');
    setError('');
  };

  const handleRemoveCartItem = async (itemId: number) => {
    if (!token) {
      setError('请先登录后再操作购物车');
      openAuthDialog();
      return;
    }
    if (removingItemId) return;
    setRemovingItemId(itemId);
    setFeedback('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/cart/items/${encodeURIComponent(String(itemId))}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
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
      openAuthDialog();
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
        body: JSON.stringify({}),
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
    <section className="mx-auto mt-10 max-w-[108rem]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            账户与交易
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">登录解锁、购物车与最近订单</h2>
        </div>
        <button
          onClick={() => void refreshProtectedData()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {(error || feedback) && (
        <div className="mb-4 space-y-3">
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

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
        <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">账户信息</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.email || '—'}</p>
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
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {user.nickname || user.company_name || '已登录用户'}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">登录后解锁结算能力</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  登录后即可查看购物车、最近订单，并直接完成积分结算。
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAuthDialog()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <FiUser className="h-4 w-4" />
                立即登录 / 注册
              </button>
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
                未登录时仍可浏览商品页，但购物车、订单和积分结算需要 JWT 登录态。
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">购物车</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {user ? `${cart?.total_items || 0} 件商品，合计 ${formatPoints(cart?.total_points)}` : '登录后可查看购物车'}
              </p>
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
              <FiShoppingCart className="mr-1 inline-block h-3.5 w-3.5" />
              {cart?.total_items || 0}
            </div>
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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">最近订单</h3>
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
      </div>
    </section>
  );
}
