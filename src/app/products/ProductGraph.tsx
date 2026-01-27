'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, MouseEvent } from 'react';
import { FiArrowLeft, FiRefreshCw, FiSearch, FiChevronRight, FiZoomIn, FiZoomOut, FiMaximize, FiCpu, FiLayers } from 'react-icons/fi';
import type cytoscape from 'cytoscape';
import { API_BASE } from '@/config/api';

const CytoscapeComponent = dynamic(() => import('react-cytoscapejs'), { ssr: false });

type GraphNode = {
  id: string;
  name?: string;
  type?: string;
  label?: string;
  description?: string;
  aliases?: string[];
  extra?: Record<string, any>;
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

interface ProductGraphProps {
  id: string;
  onBack?: () => void;
  isEmbedded?: boolean;
}

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
};

export default function ProductGraph({ id, onBack, isEmbedded = false }: ProductGraphProps) {
  const [fullData, setFullData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Navigation State
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  
  // Graph Visibility State
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [visibleEdgeIds, setVisibleEdgeIds] = useState<Set<string>>(new Set());
  
  // Interaction State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, nodeId: null });
  const [detailModalNode, setDetailModalNode] = useState<GraphNode | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchGraph = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    // Reset states
    setSelectedType(null);
    setSelectedEntityId(null);
    setVisibleNodeIds(new Set());
    setVisibleEdgeIds(new Set());
    
    try {
      const res = await fetch(`${API_BASE}/api/results/${encodeURIComponent(id)}/graph_view`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`请求失败：${res.status}`);
      const json = (await res.json()) as GraphResponse;
      setFullData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
      setFullData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Derived Data: Grouped Entities
  const groupedEntities = useMemo(() => {
    if (!fullData?.nodes) return {};
    const groups: Record<string, GraphNode[]> = {};
    fullData.nodes.forEach(node => {
      const type = node.type || 'Unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(node);
    });
    return groups;
  }, [fullData]);

  const availableTypes = useMemo(() => Object.keys(groupedEntities).sort(), [groupedEntities]);

  // Handle Type Selection
  const handleTypeClick = (type: string) => {
    setSelectedType(type === selectedType ? null : type);
  };

  // Handle Entity Selection (Reset graph to focus on this entity)
  const handleEntityClick = (entity: GraphNode) => {
    setSelectedEntityId(entity.id);
    
    // Initial Graph: Entity + Direct Neighbors
    if (!fullData) return;

    const newVisibleNodes = new Set<string>([entity.id]);
    const newVisibleEdges = new Set<string>();

    fullData.edges.forEach(edge => {
      if (edge.source === entity.id || edge.target === entity.id) {
        newVisibleEdges.add(edge.id || `${edge.source}-${edge.type}-${edge.target}`);
        newVisibleNodes.add(edge.source);
        newVisibleNodes.add(edge.target);
      }
    });

    setVisibleNodeIds(newVisibleNodes);
    setVisibleEdgeIds(newVisibleEdges);

    // Close context menu if open
    setContextMenu({ ...contextMenu, visible: false });
  };

  // Handle Expand Next Level
  const handleExpandNextLevel = (nodeId: string) => {
    if (!fullData) return;
    
    const newVisibleEdges = new Set(visibleEdgeIds);
    const newVisibleNodes = new Set(visibleNodeIds);
    let added = false;

    fullData.edges.forEach(edge => {
      if (edge.source === nodeId || edge.target === nodeId) {
        const edgeId = edge.id || `${edge.source}-${edge.type}-${edge.target}`;
        if (!newVisibleEdges.has(edgeId)) {
            newVisibleEdges.add(edgeId);
            newVisibleNodes.add(edge.source);
            newVisibleNodes.add(edge.target);
            added = true;
        }
      }
    });

    if (added) {
        setVisibleEdgeIds(newVisibleEdges);
        setVisibleNodeIds(newVisibleNodes);
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  // Construct Cytoscape Elements
  const elements = useMemo(() => {
    if (!fullData) return [];
    
    const nodes = fullData.nodes
      .filter(n => visibleNodeIds.has(n.id))
      .map(n => ({
        data: {
          id: n.id,
          label: n.label || n.name || n.id,
          type: n.type,
          ...n,
        }
      }));
      
    const edges = fullData.edges
      .filter(e => {
        const edgeId = e.id || `${e.source}-${e.type}-${e.target}`;
        return visibleEdgeIds.has(edgeId);
      })
      .map(e => ({
        data: {
            id: e.id || `${e.source}-${e.type}-${e.target}`,
            source: e.source,
            target: e.target,
            label: e.label || e.type,
            type: e.type,
            ...e,
        }
      }));
      
    return [...nodes, ...edges];
  }, [fullData, visibleNodeIds, visibleEdgeIds]);

  // Cy Setup
  const handleCyReady = (cy: cytoscape.Core) => {
    cyRef.current = cy;
    
    cy.on('cxttap', 'node', (evt) => {
      const node = evt.target;
      const containerRect = wrapperRef.current?.getBoundingClientRect();
      
      if (containerRect) {
        setContextMenu({
            visible: true,
            x: evt.originalEvent.clientX - containerRect.left,
            y: evt.originalEvent.clientY - containerRect.top,
            nodeId: node.id()
        });
      }
    });

    cy.on('tap', (evt) => {
        if (evt.target === cy) {
            setContextMenu(prev => ({ ...prev, visible: false }));
        }
    });
    
    // Auto layout when elements change significantly? 
    // Usually better to let user trigger layout or do it initially.
    // Here we run layout when selecting a new entity creates a fresh graph.
  };

  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
        const layout = cyRef.current.layout({ 
            name: 'cose', 
            animate: true,
            idealEdgeLength: 100,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 30,
            randomize: false,
            componentSpacing: 100,
            nodeRepulsion: 400000,
            edgeElasticity: 100,
            nestingFactor: 5,
        } as any);
        layout.run();
    }
  }, [elements.length]); // Re-run layout when element count changes (simplistic approach)


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
          'width': 1,
          'font-size': 8,
          'text-background-opacity': 1,
          'text-background-color': '#f8fafc',
          'text-rotation': 'autorotate',
        },
      },
      {
        selector: ':selected',
        style: {
          'border-width': 4,
          'border-color': '#6366f1',
        }
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
    <div className="flex flex-col h-[700px] w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
             <FiLayers className="text-indigo-500" />
             <span className="font-semibold text-slate-700 dark:text-slate-200">知识图谱探索器</span>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={fetchGraph}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition"
                title="刷新"
            >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Column 1: Types */}
        <div className="w-48 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 flex flex-col">
            <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50">
                实体类型 ({availableTypes.length})
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                {availableTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => handleTypeClick(type)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                            selectedType === type 
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                            : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-400'
                        }`}
                    >
                        <span className="truncate">{type}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                             selectedType === type
                             ? 'bg-indigo-100 dark:bg-indigo-800/50'
                             : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                            {groupedEntities[type]?.length || 0}
                        </span>
                    </button>
                ))}
            </div>
        </div>

        {/* Column 2: Entities */}
        <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/20 flex flex-col transition-all duration-300"
             style={{ width: selectedType ? '16rem' : '0', opacity: selectedType ? 1 : 0, overflow: 'hidden' }}>
            <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
                <FiChevronRight className="text-slate-400" />
                {selectedType} 列表
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {selectedType && groupedEntities[selectedType]?.map(entity => (
                    <button
                        key={entity.id}
                        onClick={() => handleEntityClick(entity)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                            selectedEntityId === entity.id
                            ? 'bg-white border-indigo-200 shadow-sm text-indigo-700 dark:bg-slate-800 dark:border-indigo-900 dark:text-indigo-300'
                            : 'border-transparent hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-400'
                        }`}
                    >
                        <div className="font-medium truncate">{entity.name || entity.label || entity.id}</div>
                        {entity.description && (
                            <div className="text-xs text-slate-400 truncate mt-0.5">{entity.description}</div>
                        )}
                    </button>
                ))}
            </div>
        </div>

        {/* Column 3: Graph Canvas */}
        <div className="flex-1 relative bg-slate-50/50 dark:bg-slate-950/50" ref={wrapperRef}>
            {loading ? (
                 <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2">
                    <FiRefreshCw className="animate-spin" /> 加载图谱数据...
                 </div>
            ) : elements.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <FiCpu className="w-12 h-12 mb-4 opacity-20" />
                    <p>请从左侧选择实体类型和具体实体以开始探索</p>
                </div>
            ) : (
                <CytoscapeComponent
                    elements={elements}
                    style={{ width: '100%', height: '100%' }}
                    stylesheet={stylesheet as any}
                    cy={handleCyReady}
                    minZoom={0.2}
                    maxZoom={3}
                />
            )}

            {/* Context Menu */}
            {contextMenu.visible && contextMenu.nodeId && (
                <div 
                    className="absolute z-10 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onMouseLeave={() => setContextMenu({ ...contextMenu, visible: false })}
                >
                    <button
                        onClick={() => {
                            const node = fullData?.nodes.find(n => n.id === contextMenu.nodeId);
                            if (node) setDetailModalNode(node);
                            setContextMenu({ ...contextMenu, visible: false });
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                        <FiSearch className="w-4 h-4" /> 查看详细描述
                    </button>
                    <button
                        onClick={() => contextMenu.nodeId && handleExpandNextLevel(contextMenu.nodeId)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                        <FiMaximize className="w-4 h-4" /> 展开下一级关系
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailModalNode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDetailModalNode(null)}>
              <div 
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="font-semibold text-lg">{detailModalNode.name || detailModalNode.id}</h3>
                      <button onClick={() => setDetailModalNode(null)} className="text-slate-400 hover:text-slate-600">×</button>
                  </div>
                  <div className="p-4 overflow-y-auto space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                              <span className="text-slate-500 block text-xs">ID</span>
                              {detailModalNode.id}
                          </div>
                          <div>
                              <span className="text-slate-500 block text-xs">类型</span>
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs mt-1">
                                  {detailModalNode.type}
                              </span>
                          </div>
                      </div>
                      
                      <div>
                          <span className="text-slate-500 block text-xs mb-1">描述</span>
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                              {detailModalNode.description || '暂无描述'}
                          </p>
                      </div>

                      {detailModalNode.extra && (
                          <div>
                              <span className="text-slate-500 block text-xs mb-1">完整信息 (Extra)</span>
                              <pre className="bg-slate-900 text-slate-50 p-3 rounded-lg text-xs overflow-auto max-h-48 font-mono">
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

