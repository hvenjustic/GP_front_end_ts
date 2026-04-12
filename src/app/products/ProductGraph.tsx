'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCalendar,
  FiChevronRight,
  FiCpu,
  FiGitBranch,
  FiLayers,
  FiRefreshCw,
  FiTag,
} from 'react-icons/fi';
import type cytoscape from 'cytoscape';
import { API_BASE } from '@/config/api';

const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), { ssr: false });

type GraphMeta = Record<string, string>;
type GraphRecord = Record<string, unknown>;

type GraphNode = {
  id: string;
  name?: string | null;
  type?: string | null;
  label?: string | null;
  description?: string | null;
  aliases?: string[] | null;
  date?: string | null;
  extra?: GraphRecord | null;
  raw?: GraphRecord | null;
  meta?: GraphMeta | null;
};

type GraphEdge = {
  id?: string;
  source: string;
  target: string;
  type?: string | null;
  label?: string | null;
  role?: string | null;
  raw?: GraphRecord | null;
  meta?: GraphMeta | null;
};

type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  can_view_node_details?: boolean;
};

type RelationshipPreview = {
  edge: GraphEdge;
  direction: 'outgoing' | 'incoming';
  neighbor: GraphNode;
  qualifiers: Array<[string, string]>;
};

const CytoscapeGraph = CytoscapeComponent as unknown as React.ComponentType<{
  elements: unknown[];
  style: React.CSSProperties;
  stylesheet: unknown;
  cy: (cy: cytoscape.Core) => void;
  minZoom?: number;
  maxZoom?: number;
}>;

const colorByType: Record<string, string> = {
  Organization: '#2563eb',
  Person: '#0f766e',
  Position: '#7c3aed',
  Brand: '#ea580c',
  Platform: '#0891b2',
  System: '#4f46e5',
  BusinessSegment: '#16a34a',
  ProductCategory: '#d97706',
  Production: '#f97316',
  Facility: '#dc2626',
  Location: '#059669',
  ContactInfo: '#475569',
  Award: '#ca8a04',
  Certification: '#0f766e',
  Event: '#db2777',
  Time: '#7c3aed',
  Metric: '#0284c7',
  StrategyConcept: '#c026d3',
  CultureConcept: '#e11d48',
  organization: '#2563eb',
  person: '#0f766e',
  position: '#7c3aed',
  brand: '#ea580c',
  platform: '#0891b2',
  system: '#4f46e5',
  businesssegment: '#16a34a',
  productcategory: '#d97706',
  production: '#f97316',
  facility: '#dc2626',
  location: '#059669',
  contactinfo: '#475569',
  award: '#ca8a04',
  certification: '#0f766e',
  event: '#db2777',
  time: '#7c3aed',
  metric: '#0284c7',
  strategyconcept: '#c026d3',
  cultureconcept: '#e11d48',
};

const typeLabels: Record<string, string> = {
  Organization: '组织',
  Person: '人物',
  Position: '职位',
  Brand: '品牌',
  Platform: '平台',
  System: '系统',
  BusinessSegment: '业务板块',
  ProductCategory: '产品分类',
  Production: '产物',
  Facility: '设施',
  Location: '地点',
  ContactInfo: '联系信息',
  Award: '奖项',
  Certification: '认证',
  Event: '事件',
  Time: '时间',
  Metric: '指标',
  StrategyConcept: '战略概念',
  CultureConcept: '文化概念',
};

const predicateLabels: Record<string, string> = {
  related_to: '关联',
  belongs_to: '属于',
  part_of: '从属',
  located_in: '位于',
  provides: '提供',
  manufactures: '生产',
  has_certification: '具备认证',
  has_award: '获得奖项',
  serves: '服务',
  owns: '拥有',
  uses: '使用',
  includes: '包含',
  supports: '支持',
  cooperates_with: '合作',
};

const getNodeName = (node: GraphNode) => String(node.label || node.name || node.id || '未知实体');

const getTypeColor = (type?: string | null) => {
  const raw = String(type || '').trim();
  if (!raw) return '#64748b';
  return colorByType[raw] || colorByType[raw.toLowerCase()] || '#64748b';
};

const formatTypeLabel = (type?: string | null) => {
  const raw = String(type || '').trim();
  if (!raw) return '未分类';
  if (typeLabels[raw]) return typeLabels[raw];
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
};

const formatPredicateLabel = (value?: string | null) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '关联';
  return predicateLabels[raw] || raw.replace(/_/g, ' ');
};

const formatEdgeLabel = (edge: GraphEdge) => {
  const predicate = formatPredicateLabel(edge.type || edge.label);
  const role = String(edge.role || '').trim();
  return role ? `${predicate} · ${role}` : predicate;
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).filter(Boolean).join('、');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const getRecordEntries = (record?: GraphRecord | GraphMeta | null) =>
  Object.entries(record || {}).reduce<Array<[string, string]>>((result, [key, value]) => {
    const text = formatValue(value);
    if (!text) return result;
    result.push([key, text]);
    return result;
  }, []);

const getRelationshipQualifiers = (edge: GraphEdge) => {
  const raw = edge.raw;
  if (!raw || typeof raw !== 'object') return [];
  const qualifiers = raw.qualifiers;
  if (!qualifiers || typeof qualifiers !== 'object' || Array.isArray(qualifiers)) return [];
  return getRecordEntries(qualifiers as GraphRecord);
};

interface ProductGraphProps {
  productId: string;
  authToken?: string;
  reloadKey?: number;
  onBack?: () => void;
  isEmbedded?: boolean;
}

export default function ProductGraph({ productId, authToken = '', reloadKey = 0 }: ProductGraphProps) {
  const [fullData, setFullData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canViewNodeDetails, setCanViewNodeDetails] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [visibleEdgeIds, setVisibleEdgeIds] = useState<Set<string>>(new Set());
  const [detailModalNode, setDetailModalNode] = useState<GraphNode | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchGraph = async () => {
    if (!productId) return;
    setLoading(true);
    setError('');
    setCanViewNodeDetails(false);
    setSelectedType(null);
    setSelectedEntityId(null);
    setVisibleNodeIds(new Set());
    setVisibleEdgeIds(new Set());
    setDetailModalNode(null);

    try {
      const headers = new Headers();
      if (authToken.trim()) {
        headers.set('Authorization', `Bearer ${authToken.trim()}`);
      }
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(productId)}/graph_preview`, {
        cache: 'no-store',
        headers,
      });
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      const json = (await res.json()) as GraphResponse;
      setFullData(json);
      setCanViewNodeDetails(Boolean(json.can_view_node_details));
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
      setFullData(null);
      setCanViewNodeDetails(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, authToken, reloadKey]);

  const nodeById = useMemo(() => {
    const lookup: Record<string, GraphNode> = {};
    fullData?.nodes.forEach((node) => {
      lookup[node.id] = node;
    });
    return lookup;
  }, [fullData]);

  const groupedEntities = useMemo(() => {
    const groups: Record<string, GraphNode[]> = {};
    fullData?.nodes.forEach((node) => {
      const type = String(node.type || '').trim() || 'Unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(node);
    });
    Object.values(groups).forEach((items) => {
      items.sort((left, right) => getNodeName(left).localeCompare(getNodeName(right), 'zh-Hans-CN'));
    });
    return groups;
  }, [fullData]);

  const availableTypes = useMemo(
    () =>
      Object.keys(groupedEntities).sort((left, right) => {
        const countDiff = (groupedEntities[right]?.length || 0) - (groupedEntities[left]?.length || 0);
        if (countDiff !== 0) return countDiff;
        return formatTypeLabel(left).localeCompare(formatTypeLabel(right), 'zh-Hans-CN');
      }),
    [groupedEntities],
  );

  const graphSummary = useMemo(
    () => ({
      nodeCount: fullData?.nodes.length || 0,
      edgeCount: fullData?.edges.length || 0,
      typeCount: availableTypes.length,
    }),
    [availableTypes.length, fullData],
  );

  const relationshipsByNodeId = useMemo(() => {
    const result: Record<string, RelationshipPreview[]> = {};
    fullData?.nodes.forEach((node) => {
      result[node.id] = [];
    });
    fullData?.edges.forEach((edge) => {
      const source = nodeById[edge.source];
      const target = nodeById[edge.target];
      if (!source || !target) return;

      const qualifiers = getRelationshipQualifiers(edge);
      result[source.id].push({
        edge,
        direction: 'outgoing',
        neighbor: target,
        qualifiers,
      });
      result[target.id].push({
        edge,
        direction: 'incoming',
        neighbor: source,
        qualifiers,
      });
    });

    Object.values(result).forEach((items) => {
      items.sort((left, right) => {
        const predicateCompare = formatEdgeLabel(left.edge).localeCompare(
          formatEdgeLabel(right.edge),
          'zh-Hans-CN',
        );
        if (predicateCompare !== 0) return predicateCompare;
        return getNodeName(left.neighbor).localeCompare(getNodeName(right.neighbor), 'zh-Hans-CN');
      });
    });
    return result;
  }, [fullData, nodeById]);

  const selectedEntity = useMemo(
    () => (selectedEntityId ? nodeById[selectedEntityId] || null : null),
    [nodeById, selectedEntityId],
  );

  const selectedRelationships = useMemo(
    () => (selectedEntityId ? relationshipsByNodeId[selectedEntityId] || [] : []),
    [relationshipsByNodeId, selectedEntityId],
  );

  const selectedEntityExtra = useMemo(
    () => getRecordEntries(selectedEntity?.extra),
    [selectedEntity],
  );

  const selectedEntityMeta = useMemo(
    () => getRecordEntries(selectedEntity?.meta),
    [selectedEntity],
  );

  const detailModalRelationships = useMemo(
    () => (detailModalNode ? relationshipsByNodeId[detailModalNode.id] || [] : []),
    [detailModalNode, relationshipsByNodeId],
  );

  const handleTypeClick = (type: string) => {
    setSelectedType(type === selectedType ? null : type);
  };

  const handleEntityClick = (entity: GraphNode, options?: { resetGraph?: boolean }) => {
    const resetGraph = options?.resetGraph ?? true;
    setSelectedEntityId(entity.id);

    if (!fullData || !resetGraph) return;

    const nextVisibleNodes = new Set<string>([entity.id]);
    const nextVisibleEdges = new Set<string>();

    fullData.edges.forEach((edge) => {
      const edgeId = edge.id || `${edge.source}-${edge.type || 'related_to'}-${edge.target}`;
      if (edge.source === entity.id || edge.target === entity.id) {
        nextVisibleEdges.add(edgeId);
        nextVisibleNodes.add(edge.source);
        nextVisibleNodes.add(edge.target);
      }
    });

    setVisibleNodeIds(nextVisibleNodes);
    setVisibleEdgeIds(nextVisibleEdges);
  };

  const handleExpandNextLevel = (nodeId: string) => {
    if (!fullData) return;

    const nextVisibleNodes = new Set(visibleNodeIds);
    const nextVisibleEdges = new Set(visibleEdgeIds);
    let added = false;

    fullData.edges.forEach((edge) => {
      const edgeId = edge.id || `${edge.source}-${edge.type || 'related_to'}-${edge.target}`;
      if (edge.source === nodeId || edge.target === nodeId) {
        if (!nextVisibleEdges.has(edgeId)) {
          nextVisibleEdges.add(edgeId);
          nextVisibleNodes.add(edge.source);
          nextVisibleNodes.add(edge.target);
          added = true;
        }
      }
    });

    if (added) {
      setVisibleEdgeIds(nextVisibleEdges);
      setVisibleNodeIds(nextVisibleNodes);
    }
  };

  const elements = useMemo(() => {
    if (!fullData) return [];

    const nodes = fullData.nodes
      .filter((node) => visibleNodeIds.has(node.id))
      .map((node) => ({
        data: {
          ...node,
          id: node.id,
          label: getNodeName(node),
          type: String(node.type || '').trim() || 'Unknown',
        },
      }));

    const edges = fullData.edges
      .filter((edge) => {
        const edgeId = edge.id || `${edge.source}-${edge.type || 'related_to'}-${edge.target}`;
        return visibleEdgeIds.has(edgeId);
      })
      .map((edge) => ({
        data: {
          ...edge,
          id: edge.id || `${edge.source}-${edge.type || 'related_to'}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: formatEdgeLabel(edge),
          type: edge.type || 'related_to',
        },
      }));

    return [...nodes, ...edges];
  }, [fullData, visibleEdgeIds, visibleNodeIds]);

  const elementsKey = useMemo(
    () =>
      elements
        .map((item) => {
          const value = item as { data?: { id?: string } };
          return value.data?.id || '';
        })
        .sort()
        .join('|'),
    [elements],
  );

  const handleCyReady = (cy: cytoscape.Core) => {
    cyRef.current = cy;
    cy.removeAllListeners();

    cy.on('cxttap', 'node', (evt) => {
      const nodeId = evt.target.id();
      const node = nodeById[nodeId];
      if (node) {
        setSelectedEntityId(nodeId);
      }
      handleExpandNextLevel(nodeId);
    });

    cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      const node = nodeById[nodeId];
      if (!node) return;
      handleEntityClick(node, { resetGraph: false });
    });
  };

  useEffect(() => {
    if (!cyRef.current || !elements.length) return;
    const layout = cyRef.current.layout({
      name: 'cose',
      animate: true,
      idealEdgeLength: 110,
      nodeOverlap: 20,
      refresh: 20,
      fit: true,
      padding: 40,
      randomize: false,
      componentSpacing: 100,
      nodeRepulsion: 400000,
      edgeElasticity: 100,
      nestingFactor: 5,
    } as never);
    layout.run();
  }, [elements.length, elementsKey, selectedEntityId]);

  const stylesheet = useMemo(
    () => [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          shape: 'round-rectangle',
          width: 'label',
          height: 'label',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '160px',
          'background-color': '#64748b',
          color: '#fff',
          'font-size': 11,
          'border-width': 1,
          'border-color': '#e5e7eb',
          padding: '10px',
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
          width: 1,
          'font-size': 8,
          'text-wrap': 'wrap',
          'text-max-width': '120px',
          'text-background-opacity': 1,
          'text-background-color': '#f8fafc',
          'text-background-padding': 2,
          'text-rotation': 'autorotate',
        },
      },
      {
        selector: ':selected',
        style: {
          'border-width': 4,
          'border-color': '#6366f1',
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
    <div className="flex h-[700px] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/50 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <FiLayers className="text-indigo-500" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">图谱预览</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {graphSummary.nodeCount} 个实体 / {graphSummary.edgeCount} 条关系
          </span>
          {!canViewNodeDetails && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              未购仅展示实体与关系
            </span>
          )}
        </div>
        <button
          onClick={() => void fetchGraph()}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          title="刷新"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 flex-shrink-0 border-r border-slate-200 bg-white/50 dark:border-slate-800 dark:bg-slate-900/30">
          <div className="bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/50">
            实体类型 ({availableTypes.length})
          </div>
          <div className="flex h-full flex-col overflow-y-auto p-2">
            {availableTypes.map((type) => (
              <button
                key={type}
                onClick={() => handleTypeClick(type)}
                className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedType === type
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getTypeColor(type) }}
                  />
                  <span className="truncate">{formatTypeLabel(type)}</span>
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    selectedType === type
                      ? 'bg-indigo-100 dark:bg-indigo-800/50'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  }`}
                >
                  {groupedEntities[type]?.length || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex-shrink-0 border-r border-slate-200 bg-white/30 transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/20"
          style={{ width: selectedType ? '18rem' : '0', opacity: selectedType ? 1 : 0, overflow: 'hidden' }}
        >
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/50">
            <FiChevronRight className="text-slate-400" />
            {selectedType ? `${formatTypeLabel(selectedType)} 列表` : '实体列表'}
          </div>
          <div className="flex h-full flex-col overflow-y-auto p-2">
            {selectedType &&
              groupedEntities[selectedType]?.map((entity) => {
                const aliases = entity.aliases?.length || 0;
                const summary =
                  String(entity.description || '').trim() ||
                  (aliases ? `别名 ${aliases} 个` : '') ||
                  String(entity.date || '').trim();
                return (
                  <button
                    key={entity.id}
                    onClick={() => handleEntityClick(entity)}
                    className={`mb-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selectedEntityId === entity.id
                        ? 'border-indigo-200 bg-white text-indigo-700 shadow-sm dark:border-indigo-900 dark:bg-slate-800 dark:text-indigo-300'
                        : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="truncate font-medium">{getNodeName(entity)}</div>
                    {summary && (
                      <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                        {summary}
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        <div className="relative flex-1 bg-slate-50/50 dark:bg-slate-950/50" ref={wrapperRef}>
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400">
              <FiRefreshCw className="animate-spin" /> 加载图谱数据...
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-rose-500">
              {error}
            </div>
          ) : elements.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <FiCpu className="mb-4 h-12 w-12 opacity-20" />
              <p>已加载 {graphSummary.nodeCount} 个实体与 {graphSummary.edgeCount} 条关系。</p>
              <p className="mt-2 text-sm">先从左侧选择实体类型，再点一个实体查看它在新图谱结构里的关系。</p>
            </div>
          ) : (
            <CytoscapeGraph
              elements={elements}
              style={{ width: '100%', height: '100%' }}
              stylesheet={stylesheet as never}
              cy={handleCyReady}
              minZoom={0.2}
              maxZoom={3}
            />
          )}

          {fullData && (
            <div className="absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] w-[min(22rem,calc(100%-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
              {selectedEntity ? (
                <div className="flex h-full flex-col">
                  <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-900 dark:text-white">
                          {getNodeName(selectedEntity)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: getTypeColor(selectedEntity.type) }}
                          >
                            {formatTypeLabel(selectedEntity.type)}
                          </span>
                          {selectedEntity.date && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              <FiCalendar className="h-3 w-3" />
                              {selectedEntity.date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedEntity.description && (
                      canViewNodeDetails ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {selectedEntity.description}
                        </p>
                      ) : null
                    )}
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        核心信息
                      </div>
                      <div className="space-y-2 text-slate-600 dark:text-slate-300">
                        {canViewNodeDetails && (
                          <div>
                            <span className="text-slate-400">节点 ID：</span>
                            {selectedEntity.id}
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">直接关系：</span>
                          {selectedRelationships.length}
                        </div>
                        {canViewNodeDetails && selectedEntity.aliases && selectedEntity.aliases.length > 0 && (
                          <div>
                            <div className="mb-1 text-slate-400">别名</div>
                            <div className="flex flex-wrap gap-2">
                              {selectedEntity.aliases.map((alias) => (
                                <span
                                  key={alias}
                                  className="rounded-full bg-white px-2 py-1 text-xs text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {alias}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {!canViewNodeDetails && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                        当前仅开放实体与关系预览。购买该图谱后，可查看节点描述、别名、属性字段和原始节点数据。
                      </div>
                    )}

                    {canViewNodeDetails && selectedEntityExtra.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <FiTag className="h-3.5 w-3.5" />
                          属性字段
                        </div>
                        <div className="space-y-2">
                          {selectedEntityExtra.map(([key, value]) => (
                            <div key={key} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/60">
                              <div className="text-xs text-slate-400">{key}</div>
                              <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {canViewNodeDetails && selectedEntityMeta.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Meta
                        </div>
                        <div className="space-y-2">
                          {selectedEntityMeta.map(([key, value]) => (
                            <div key={key} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/60">
                              <div className="text-xs text-slate-400">{key}</div>
                              <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <FiGitBranch className="h-3.5 w-3.5" />
                        关系预览 ({selectedRelationships.length})
                      </div>
                      {selectedRelationships.length ? (
                        <div className="space-y-2">
                          {selectedRelationships.map((item) => (
                            <button
                              key={`${selectedEntity.id}-${item.direction}-${item.edge.id || `${item.edge.source}-${item.edge.target}`}`}
                              onClick={() => handleEntityClick(item.neighbor)}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/30"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                  {getNodeName(item.neighbor)}
                                </span>
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {item.direction === 'outgoing' ? '出边' : '入边'}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {formatEdgeLabel(item.edge)}
                              </div>
                              {item.qualifiers.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {item.qualifiers.map(([key, value]) => (
                                    <span
                                      key={`${item.edge.id || item.edge.source}-${key}`}
                                      className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300"
                                    >
                                      {key}: {value}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          当前实体没有可展示的直接关系
                        </div>
                      )}
                    </div>

                    {canViewNodeDetails && selectedEntity.raw && (
                      <details className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/30">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500">
                          原始字段
                        </summary>
                        <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] text-slate-100">
                          {JSON.stringify(selectedEntity.raw, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="text-base font-semibold text-slate-900 dark:text-white">结构总览</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    新图谱结构会把实体归一化为节点，把关系归一化为边。先从左侧选一个实体开始查看。
                  </p>
                  {!canViewNodeDetails && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                      当前商品页只开放实体与关系浏览。购买后再解锁节点详细信息。
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">{graphSummary.nodeCount}</div>
                      <div className="text-xs text-slate-500">实体</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">{graphSummary.edgeCount}</div>
                      <div className="text-xs text-slate-500">关系</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">{graphSummary.typeCount}</div>
                      <div className="text-xs text-slate-500">类型</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {availableTypes.slice(0, 6).map((type) => (
                      <div
                        key={type}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/30"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: getTypeColor(type) }}
                          />
                          {formatTypeLabel(type)}
                        </span>
                        <span className="text-slate-500">{groupedEntities[type]?.length || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {detailModalNode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setDetailModalNode(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {getNodeName(detailModalNode)}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {formatTypeLabel(detailModalNode.type)} · {detailModalNode.id}
                </p>
              </div>
              <button
                onClick={() => setDetailModalNode(null)}
                className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-xs text-slate-500">类型</span>
                  <span
                    className="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: getTypeColor(detailModalNode.type) }}
                  >
                    {formatTypeLabel(detailModalNode.type)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">日期</span>
                  <span className="mt-1 inline-block text-sm text-slate-700 dark:text-slate-200">
                    {detailModalNode.date || '—'}
                  </span>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs text-slate-500">描述</span>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {detailModalNode.description || '暂无描述'}
                </p>
              </div>

              {detailModalNode.aliases && detailModalNode.aliases.length > 0 && (
                <div>
                  <span className="mb-2 block text-xs text-slate-500">别名</span>
                  <div className="flex flex-wrap gap-2">
                    {detailModalNode.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {getRecordEntries(detailModalNode.extra).length > 0 && (
                <div>
                  <span className="mb-2 block text-xs text-slate-500">属性</span>
                  <div className="space-y-2">
                    {getRecordEntries(detailModalNode.extra).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                        <div className="text-xs text-slate-400">{key}</div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="mb-2 block text-xs text-slate-500">
                  直接关系 ({detailModalRelationships.length})
                </span>
                {detailModalRelationships.length ? (
                  <div className="space-y-2">
                    {detailModalRelationships.map((item) => (
                      <div
                        key={`${detailModalNode.id}-${item.direction}-${item.edge.id || `${item.edge.source}-${item.edge.target}`}`}
                        className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {getNodeName(item.neighbor)}
                          </div>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                            {item.direction === 'outgoing' ? '出边' : '入边'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatEdgeLabel(item.edge)}
                        </div>
                        {item.qualifiers.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.qualifiers.map(([key, value]) => (
                              <span
                                key={`${item.edge.id || item.edge.source}-${key}`}
                                className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {key}: {value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    当前实体没有直接关系
                  </div>
                )}
              </div>

              {(detailModalNode.raw || detailModalNode.meta) && (
                <div>
                  <span className="mb-2 block text-xs text-slate-500">完整节点 JSON</span>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] text-slate-100">
                    {JSON.stringify(detailModalNode, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
