'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';

const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_GO_API ?? 'http://www.hvenjustic.top:4010';

type GraphNode = {
    id: string;
    name?: string;
    type?: string;
    label?: string;
    description?: string;
};

type GraphEdge = {
    id?: string;
    source: string;
    target: string;
    type?: string;
    label?: string;
};

type GraphResponse = {
    nodes: GraphNode[];
    edges: GraphEdge[];
};

const colorByType: Record<string, string> = {
    company: '#2563eb',
    startup: '#0ea5e9',
    scientist: '#22c55e',
    university: '#a855f7',
    product: '#f97316',
    patent: '#16a34a',
    researchpaper: '#14b8a6',
    process: '#ef4444',
    technology: '#84cc16',
    fundinground: '#d946ef',
    clinictrial: '#f59e0b',
    governmentagency: '#c026d3',
};

export default function GraphViewClient() {
    const searchParams = useSearchParams();
    const id = useMemo(() => searchParams.get('id')?.trim() || '', [searchParams]);

    const [data, setData] = useState<GraphResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchGraph = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/results/${encodeURIComponent(id)}/graph_view`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`请求失败：${res.status}`);
            const json = (await res.json()) as GraphResponse;
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : '未知错误');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGraph();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const elements = useMemo(() => {
        if (!data) return [];
        const nodeElems =
            data.nodes?.map((n) => ({
                data: {
                    id: n.id,
                    label: n.label || n.name || n.id,
                    type: n.type,
                    ...n,
                },
            })) ?? [];
        const edgeElems =
            data.edges?.map((e) => ({
                data: {
                    id: e.id || `${e.source}-${e.type || 'REL'}-${e.target}`,
                    source: e.source,
                    target: e.target,
                    label: e.label || e.type,
                    type: e.type,
                    ...e,
                },
            })) ?? [];
        return [...nodeElems, ...edgeElems];
    }, [data]);

    const stylesheet = useMemo(
        () => [
            {
                selector: 'node',
                style: {
                    label: 'data(label)',
                    'text-wrap': 'wrap',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'background-color': '#4f46e5',
                    color: '#fff',
                    'font-size': 10,
                    'border-width': 2,
                    'border-color': '#e5e7eb',
                    padding: '6px',
                },
            },
            {
                selector: 'edge',
                style: {
                    label: 'data(label)',
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': '#94a3b8',
                    'line-color': '#cbd5e1',
                    'font-size': 9,
                    'text-background-opacity': 1,
                    'text-background-color': '#f8fafc',
                    'text-background-padding': 2,
                },
            },
            ...Object.entries(colorByType).map(([key, value]) => ({
                selector: `node[type = "${key}"]`,
                style: {
                    'background-color': value,
                },
            })),
        ],
        [],
    );

    return (
        <div className="px-6 pb-16">
            <div className="mx-auto mt-8 max-w-6xl space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/result/detail?id=${id}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                        >
                            <FiArrowLeft className="h-4 w-4" />
                            返回详情
                        </Link>
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">图谱渲染</h1>
                        {id && <span className="text-sm text-slate-500 dark:text-slate-400">ID：{id}</span>}
                    </div>
                    <button
                        onClick={fetchGraph}
                        disabled={!id}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600"
                    >
                        <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        重新加载
                    </button>
                </div>

                {!id && (
                    <div className="glass-panel rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                        缺少参数 <code>id</code>，请从详情页点击跳转。
                    </div>
                )}

                {error && (
                    <div className="glass-panel rounded-2xl border border-red-200 bg-red-50/70 p-5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                        {error}
                    </div>
                )}

                <div className="glass-panel rounded-2xl border border-gray-200/60 bg-white/70 p-5 shadow-sm dark:border-gray-800/60 dark:bg-slate-900/70">
                    <div className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                        使用 Cytoscape 展示当前任务的 graph_json。节点可拖动，右上角“重新加载”可刷新数据。
                    </div>
                    <div className="h-[72vh] w-full">
                        {data ? (
                            <CytoscapeComponent
                                elements={elements}
                                layout={{ name: 'cose', idealEdgeLength: 120, nodeOverlap: 10 }}
                                style={{ width: '100%', height: '100%' }}
                                stylesheet={stylesheet as any}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                                {loading ? '加载中...' : '暂无数据'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

