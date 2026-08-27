/**
 * Rendering tests for the execution graph.
 *
 * The graph is laid out by hand from node positions, so most of what can go
 * wrong here is arithmetic over data that is missing or empty.
 *
 * The edges are SVG <line> primitives: they carry no accessible role, no text
 * and no label, so there is no Testing Library query that can reach them and
 * the rendered container is the only way to assert on the drawn geometry.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { GraphView } from '../GraphView';
import { useStudioStore } from '../../../store/useStudioStore';
import { GraphEdge, GraphNode } from '../../../types';
import {
  agentFixture,
  emptyTopologyFixture,
  healthFixture,
  mockServer,
  resetStudioStore,
} from '../../../test-utils/studioTestUtils';

const nodes: GraphNode[] = [
  { id: 'input', label: 'Input', type: 'input', status: 'completed', position: { x: 80, y: 80 }, description: 'User message' },
  { id: 'agent', label: 'Studio Agent', type: 'llm', status: 'error', position: { x: 80, y: 210 } },
  { id: 'output', label: 'Output', type: 'output', status: 'idle', position: { x: 80, y: 340 } },
];

const edges: GraphEdge[] = [
  { id: 'input-agent', source: 'input', target: 'agent' },
  { id: 'agent-output', source: 'agent', target: 'output', label: 'respond' },
];

beforeEach(() => {
  resetStudioStore();
});

describe('with no graph', () => {
  it('renders an empty state instead of laying out zero nodes', () => {
    const { container } = render(<GraphView />);

    expect(screen.getByText('No graph available')).toBeInTheDocument();
    expect(screen.getByText(/Select an agent to visualise/i)).toBeInTheDocument();
    // The empty-state early return is what keeps the layout maths away from an
    // empty array: `Math.min(...[])` is `Infinity`, which would end up in the
    // canvas width/height as `-Infinity` and in every SVG coordinate.
    expect(container.querySelector('svg')).toBeNull();
  });

  it('names the agent whose topology came back empty', () => {
    useStudioStore.setState({ selectedAgent: agentFixture });

    render(<GraphView />);

    expect(screen.getByText('No topology was returned for "Studio Agent".')).toBeInTheDocument();
  });
});

describe('with a graph', () => {
  it('renders every node with its label, type and status', () => {
    useStudioStore.setState({ selectedAgent: agentFixture, graphNodes: nodes, graphEdges: edges });

    render(<GraphView />);

    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('User message')).toBeInTheDocument();
    // Twice: once as the legend's agent name, once as the LLM node's label.
    expect(screen.getAllByText('Studio Agent')).toHaveLength(2);

    // One status dot per node, titled with its state.
    expect(screen.getAllByTitle('Completed')).toHaveLength(1);
    expect(screen.getAllByTitle('Error')).toHaveLength(1);
    expect(screen.getAllByTitle('Idle')).toHaveLength(1);
  });

  it('draws one line per edge and labels the conditional ones', () => {
    useStudioStore.setState({ graphNodes: nodes, graphEdges: edges });

    const { container } = render(<GraphView />);

    expect(container.querySelectorAll('line')).toHaveLength(2);
    expect(screen.getByText('respond')).toBeInTheDocument();
  });

  it('skips an edge whose endpoints are not in the graph', () => {
    useStudioStore.setState({
      graphNodes: nodes,
      graphEdges: [...edges, { id: 'dangling', source: 'input', target: 'nowhere' }],
    });

    const { container } = render(<GraphView />);

    // The dangling edge is dropped rather than drawn to `undefined` coordinates.
    expect(container.querySelectorAll('line')).toHaveLength(2);
  });

  it('gives every node a finite position on the canvas', () => {
    useStudioStore.setState({ graphNodes: nodes, graphEdges: edges });

    const { container } = render(<GraphView />);

    container.querySelectorAll('line').forEach((line) => {
      ['x1', 'y1', 'x2', 'y2'].forEach((attr) => {
        expect(Number(line.getAttribute(attr))).not.toBeNaN();
      });
    });
  });

  it('renders the graph the store derived from a real connection', async () => {
    mockServer({
      '/api/v1/health': { body: healthFixture },
      '/api/v1/agents': { body: { agents: [agentFixture] } },
      '/api/v1/tools': { body: { tools: [] } },
      '/api/v1/providers': { body: { providers: [] } },
      '/api/v1/graphs/studio-agent/topology': { body: emptyTopologyFixture },
    });
    await useStudioStore.getState().connect();
    await waitFor(() => expect(useStudioStore.getState().graphNodes).toHaveLength(3));

    render(<GraphView />);

    // The chat agent's derived graph: Input → <agent name> → Output.
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getAllByText('Studio Agent').length).toBeGreaterThan(0);
    expect(screen.getByText('Output')).toBeInTheDocument();
  });
});
