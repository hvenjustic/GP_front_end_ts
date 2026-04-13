'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { FiMapPin } from 'react-icons/fi';

import { API_BASE } from '@/config/api';

type MapPoint = {
  id: string;
  name: string;
  coordinates: [number, number];
  latitude: number;
  longitude: number;
  size: number;
  color: string;
};

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const POINT_PALETTE = ['#2563eb', '#0ea5e9', '#22c55e', '#f97316', '#e11d48', '#a855f7', '#14b8a6', '#f59e0b'];

// Marker 可调参数（你可以在这里改数值来调试）
// - MARKER_RADIUS: 点的半径（屏幕像素）
// - MARKER_OPACITY: 点透明度
// - MARKER_FIXED_SIZE: 是否让点大小不随地图缩放变化（true: 固定屏幕大小）
const MARKER_RADIUS = 2;
const MARKER_OPACITY = 0.85;
const MARKER_FIXED_SIZE = true;

type GraphLocateItem = {
  name: string;
  latitude: number;
  longitude: number;
};

type GraphLocateResponse = {
  items?: GraphLocateItem[];
};

type Bounds = {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const computeBounds = (geo: any): Bounds | null => {
  const coords = geo?.geometry?.coordinates;
  const type = geo?.geometry?.type;
  if (!coords || !type) return null;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const visit = (pt: any) => {
    if (!Array.isArray(pt) || pt.length < 2) return;
    const lon = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  };

  const walk = (node: any) => {
    if (!Array.isArray(node)) return;
    if (node.length > 0 && Array.isArray(node[0]) && typeof node[0][0] === 'number') {
      node.forEach(visit);
      return;
    }
    node.forEach(walk);
  };

  walk(coords);
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLon) || !Number.isFinite(maxLat)) return null;
  return { minLon, maxLon, minLat, maxLat };
};

export default function GraphClient() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 20]);
  const [mapZoom, setMapZoom] = useState(1);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const fetchPoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/graph_locate`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = (await res.json()) as GraphLocateResponse | GraphLocateItem[];
      const items = Array.isArray(payload) ? payload : payload.items ?? [];
      const next: MapPoint[] = items
        .filter(
          (item) =>
            typeof item.name === 'string' &&
            item.name.trim() &&
            Number.isFinite(item.latitude) &&
            Number.isFinite(item.longitude)
        )
        .map((item, index) => {
          const longitude = Number(item.longitude.toFixed(6));
          const latitude = Number(item.latitude.toFixed(6));
          const name = item.name.trim();
          return {
            id: `${name}-${longitude}-${latitude}`,
            name,
            coordinates: [longitude, latitude],
            longitude,
            latitude,
            size: MARKER_RADIUS,
            color: POINT_PALETTE[index % POINT_PALETTE.length]
          };
        });
      setPoints(next);
    } catch (e) {
      setPoints([]);
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  const markerScale = useMemo(() => (MARKER_FIXED_SIZE ? 1 / Math.max(mapZoom, 0.1) : 1), [mapZoom]);

  const resetView = useCallback(() => {
    setSelectedCountry(null);
    setMapCenter([0, 20]);
    setMapZoom(1);
  }, []);

  return (
    <div className="relative isolate px-6 pb-16">
      <section className="mx-auto mt-8 max-w-[108rem] overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-8 shadow-lg backdrop-blur md:p-12 dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
              <FiMapPin className="h-4 w-4" />
              地理分布
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white md:text-4xl">
                站点地理分布预览
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                使用 react-simple-maps 渲染世界地图，从后端读取站点的 `geo_location` 信息，展示企业官网样本的真实分布。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {selectedCountry ? (
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                已选中国家：{selectedCountry}
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">点击国家可放大查看</span>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-[108rem]">
        <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/80 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">二维地图</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">World Map · Mercator</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">点位：{points.length || '—'}</span>
          </div>
          <div className="relative h-[70vh] w-full rounded-2xl bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-2 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <button
              type="button"
              onClick={resetView}
              className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-slate-600"
            >
              重置视图
            </button>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 145 }}
              style={{ width: '100%', height: '100%' }}
              className="h-full w-full"
            >
              <ZoomableGroup
                center={mapCenter}
                zoom={mapZoom}
                maxZoom={8}
                disablePanning
                filterZoomEvent={() => false}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }: { geographies: any[] }) =>
                    geographies.map((geo: any) => {
                      const name = (geo as any)?.properties?.name as string | undefined;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => {
                            const bounds = computeBounds(geo);
                            if (!bounds) return;
                            const centerLon = (bounds.minLon + bounds.maxLon) / 2;
                            const centerLat = (bounds.minLat + bounds.maxLat) / 2;
                            const span = Math.max(bounds.maxLon - bounds.minLon, bounds.maxLat - bounds.minLat);
                            const nextZoom = clamp(240 / Math.max(span, 2), 1, 12);
                            setSelectedCountry(name ?? '未知');
                            setMapCenter([centerLon, centerLat]);
                            setMapZoom(nextZoom);
                          }}
                          className="cursor-pointer transition-colors fill-slate-200 stroke-white/80 hover:fill-indigo-200 dark:fill-slate-800 dark:stroke-slate-700 dark:hover:fill-slate-700"
                        />
                      );
                    })
                  }
                </Geographies>
                {points.map((point) => (
                  <Marker key={point.id} coordinates={point.coordinates}>
                    <title>{point.name}</title>
                    <g transform={`scale(${markerScale})`}>
                      <circle r={point.size} fill={point.color} fillOpacity={MARKER_OPACITY} />
                    </g>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
          </div>
          {error ? (
            <p className="mt-3 text-xs text-rose-600 dark:text-rose-300">点位加载失败：{error}</p>
          ) : (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              地图数据来自 world-atlas，点位来自后端 <code>/api/graph_locate</code>。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
