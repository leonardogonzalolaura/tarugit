import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { formatDate } from '../history/utils';

interface GraphNode {
  id: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
  parents: string[];
  branches: string[];
  tags: string[];
}

interface CommitGraph {
  nodes: GraphNode[];
}

const BRANCH_COLORS = [
  '#6e7fff', '#3dd68c', '#fbbf24', '#f87171', '#a78bfa',
  '#34d399', '#fb923c', '#60a5fa', '#e879f9', '#22d3ee',
  '#c084fc', '#4ade80', '#f472b6', '#38bdf8', '#facc15',
];

interface BranchGraphProps {
  repoPath: string;
  onCommitSelect?: (commitId: string) => void;
}

const NODE_SIZE = 26;
const ROW_HEIGHT = 34;
const LANE_WIDTH = 30;
const PADDING = { left: 24, right: 40, top: 16, bottom: 16 };

function Legend() {
  return (
    <div style={{
      display: 'flex', gap: 16, padding: '6px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
        🛈 Leyenda:
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5" fill="none" stroke="var(--accent)" strokeWidth="2" />
        </svg>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Commit</span>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path d="M 1 6 L 14 6" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" />
          <circle cx="14" cy="6" r="2" fill="var(--text-muted)" />
        </svg>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Padre → Hijo</span>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 600 }}>main</span>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Rama local</span>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'var(--yellow-bg)', color: 'var(--yellow)', fontWeight: 600 }}>v1.0</span>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Tag</span>
      </div>
    </div>
  );
}

export function BranchGraph({ repoPath, onCommitSelect }: BranchGraphProps) {
  const [graph, setGraph] = useState<CommitGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [titleFilter, setTitleFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    loadGraph();
  }, [repoPath]);

  const loadGraph = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const result = await invoke<CommitGraph>('get_commit_graph', {
        repoPath,
        maxNodes: 300,
      });
      setGraph(result);
    } catch (e) {
      console.error('Error loading graph:', e);
    } finally {
      setLoading(false);
    }
  };

  // Build lane assignments
  const layout = useMemo(() => {
    if (!graph) return null;

    const nodes = graph.nodes;
    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const branchLane = new Map<string, number>();
    const commitLane = new Map<string, number>();
    let nextLane = 0;

    for (const node of nodes) {
      if (node.branches.length > 0) {
        for (const branch of node.branches) {
          if (!branchLane.has(branch)) {
            branchLane.set(branch, nextLane++);
          }
        }
        commitLane.set(node.id, branchLane.get(node.branches[0])!);
      } else if (node.parents.length > 0) {
        const parentLane = commitLane.get(node.parents[0]);
        commitLane.set(node.id, parentLane ?? 0);
      } else {
        commitLane.set(node.id, 0);
      }
    }

    const totalLanes = nextLane || 1;

    // Build edge list (child -> parent)
    const edges: { from: string; to: string }[] = [];
    for (const node of nodes) {
      for (const parentId of node.parents) {
        if (nodeMap.has(parentId)) {
          edges.push({ from: node.id, to: parentId });
        }
      }
    }

    return {
      nodes,
      edges,
      nodeMap,
      commitLane,
      totalLanes,
    };
  }, [graph]);

  const getNodeColor = useCallback((nodeId: string) => {
    if (!layout) return BRANCH_COLORS[0];
    const lane = layout.commitLane.get(nodeId) ?? 0;
    return BRANCH_COLORS[lane % BRANCH_COLORS.length];
  }, [layout]);

  // SVG dimensions based on container width
  const totalLanes = layout?.totalLanes ?? 1;
  const graphContentWidth = PADDING.left + totalLanes * LANE_WIDTH + 320 + PADDING.right;
  const svgWidth = Math.max(containerWidth - 4, graphContentWidth);
  const svgHeight = layout
    ? PADDING.top + layout.nodes.length * ROW_HEIGHT + PADDING.bottom
    : 400;

  const getNodeX = useCallback((nodeId: string) => {
    if (!layout) return PADDING.left;
    const lane = layout.commitLane.get(nodeId) ?? 0;
    return PADDING.left + lane * LANE_WIDTH + LANE_WIDTH / 2;
  }, [layout]);

  const getNodeY = useCallback((idx: number) => {
    return PADDING.top + idx * ROW_HEIGHT + ROW_HEIGHT / 2;
  }, []);

  // Filter by commit title
  const filteredNodes = useMemo(() => {
    if (!layout) return [];
    if (!titleFilter.trim()) return layout.nodes;
    const q = titleFilter.toLowerCase();
    return layout.nodes.filter(n =>
      n.message.toLowerCase().includes(q) ||
      n.author.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q)
    );
  }, [layout, titleFilter]);

  if (loading) {
    return (
      <div className="panel-loading" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" /> Cargando grafo...
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="panel-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        No hay commits para mostrar
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>🌳 Grafo de commits</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{graph.nodes.length} commits</span>
        <div style={{ flex: 1, minWidth: 0 }} />
        <input
          type="text"
          placeholder="Filtrar commits..."
          value={titleFilter}
          onChange={e => setTitleFilter(e.target.value)}
          style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 5,
            border: '1px solid var(--border)', background: 'var(--bg-base)',
            color: 'var(--text-primary)', width: 200,
            fontFamily: 'var(--font-sans)',
          }}
        />
        <button className="btn-icon" onClick={loadGraph} title="Recargar" style={{ width: 26, height: 26, fontSize: 13 }}>↻</button>
      </div>

      {/* Legend */}
      <Legend />

      {/* Scrollable SVG area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <svg width={svgWidth} height={svgHeight} style={{ display: 'block' }}>
          {/* Edges */}
          {layout && layout.edges.map(edge => {
            const fromIdx = filteredNodes.findIndex(n => n.id === edge.from);
            const toIdx = filteredNodes.findIndex(n => n.id === edge.to);
            if (fromIdx === -1 || toIdx === -1) return null;

            const x1 = getNodeX(edge.from);
            const y1 = getNodeY(fromIdx);
            const x2 = getNodeX(edge.to);
            const y2 = getNodeY(toIdx);
            const color = getNodeColor(edge.from);
            const midY = (y1 + y2) / 2;

            return (
              <path
                key={`e-${edge.from}-${edge.to}`}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.45}
              />
            );
          })}

          {/* Nodes */}
          {layout && filteredNodes.map((node, idx) => {
            const cx = getNodeX(node.id);
            const cy = getNodeY(idx);
            const color = getNodeColor(node.id);
            const isSel = selected === node.id;
            const isHov = hovered === node.id;

            const localBranches = node.branches.filter(b => !b.startsWith('remotes/origin/'));
            const remoteBranches = node.branches.filter(b => b.startsWith('remotes/origin/'));

            return (
              <g key={node.id}>
                {/* Tag label (above node) */}
                {node.tags.length > 0 && (
                  <g>
                    <rect
                      x={cx - node.tags[0].length * 4 - 4}
                      y={cy - NODE_SIZE / 2 - 13}
                      rx={3} ry={3}
                      width={node.tags[0].length * 8 + 8}
                      height={15}
                      fill="var(--yellow-bg)"
                      stroke="var(--yellow)"
                      strokeWidth={0.5}
                    />
                    <text x={cx} y={cy - NODE_SIZE / 2 - 2} fontSize={9} fontWeight={600}
                      fill="var(--yellow)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                      {node.tags[0]}
                    </text>
                  </g>
                )}

                {/* Circle */}
                <circle cx={cx} cy={cy}
                  r={isSel ? NODE_SIZE / 2 + 3 : isHov ? NODE_SIZE / 2 + 2 : NODE_SIZE / 2}
                  fill={isSel ? color : 'var(--bg-surface)'}
                  stroke={color}
                  strokeWidth={isSel ? 3 : 2}
                  style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                  onClick={() => {
                    setSelected(node.id);
                    onCommitSelect?.(node.id);
                  }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                />

                {/* Remote branch label (behind node, dimmer) */}
                {remoteBranches.length > 0 && (
                  <text x={cx + NODE_SIZE / 2 + 6} y={cy + 10}
                    fontSize={9} fill="var(--text-muted)" fontStyle="italic"
                    style={{ pointerEvents: 'none' }}>
                    {remoteBranches.map(b => b.slice(16)).join(', ')}
                  </text>
                )}

                {/* Local branch label */}
                {localBranches.length > 0 && (
                  <rect
                    x={cx + NODE_SIZE / 2 + 4}
                    y={cy - 7}
                    rx={3} ry={3}
                    width={Math.max(...localBranches.map(b => b.length * 6.5 + 12))}
                    height={14}
                    fill={color} fillOpacity={0.15}
                    stroke={color} strokeWidth={0.5}
                  />
                )}
                {localBranches.length > 0 && (
                  <text x={cx + NODE_SIZE / 2 + 8} y={cy + 4}
                    fontSize={10} fontWeight={600} fill={color}
                    style={{ pointerEvents: 'none' }}>
                    {localBranches.join(', ')}
                  </text>
                )}

                {/* Commit message */}
                {!localBranches.length && (
                  <text x={cx + NODE_SIZE / 2 + 8} y={cy + 4}
                    fontSize={10} fill="var(--text-secondary)"
                    style={{ pointerEvents: 'none' }}>
                    {node.message.split('\n')[0].slice(0, 60)}
                  </text>
                )}

                {/* Timestamp on the right */}
                <text x={svgWidth - PADDING.right - 4} y={cy + 3}
                  fontSize={9} fill="var(--text-muted)" textAnchor="end"
                  style={{ pointerEvents: 'none' }}>
                  {formatDate(node.timestamp)}
                </text>

                {/* Author */}
                <text x={svgWidth - PADDING.right - 130} y={cy + 3}
                  fontSize={9} fill="var(--text-muted)" textAnchor="end"
                  style={{ pointerEvents: 'none' }}
                  opacity={0.7}>
                  {node.author}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Info panel for selected commit */}
      {selected && layout && (
        <div style={{
          borderTop: '1px solid var(--border)', padding: '10px 14px',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          {(() => {
            const node = layout.nodeMap.get(selected);
            if (!node) return null;
            return (
              <div style={{ fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {node.message.split('\n')[0]}
                  </div>
                  <div style={{ display: 'flex', gap: 16, color: 'var(--text-muted)', fontSize: 11, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{node.id.slice(0, 12)}</span>
                    <span>👤 {node.author}</span>
                    <span>📅 {formatDate(node.timestamp)}</span>
                  </div>
                  {(node.branches.length > 0 || node.tags.length > 0) && (
                    <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {node.branches.map(b => (
                        <span key={b} style={{
                          padding: '1px 7px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                          background: 'var(--accent-glow)', color: 'var(--accent)',
                        }}>
                          {b.startsWith('remotes/origin/') ? b.slice(16) : b}
                        </span>
                      ))}
                      {node.tags.map(t => (
                        <span key={t} style={{
                          padding: '1px 7px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                          background: 'var(--yellow-bg)', color: 'var(--yellow)',
                        }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn-close" onClick={() => setSelected(null)} style={{ padding: '2px 8px', fontSize: 11, flexShrink: 0 }}>✕</button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
