'use client';

import { useEffect, useState } from 'react';
import { FiExternalLink, FiLoader } from 'react-icons/fi';

import { WORLDMONITOR_EMBED_URL } from '@/config/api';

const LOAD_TIMEOUT_MS = 6000;

export default function GraphClient() {
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [embedBlockedByPolicy, setEmbedBlockedByPolicy] = useState(false);

  useEffect(() => {
    try {
      const currentOrigin = window.location.origin;
      const targetUrl = new URL(WORLDMONITOR_EMBED_URL, currentOrigin);
      const isOfficialWorldMonitorHost = /(^|\.)worldmonitor\.app$/i.test(targetUrl.hostname);
      if (isOfficialWorldMonitorHost && targetUrl.origin !== currentOrigin) {
        setEmbedBlockedByPolicy(true);
      }
    } catch {
      setEmbedBlockedByPolicy(false);
    }
  }, []);

  useEffect(() => {
    if (frameLoaded || embedBlockedByPolicy) return;

    const timeoutId = window.setTimeout(() => {
      setShowFallback(true);
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [embedBlockedByPolicy, frameLoaded]);

  if (embedBlockedByPolicy) {
    return (
      <section className="relative flex h-[calc(100svh-5rem)] w-full items-center justify-center overflow-hidden bg-[#020a08] px-6">
        <div className="w-full max-w-2xl rounded-3xl border border-emerald-400/15 bg-[radial-gradient(circle_at_top,rgba(16,40,30,0.75),rgba(3,10,8,0.98))] p-8 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
              当前地址不支持 iframe 嵌入
            </span>
            <h1 className="text-3xl font-semibold text-white">情报监控页无法直接嵌入官方 World Monitor</h1>
            <p className="text-sm leading-7 text-slate-300">
              `www.worldmonitor.app` 配置了 `X-Frame-Options: SAMEORIGIN` 和 `frame-ancestors`，
              浏览器会拒绝从当前站点把它嵌进 iframe。
            </p>
            <p className="text-sm leading-7 text-slate-400">
              本地联调请先启动本地 `worldmonitor`，并让这里指向 `http://localhost:5173/?lang=zh`；
              如果只是临时查看，可以直接新窗口打开。
            </p>
            <a
              href={WORLDMONITOR_EMBED_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-400/15"
            >
              新窗口打开 World Monitor
              <FiExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-[calc(100svh-5rem)] w-full overflow-hidden bg-[#020a08]">
      {!frameLoaded ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(circle_at_top,#0d1b15,transparent_42%),linear-gradient(180deg,#06110d_0%,#020a08_60%,#010404_100%)] px-6">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-emerald-200 uppercase">
              <FiLoader className="h-4 w-4 animate-spin" />
              情报监控载入中
            </span>
            {showFallback ? (
              <a
                href={WORLDMONITOR_EMBED_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-black/30 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/50 hover:bg-black/40"
              >
                新窗口打开 World Monitor
                <FiExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <iframe
        src={WORLDMONITOR_EMBED_URL}
        title="情报监控"
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen; geolocation"
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => {
          setFrameLoaded(true);
        }}
      />
    </section>
  );
}
