import React from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { GraphNode, NodeStatus } from '../../types';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

const statusColor: Record<NodeStatus, string> = {
  idle: 'bg-gray-400',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-emerald-500',
  error: 'bg-red-500',
};

const statusLabel: Record<NodeStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  completed: 'Completed',
  error: 'Error',
};

const nodeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  input: ArrowDownIcon,
  output: ArrowUpIcon,
  llm: SparklesIcon,
  tool: WrenchScrewdriverIcon,
};

const Icon = ({ type }: { type: string }) => {
  const Cmp = nodeIcon[type] ?? CogIcon;
  return <Cmp className="w-4 h-4" />;
};

export const GraphView: React.FC = () => {
  const { graphNodes, graphEdges, currentGraphNode, selectedAgent, darkMode } = useStudioStore();

  if (graphNodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🕸️</div>
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>No graph available</h3>
          <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {selectedAgent ? `No topology was returned for "${selectedAgent.name}".` : 'Select an agent to visualise its execution graph.'}
          </p>
        </div>
      </div>
    );
  }

  const xs = graphNodes.map((n) => n.position.x);
  const ys = graphNodes.map((n) => n.position.y);
  const minX = Math.min(...xs) - 120;
  const maxX = Math.max(...xs) + 320;
  const minY = Math.min(...ys) - 60;
  const maxY = Math.max(...ys) + 60;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className={`flex items-center justify-between px-5 py-3 border-b ${darkMode ? 'border-gray-700/80' : 'border-gray-200'}`}>
        <div className="flex items-center gap-4">
          <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {selectedAgent?.name ?? 'Execution graph'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {(Object.keys(statusColor) as NodeStatus[]).map((s) => (
            <span key={s} className={`flex items-center gap-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${statusColor[s]}`} /> {statusLabel[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-6">
        <div className="relative mx-auto" style={{ width, height }}>
          <svg className="absolute inset-0" width={width} height={height} style={{ overflow: 'visible' }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={darkMode ? '#6b7280' : '#94a3b8'} />
              </marker>
            </defs>
            {graphEdges.map((edge) => {
              const source = graphNodes.find((n) => n.id === edge.source);
              const target = graphNodes.find((n) => n.id === edge.target);
              if (!source || !target) return null;
              const x1 = source.position.x + 120 - minX;
              const y1 = source.position.y + 30 - minY;
              const x2 = target.position.x + 120 - minX;
              const y2 = target.position.y - 30 - minY;
              return (
                <g key={edge.id}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={darkMode ? '#4b5563' : '#cbd5e1'}
                    strokeWidth={2}
                    markerEnd="url(#arrow)"
                  />
                  {edge.label && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 8}
                      textAnchor="middle"
                      className={darkMode ? 'fill-gray-500' : 'fill-gray-400'}
                      fontSize="10"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {graphNodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              active={currentGraphNode === node.id}
              darkMode={darkMode}
              style={{ left: node.position.x - minX, top: node.position.y - minY }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const NodeCard: React.FC<{
  node: GraphNode;
  active: boolean;
  darkMode: boolean;
  style: React.CSSProperties;
}> = ({ node, active, darkMode, style }) => (
  <div
    className={`absolute w-60 rounded-2xl border-2 p-3.5 transition-all duration-200 ${
      active
        ? darkMode ? 'border-blue-500 bg-blue-900/40 shadow-xl shadow-blue-500/20' : 'border-blue-400 bg-blue-50 shadow-xl shadow-blue-500/10'
        : darkMode ? 'border-gray-600 bg-gray-800 shadow-lg' : 'border-gray-200 bg-white shadow-lg'
    }`}
    style={style}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          darkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'
        }`}>
          <Icon type={node.type} />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{node.label}</div>
          <div className={`text-[11px] uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{node.type}</div>
        </div>
      </div>
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor[node.status]}`} title={statusLabel[node.status]} />
    </div>
    {node.description && (
      <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{node.description}</p>
    )}
  </div>
);
