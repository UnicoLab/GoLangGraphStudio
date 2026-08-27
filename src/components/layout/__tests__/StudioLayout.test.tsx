/**
 * Integration tests for the studio shell: the layout, its view switching and
 * the thread sidebar.
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudioLayout } from '../StudioLayout';
import { Sidebar } from '../Sidebar';
import { useStudioStore } from '../../../store/useStudioStore';
import { agentFixture, executionFixture, resetStudioStore } from '../../../test-utils/studioTestUtils';

const state = () => useStudioStore.getState();

beforeEach(() => {
  resetStudioStore();
});

describe('StudioLayout', () => {
  it('renders the whole shell from a cold, empty store', () => {
    render(<StudioLayout />);

    expect(screen.getByText('GoLangGraph Studio')).toBeInTheDocument();
    expect(screen.getByText('Threads')).toBeInTheDocument();
    // `currentView` defaults to chat.
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });

  it('switches between the three views', async () => {
    const user = userEvent.setup();
    render(<StudioLayout />);

    await user.click(screen.getByRole('button', { name: 'Graph' }));
    expect(screen.getByText('No graph available')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Debug' }));
    expect(screen.getByText('No execution yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });

  it('switches views from the keyboard', async () => {
    const user = userEvent.setup();
    render(<StudioLayout />);

    await user.keyboard('{Control>}2{/Control}');
    await waitFor(() => expect(state().currentView).toBe('graph'));
    expect(screen.getByText('No graph available')).toBeInTheDocument();

    await user.keyboard('{Control>}3{/Control}');
    await waitFor(() => expect(state().currentView).toBe('debug'));
  });

  it('shows a populated debug view when an execution is on record', () => {
    useStudioStore.setState({
      currentView: 'debug',
      selectedAgent: agentFixture,
      lastExecution: executionFixture,
    });

    render(<StudioLayout />);

    expect(screen.getByText('hi there')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});

describe('Sidebar', () => {
  it('renders an empty thread list', () => {
    render(<Sidebar />);

    expect(screen.getByText('No threads yet')).toBeInTheDocument();
  });

  it('creates, previews and deletes threads', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: /New Thread/i }));
    expect(screen.getByText('Thread 1')).toBeInTheDocument();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();

    // Driven through the store rather than the UI: the sidebar has no way to
    // add a message, but it must re-render with the new preview when one lands.
    const threadId = state().selectedThread!.id;
    act(() => {
      state().addMessage(threadId, {
        id: 'm1',
        role: 'user',
        content: 'the last thing said',
        timestamp: new Date(),
      });
    });
    expect(await screen.findByText('the last thing said')).toBeInTheDocument();

    await user.click(screen.getByTitle('Delete thread'));
    expect(screen.getByText('No threads yet')).toBeInTheDocument();
    expect(state().selectedThread).toBeUndefined();
  });
});
