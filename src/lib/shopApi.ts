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
};

export type CartItem = {
  id: number;
  product_id: number;
  product_name: string;
  product_url?: string | null;
  quantity: number;
  unit_points: number;
  subtotal_points: number;
};

export type CartResponse = {
  user: ShopUser;
  cart_id?: number | null;
  status: string;
  total_items: number;
  total_points: number;
  items: CartItem[];
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

export type RemoveCartItemResponse = {
  item_id: number;
  deleted: boolean;
  cart: CartResponse;
};

const isAuthErrorStatus = (status: number) => status === 401 || status === 403;

const dispatchCartChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
};

export const subscribeCartChanged = (listener: () => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  window.addEventListener(CART_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(CART_CHANGED_EVENT, listener);
  };
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

async function authJsonRequest<T>(
  path: string,
  init?: RequestInit,
  options?: { emitCartChanged?: boolean }
): Promise<T> {
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
    openAuthDialog();
    throw new Error('登录状态已失效，请重新登录');
  }
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as T;
  if (options?.emitCartChanged) {
    dispatchCartChanged();
  }
  return payload;
}

export const getCart = () => authJsonRequest<CartResponse>('/api/cart');

export const addCartItem = (productId: number, quantity = 1) =>
  authJsonRequest<CartResponse>(
    '/api/cart/items',
    {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity }),
    },
    { emitCartChanged: true }
  );

export const removeCartItem = (itemId: number) =>
  authJsonRequest<RemoveCartItemResponse>(`/api/cart/items/${encodeURIComponent(String(itemId))}`, {
    method: 'DELETE',
  }, { emitCartChanged: true });

export const checkoutCart = () =>
  authJsonRequest<OrderResponse>(
    '/api/orders/checkout',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    { emitCartChanged: true }
  );

export const buyNow = (productId: number, quantity = 1) =>
  authJsonRequest<OrderResponse>('/api/orders/buy_now', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, quantity }),
  });
