import React from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { GraphNode, NodeStatus } from '../../types';

const statusColor: Record<NodeStatus, string> = {
  idle: 'bg-gray-400',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  error: 'bg-red-500',
};

export const GraphView: React.FC = () => {
  const { graphNodes, graphEdges, currentGraphNode, selectedAgent, darkMode } = useStudioStore();

  if (graphNodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🕸️</div>
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            No graph available
          </h3>
          <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {selectedAgent
              ? `No topology was returned for "${selectedAgent.name}".`
              : 'Select an agent to visualise its execution graph.'}
          </p>
        </div>
      </div>
    );
  }

  // Compute SVG viewport bounds from node positions.
  const xs = graphNodes.map((n) => n.position.x);
  const ys = graphNodes.map((n) => n.position.y);
  const minX = Math.min(...xs) - 120;
  const maxX = Math.max(...xs) + 320;
  const minY = Math.min(...ys) - 60;
  const maxY = Math.max(...ys) + 60;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg className="absolute inset-0" width={width} height={height} style={{ overflow: 'visible' }}>
          {graphEdges.map((edge) => {
            const source = graphNodes.find((n) => n.id === edge.source);
            const target = graphNodes.find((n) => n.id === edge.target);
            if (!source || !target) return null;
            const x1 = source.position.x + 120 - minX;
            const y1 = source.position.y + 28 - minY;
            const x2 = target.position.x + 120 - minX;
            const y2 = target.position.y - 28 - minY;
            return (
              <g key={edge.id}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={darkMode ? '#4b5563' : '#cbd5e1'}
                  strokeWidth={2}
                />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6}
                  textAnchor="middle"
                  className={darkMode ? 'fill-gray-500' : 'fill-gray-400'}
                  fontSize="11"
                >
                  {edge.label ?? ''}
                </text>
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
  );
};

const NodeCard: React.FC<{
  node: GraphNode;
  active: boolean;
  darkMode: boolean;
  style: React.CSSProperties;
}> = ({ node, active, darkMode, style }) => (
  <div
    className={`absolute w-60 rounded-xl border-2 p-3 transition-all ${
      active
        ? darkMode ? 'border-blue-500 bg-blue-900/40 shadow-lg' : 'border-blue-400 bg-blue-50 shadow-lg'
        : darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'
    }`}
    style={style}
  >
    <div className="flex items-center space-x-2">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor[node.status]}`} />
      <div className="min-w-0">
        <div className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {node.label}
        </div>
        <div className={`text-xs uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {node.type}
        </div>
      </div>
    </div>
    {node.description && (
      <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{node.description}</p>
    )}
  </div>
);
