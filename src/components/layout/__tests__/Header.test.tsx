/**
 * Rendering tests for the header: the agent picker and the connection pill.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../Header';
import { useStudioStore } from '../../../store/useStudioStore';
import { AgentConfig } from '../../../types';
import {
  agentFixture,
  emptyTopologyFixture,
  healthFixture,
  mockServer,
  reactAgentFixture,
  resetStudioStore,
} from '../../../test-utils/studioTestUtils';

const state = () => useStudioStore.getState();

beforeEach(() => {
  resetStudioStore();
});

it('renders with no agents and no connection', () => {
  render(<Header />);

  expect(screen.getByText('GoLangGraph Studio')).toBeInTheDocument();
  expect(screen.getByText('Select agent')).toBeInTheDocument();
  expect(screen.getByText('Disconnected')).toBeInTheDocument();
});

it('shows the selected agent and its type', () => {
  useStudioStore.setState({ selectedAgent: agentFixture, connectionStatus: 'connected', isConnected: true });

  render(<Header />);

  expect(screen.getByText('Studio Agent')).toBeInTheDocument();
  expect(screen.getByText('chat')).toBeInTheDocument();
  expect(screen.getByText('Connected')).toBeInTheDocument();
});

it('lists the agents and selects the one that is clicked', async () => {
  const user = userEvent.setup();
  mockServer({
    '/api/v1/graphs/react-agent/topology': { body: { graph_id: 'react-agent', topology: { nodes: [], edges: [] } } },
    '/api/v1/graphs/studio-agent/topology': { body: emptyTopologyFixture },
    '/api/v1/health': { body: healthFixture },
  });
  useStudioStore.setState({ agents: [agentFixture, reactAgentFixture], selectedAgent: agentFixture });

  render(<Header />);
  await user.click(screen.getByText('Studio Agent'));

  // Both agents are listed with their provider/model line.
  expect(screen.getAllByText('fake/fake-model')).toHaveLength(2);
  await user.click(screen.getByText('React Agent'));

  expect(state().selectedAgent?.id).toBe('react-agent');
  // Selecting an agent rebuilds its graph, which for a react agent is the
  // four-node reasoning loop.
  await waitFor(() => expect(state().graphNodes.map((n) => n.id)).toEqual(['input', 'reasoning', 'tools', 'response']));
});

it('says when the server has no agents', async () => {
  const user = userEvent.setup();
  useStudioStore.setState({ isConnected: true, connectionStatus: 'connected' });

  render(<Header />);
  await user.click(screen.getByText('Select agent'));

  expect(screen.getByText('No agents found on server.')).toBeInTheDocument();
});

// Regression: `AgentConfig.type` is whatever string the Go server put in the
// config, and the style lookup indexed a three-key map directly. An agent of
// any other type rendered `class="… undefined"`.
it('renders an agent whose type the studio does not know about', () => {
  const exotic = { ...agentFixture, type: 'multi-agent' } as unknown as AgentConfig;
  useStudioStore.setState({ selectedAgent: exotic });

  render(<Header />);

  const badge = screen.getByText('multi-agent');
  expect(badge).toBeInTheDocument();
  expect(badge.className).not.toContain('undefined');
});

it('offers a retry while the connection has failed', async () => {
  const user = userEvent.setup();
  mockServer({ '/api/v1/health': { networkError: 'connection refused' } });
  useStudioStore.setState({ connectionStatus: 'failed' });

  render(<Header />);
  await user.click(screen.getByRole('button', { name: 'Retry' }));

  await waitFor(() => expect(state().retryAttempts).toBe(1));
  expect(state().error).toContain('connection refused');
});
