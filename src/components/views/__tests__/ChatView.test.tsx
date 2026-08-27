/**
 * Rendering and interaction tests for the chat view.
 *
 * The send path goes through the real store and the real API client, so these
 * assert on what ends up on screen after a round trip rather than on whether
 * `sendMessage` was called.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatView } from '../ChatView';
import { useStudioStore } from '../../../store/useStudioStore';
import { Message } from '../../../types';
import {
  RouteHandler,
  agentFixture,
  emptyTopologyFixture,
  executionFixture,
  healthFixture,
  mockServer,
  resetStudioStore,
} from '../../../test-utils/studioTestUtils';

const state = () => useStudioStore.getState();

async function connectStudio(overrides: Record<string, RouteHandler> = {}) {
  mockServer({
    '/api/v1/health': { body: healthFixture },
    '/api/v1/agents': { body: { agents: [agentFixture] } },
    '/api/v1/tools': { body: { tools: [] } },
    '/api/v1/providers': { body: { providers: [] } },
    '/api/v1/graphs/studio-agent/topology': { body: emptyTopologyFixture },
    ...overrides,
  });
  await state().connect();
  await waitFor(() => expect(state().selectedAgent).toBeDefined());
}

const message = (role: Message['role'], content: string): Message => ({
  id: `${role}-${content}`,
  role,
  content,
  timestamp: new Date('2024-01-01T00:00:00Z'),
});

beforeEach(() => {
  resetStudioStore();
});

describe('empty state', () => {
  it('renders without an agent or a thread', () => {
    render(<ChatView />);

    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select an agent to begin')).toBeDisabled();
  });

  it('describes the selected agent once one is chosen', () => {
    useStudioStore.setState({ selectedAgent: agentFixture });

    render(<ChatView />);

    expect(screen.getByText('Chat with Studio Agent')).toBeInTheDocument();
    expect(screen.getByText('chat agent · fake/fake-model')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Message Studio Agent…')).toBeEnabled();
  });
});

describe('with messages', () => {
  it('renders the conversation, markdown and all', () => {
    useStudioStore.setState({
      selectedAgent: agentFixture,
      selectedThread: {
        id: 't1',
        name: 'Thread 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [message('user', 'what is 1+1?'), message('assistant', 'It is **2**.')],
      },
    });

    render(<ChatView />);

    expect(screen.getByText('what is 1+1?')).toBeInTheDocument();
    // The assistant bubble goes through react-markdown, so the bold run is a
    // real <strong> in the DOM rather than literal asterisks.
    expect(screen.getByText('2').tagName).toBe('STRONG');
  });

  it('shows the typing indicator while an execution is running', () => {
    useStudioStore.setState({ selectedAgent: agentFixture, isExecuting: true });

    render(<ChatView />);

    expect(screen.getByText('Studio Agent is thinking…')).toBeInTheDocument();
    expect(screen.getByTitle('Stop')).toBeInTheDocument();
  });
});

describe('sending a message', () => {
  it('puts the agent answer on screen', async () => {
    const user = userEvent.setup();
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': { body: { execution: executionFixture } },
    });

    render(<ChatView />);
    await user.type(screen.getByPlaceholderText('Message Studio Agent…'), 'hello');
    await user.click(screen.getByTitle('Send'));

    expect(await screen.findByText('hello')).toBeInTheDocument();
    expect(await screen.findByText('hi there')).toBeInTheDocument();
  });

  // Regression: the reason a run failed never reached the user. The server
  // sends it in `execution.error`, but the bubble said "No output returned."
  it('shows the reason a failed run failed instead of "No output returned."', async () => {
    const user = userEvent.setup();
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': {
        body: {
          execution: { ...executionFixture, success: false, output: '', error: 'model backend is offline' },
        },
      },
    });

    render(<ChatView />);
    await user.type(screen.getByPlaceholderText('Message Studio Agent…'), 'hello');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/model backend is offline/)).toBeInTheDocument();
    expect(screen.queryByText('No output returned.')).toBeNull();
  });

  it('reports an unreachable server in the thread', async () => {
    const user = userEvent.setup();
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': { networkError: 'socket hang up' },
    });

    render(<ChatView />);
    await user.type(screen.getByPlaceholderText('Message Studio Agent…'), 'hello');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/socket hang up/)).toBeInTheDocument();
  });

  it('clears the composer and keeps Send disabled while it is empty', async () => {
    const user = userEvent.setup();
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': { body: { execution: executionFixture } },
    });

    render(<ChatView />);
    const composer = screen.getByPlaceholderText('Message Studio Agent…');
    expect(screen.getByTitle('Send')).toBeDisabled();

    await user.type(composer, 'hello');
    expect(screen.getByTitle('Send')).toBeEnabled();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(composer).toHaveValue(''));
  });
});
