/**
 * Rendering tests for the debug view.
 *
 * This is the panel the studio exists for, so the tests care most about it
 * telling the truth: a successful run must show its output, and a failed run
 * must show why it failed.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DebugView } from '../DebugView';
import { useStudioStore } from '../../../store/useStudioStore';
import {
  agentFixture,
  emptyTopologyFixture,
  executionFixture,
  healthFixture,
  mockServer,
  resetStudioStore,
} from '../../../test-utils/studioTestUtils';

const state = () => useStudioStore.getState();

/** Connects and runs one agent execution, so the view sees real store output. */
async function runExecution(execution: Record<string, unknown>) {
  mockServer({
    '/api/v1/health': { body: healthFixture },
    '/api/v1/agents': { body: { agents: [agentFixture] } },
    '/api/v1/tools': { body: { tools: [] } },
    '/api/v1/providers': { body: { providers: [] } },
    '/api/v1/graphs/studio-agent/topology': { body: emptyTopologyFixture },
    '/api/v1/agents/studio-agent/execute': { body: { execution } },
  });
  await state().connect();
  await waitFor(() => expect(state().graphNodes.length).toBeGreaterThan(0));
  await state().sendMessage('hello');
}

beforeEach(() => {
  resetStudioStore();
});

it('renders an empty state before anything has run', () => {
  render(<DebugView />);

  expect(screen.getByText('No execution yet.')).toBeInTheDocument();
  expect(screen.getByText(/No logs\./)).toBeInTheDocument();
});

it('shows the output, duration and agent of a successful run', async () => {
  await runExecution({ ...executionFixture });

  render(<DebugView />);

  expect(screen.getByText('Completed')).toBeInTheDocument();
  // The execution's output — the whole point of the panel, and blank for every
  // run before the snake_case field names were fixed.
  expect(screen.getByText('hi there')).toBeInTheDocument();
  // 1_500_000ns formatted from the `duration` the server sends.
  expect(screen.getByText('1.5ms')).toBeInTheDocument();
  expect(screen.getByText('Studio Agent')).toBeInTheDocument();
  expect(screen.getByText(/Execution completed in 1\.5ms/)).toBeInTheDocument();
});

// Regression: a failed run rendered the word "Failed", an empty output block
// and nothing else. `AgentExecution.error` holds the reason and no component
// read it, so the debugging console told you nothing about the failure.
it('shows why a failed run failed', async () => {
  await runExecution({ ...executionFixture, success: false, output: '', error: 'model backend is offline' });

  render(<DebugView />);

  expect(screen.getByText('Failed')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('model backend is offline');
});

it('says so plainly when a failure carries no reason', async () => {
  await runExecution({ ...executionFixture, success: false, output: '' });

  render(<DebugView />);

  expect(screen.getByRole('alert')).toHaveTextContent('The server reported a failure without a reason.');
});

it('does not show a failure banner for a successful run', async () => {
  await runExecution({ ...executionFixture });

  render(<DebugView />);

  expect(screen.queryByRole('alert')).toBeNull();
});

it('lists the tool calls the agent made', async () => {
  await runExecution({
    ...executionFixture,
    tool_calls: [
      { id: '1', type: 'function', function: { name: 'calculator', arguments: '{"expression":"1+1"}' } },
    ],
  });

  render(<DebugView />);

  expect(screen.getByText('Tool Calls')).toBeInTheDocument();
  expect(screen.getAllByText('calculator({"expression":"1+1"})').length).toBeGreaterThan(0);
});

it('filters the log by level', async () => {
  const user = userEvent.setup();
  await runExecution({
    ...executionFixture,
    tool_calls: [{ id: '1', type: 'function', function: { name: 'calculator', arguments: '{}' } }],
  });

  render(<DebugView />);
  expect(screen.getByText(/Executing agent "Studio Agent"/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'debug' }));

  // Only the tool-call line survives the filter; the info lines are gone.
  expect(screen.queryByText(/Executing agent "Studio Agent"/)).toBeNull();
  expect(screen.getByText('Tool call: calculator({})')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'warn' }));
  expect(screen.getByText('No logs at warn level.')).toBeInTheDocument();
});

it('renders an execution whose output is a structured object', async () => {
  // The server's legacy flat `output` is a string, but a structured payload
  // must not blow up the panel either.
  useStudioStore.setState({
    lastExecution: { ...executionFixture, output: { answer: 42 } as unknown as string },
  });

  render(<DebugView />);

  expect(screen.getByText(/"answer": 42/)).toBeInTheDocument();
});
