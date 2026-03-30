'use client';

const AUTH_CHANGE_EVENT = 'kg-auth-changed';
const AUTH_DIALOG_EVENT = 'kg-auth-dialog-open';

export const AUTH_TOKEN_KEY = 'kg_auth_token';

export const getStoredToken = () => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

const dispatchAuthChanged = (token: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { token } }));
};

export const setStoredToken = (token: string) => {
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
  dispatchAuthChanged(token);
};

export const clearStoredToken = () => {
  setStoredToken('');
};

export const subscribeAuthToken = (listener: (token: string) => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleAuthChanged = (event: Event) => {
    const customEvent = event as CustomEvent<{ token?: string }>;
    listener(String(customEvent.detail?.token || ''));
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTH_TOKEN_KEY) {
      listener(event.newValue || '');
    }
  };

  window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChanged as EventListener);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChanged as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
};

export const openAuthDialog = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_DIALOG_EVENT));
};

export const subscribeAuthDialogOpen = (listener: () => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleOpen = () => listener();
  window.addEventListener(AUTH_DIALOG_EVENT, handleOpen);
  return () => {
    window.removeEventListener(AUTH_DIALOG_EVENT, handleOpen);
  };
};
