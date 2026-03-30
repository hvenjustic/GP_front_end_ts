'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FiLogIn, FiUserPlus, FiX } from 'react-icons/fi';
import { API_BASE } from '@/config/api';
import { setStoredToken } from './authStorage';

type AuthMode = 'login' | 'register';

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

type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (payload: AuthResponse) => void;
};

export default function AuthDialog({ open, onClose, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerNickname, setRegisterNickname] = useState('');
  const [registerCompany, setRegisterCompany] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!open) {
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const submitAuth = async (path: '/api/auth/login' | '/api/auth/register', payload: Record<string, string>) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `请求失败：${res.status}`);
      const authPayload = json as AuthResponse;
      setStoredToken(authPayload.access_token);
      onSuccess?.(authPayload);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitAuth('/api/auth/login', {
      email: loginEmail,
      password: loginPassword
    });
    setLoginPassword('');
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitAuth('/api/auth/register', {
      email: registerEmail,
      password: registerPassword,
      nickname: registerNickname,
      company_name: registerCompany
    });
    setRegisterPassword('');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl dark:border-slate-700 dark:bg-slate-950/95">
        <div className="flex items-start justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">JWT Auth</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {mode === 'login' ? '登录账号' : '注册账号'}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              登录后即可查看购物车、订单并使用积分结算图谱商品。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label="关闭登录弹窗"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              注册
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form className="mt-5 space-y-3" onSubmit={handleLogin}>
              <input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="邮箱"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="密码"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <FiLogIn className="h-4 w-4" />
                {submitting ? '登录中' : '登录'}
              </button>
            </form>
          ) : (
            <form className="mt-5 space-y-3" onSubmit={handleRegister}>
              <input
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="邮箱"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <input
                type="password"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                placeholder="密码"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <input
                value={registerNickname}
                onChange={(event) => setRegisterNickname(event.target.value)}
                placeholder="用户名"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <input
                value={registerCompany}
                onChange={(event) => setRegisterCompany(event.target.value)}
                placeholder="公司名称"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiUserPlus className="h-4 w-4" />
                {submitting ? '注册中' : '注册并登录'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
