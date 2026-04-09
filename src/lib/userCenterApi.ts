'use client';

import { API_BASE } from '@/config/api';
import { clearStoredToken, getStoredToken, openAuthDialog } from '@/components/auth/authStorage';

const CART_CHANGED_EVENT = 'kg-cart-changed';

export type ShopUser = {
  id: number;
  email?: string | null;
  nickname?: string | null;
  company_name?: string | null;
  role: string;
  status: string;
  points_balance: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_points: number;
  subtotal_points: number;
};

export type OrderResponse = {
  id: number;
  order_no: string;
  status: string;
  total_points: number;
  item_count: number;
  points_before?: number | null;
  points_deducted?: number | null;
  points_after?: number | null;
  paid_at?: string | null;
  created_at?: string | null;
  items: OrderItem[];
};

export type ListOrdersResponse = {
  items: OrderResponse[];
  total: number;
  page: number;
  page_size: number;
};

export type PurchasedGraphItem = {
  order_id: number;
  order_no: string;
  paid_at?: string | null;
  product_id: number;
  product_name: string;
  source_site_id: number;
  source_url_snapshot?: string | null;
  site_status?: string | null;
  graph_built_at?: string | null;
};

export type ListPurchasedGraphsResponse = {
  items: PurchasedGraphItem[];
  total: number;
  page: number;
  page_size: number;
};

export type RechargeOrder = {
  id: number;
  recharge_no: string;
  amount_fen: number;
  points_amount: number;
  status: string;
  payment_channel?: string | null;
  provider_trade_no?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ListRechargeOrdersResponse = {
  items: RechargeOrder[];
  total: number;
  page: number;
  page_size: number;
};

export type CreateRechargeOrderRequest = {
  amount_fen: number;
};

const isAuthErrorStatus = (status: number) => status === 401 || status === 403;

const notifyCartChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
};

const readApiError = async (response: Response) => {
  try {
    const payload = (await response.json()) as { error?: string; detail?: string };
    return String(payload.error || payload.detail || '').trim() || `请求失败：${response.status}`;
  } catch {
    return `请求失败：${response.status}`;
  }
};

const getRequiredToken = () => {
  const token = getStoredToken().trim();
  if (!token) {
    openAuthDialog();
    throw new Error('请先登录后再操作');
  }
  return token;
};

async function authJsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getRequiredToken();
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (isAuthErrorStatus(response.status)) {
    clearStoredToken();
    notifyCartChanged();
    openAuthDialog();
    throw new Error('登录状态已失效，请重新登录');
  }
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as T;
}

export const getAuthMe = () => authJsonRequest<ShopUser>('/api/auth/me');

export const listOrders = (page = 1, pageSize = 5) =>
  authJsonRequest<ListOrdersResponse>(`/api/orders?page=${encodeURIComponent(String(page))}&page_size=${encodeURIComponent(String(pageSize))}`);

export const listPurchasedGraphs = (page = 1, pageSize = 5) =>
  authJsonRequest<ListPurchasedGraphsResponse>(
    `/api/account/purchased_graphs?page=${encodeURIComponent(String(page))}&page_size=${encodeURIComponent(String(pageSize))}`
  );

export const createRechargeOrder = (request: CreateRechargeOrderRequest) =>
  authJsonRequest<RechargeOrder>('/api/recharge/orders', {
    method: 'POST',
    body: JSON.stringify(request),
  });

export const listRechargeOrders = (page = 1, pageSize = 5) =>
  authJsonRequest<ListRechargeOrdersResponse>(
    `/api/recharge/orders?page=${encodeURIComponent(String(page))}&page_size=${encodeURIComponent(String(pageSize))}`
  );

export const logoutUser = () => {
  clearStoredToken();
  notifyCartChanged();
};
