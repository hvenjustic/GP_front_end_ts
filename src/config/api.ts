export const API_BASE = process.env.NEXT_PUBLIC_PY_API ?? 'http://localhost:8031';
export const AGENT_API_BASE = API_BASE;
const DEFAULT_WORLDMONITOR_DEV_URL = 'http://localhost:5173/?lang=zh';
const DEFAULT_WORLDMONITOR_PROD_URL = 'https://www.worldmonitor.app/?lang=zh';
const DEFAULT_WORLDMONITOR_PROD_PORT = process.env.NEXT_PUBLIC_WORLDMONITOR_PORT?.trim() || '4173';

const buildDefaultWorldMonitorProdUrl = (origin?: string) => {
  if (!origin) return DEFAULT_WORLDMONITOR_PROD_URL;

  try {
    const url = new URL(origin);
    url.port = DEFAULT_WORLDMONITOR_PROD_PORT;
    url.pathname = '/';
    url.search = '?lang=zh';
    url.hash = '';
    return url.toString();
  } catch {
    return DEFAULT_WORLDMONITOR_PROD_URL;
  }
};

export const getWorldMonitorEmbedUrl = (origin?: string) =>
  process.env.NEXT_PUBLIC_WORLDMONITOR_URL?.trim()
  || (process.env.NODE_ENV === 'development'
    ? DEFAULT_WORLDMONITOR_DEV_URL
    : buildDefaultWorldMonitorProdUrl(origin));
