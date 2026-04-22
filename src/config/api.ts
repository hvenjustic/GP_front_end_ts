export const API_BASE = process.env.NEXT_PUBLIC_PY_API ?? 'http://localhost:8000';
export const AGENT_API_BASE = API_BASE;
const DEFAULT_WORLDMONITOR_DEV_URL = 'http://localhost:5173/?lang=zh';
const DEFAULT_WORLDMONITOR_PROD_URL = 'https://www.worldmonitor.app/?lang=zh';

export const WORLDMONITOR_EMBED_URL =
  process.env.NEXT_PUBLIC_WORLDMONITOR_URL?.trim()
  || (process.env.NODE_ENV === 'development'
    ? DEFAULT_WORLDMONITOR_DEV_URL
    : DEFAULT_WORLDMONITOR_PROD_URL);
