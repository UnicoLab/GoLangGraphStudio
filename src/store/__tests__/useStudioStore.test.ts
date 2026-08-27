/**
 * Behavioural tests for the studio store.
 *
 * The store is the only thing between the Go server's JSON and everything the
 * user sees, so these tests drive the real store through the real API client
 * with only `fetch` stubbed, and assert on the resulting state — the messages
 * in the thread, the logs, the node statuses — rather than on mock calls.
 */

import { waitFor } from '@testing-library/react';
import { useStudioStore } from '../useStudioStore';
import {
  RouteHandler,
  agentFixture,
  deferred,
  emptyTopologyFixture,
  executionFixture,
  healthFixture,
  mockServer,
  reactAgentFixture,
  resetStudioStore,
} from '../../test-utils/studioTestUtils';

const state = () => useStudioStore.getState();

/** Routes a healthy single-agent server answers, before per-test overrides. */
const baseRoutes = (): Record<string, RouteHandler> => ({
  '/api/v1/health': { body: healthFixture },
  '/api/v1/whoami': { body: { principal: { name: 'local-development', role: 'admin' }, authentication_required: false } },
  '/api/v1/agents': { body: { agents: [agentFixture] } },
  '/api/v1/tools': { body: { tools: ['calculator', 'time'] } },
  '/api/v1/providers': {
    body: { providers: [{ name: 'ollama', type: 'ollama', endpoint: 'http://localhost:11434', model: 'gemma3:1b' }] },
  },
  '/api/v1/graphs/studio-agent/topology': { body: emptyTopologyFixture },
  '/api/v1/graphs/react-agent/topology': { body: { graph_id: 'react-agent', topology: { nodes: [], edges: [] } } },
});

/** Connects to a stubbed server and waits for the initial graph to settle. */
async function connectStudio(overrides: Record<string, RouteHandler> = {}) {
  mockServer({ ...baseRoutes(), ...overrides });
  await state().connect();
  await waitFor(() => expect(state().graphNodes.length).toBeGreaterThan(0));
}

beforeEach(() => {
  resetStudioStore();
});

describe('connecting', () => {
  it('loads the catalogue and selects the first agent', async () => {
    await connectStudio();

    expect(state().isConnected).toBe(true);
    expect(state().isConnecting).toBe(false);
    expect(state().connectionStatus).toBe('connected');
    expect(state().error).toBeUndefined();
    expect(state().agents.map((a) => a.name)).toEqual(['Studio Agent']);
    expect(state().tools).toEqual(['calculator', 'time']);
    expect(state().providers.map((p) => p.name)).toEqual(['ollama']);
    expect(state().principal).toMatchObject({ role: 'admin' });
    expect(state().selectedAgent?.id).toBe('studio-agent');
  });

  it('surfaces a connection failure to the user instead of hanging', async () => {
    mockServer({ '/api/v1/health': { networkError: 'connection refused' } });

    await state().connect();

    expect(state().isConnected).toBe(false);
    expect(state().connectionStatus).toBe('failed');
    // The loading flag must be cleared on the error path too, or the setup
    // screen's Connect button stays disabled forever.
    expect(state().isConnecting).toBe(false);
    expect(state().error).toContain('connection refused');
  });

  it('reports the server error body when the health check fails', async () => {
    mockServer({ '/api/v1/health': { status: 503, body: { error: 'server is starting up' } } });

    await state().connect();

    expect(state().connectionStatus).toBe('failed');
    expect(state().error).toBe('server is starting up');
  });

  // Regression: the three catalogue calls were `.catch(() => [])`, so a server
  // whose /agents endpoint was broken looked exactly like a server with no
  // agents configured — "Connected", empty list, not a word about the failure.
  it('reports a catalogue endpoint that fails even though the server is up', async () => {
    mockServer({
      ...baseRoutes(),
      '/api/v1/agents': { status: 500, body: { error: 'agent registry unavailable' } },
    });

    await state().connect();

    expect(state().isConnected).toBe(true);
    expect(state().agents).toEqual([]);
    expect(state().error).toContain('agents');
    expect(state().error).toContain('agent registry unavailable');
    expect(state().executionLogs.map((l) => `${l.level}: ${l.message}`)).toContainEqual(
      expect.stringContaining('agent registry unavailable'),
    );
    // Tools and providers still loaded, so a single broken endpoint does not
    // cost us the rest of the catalogue.
    expect(state().tools).toEqual(['calculator', 'time']);
  });

  it('counts retries and explains itself once the budget is spent', async () => {
    mockServer({ '/api/v1/health': { networkError: 'connection refused' } });

    await state().attemptReconnection();
    expect(state().retryAttempts).toBe(1);
    expect(state().connectionStatus).toBe('failed');

    useStudioStore.setState({ retryAttempts: state().maxRetryAttempts });
    await state().attemptReconnection();

    // Regression: this path used to set `connectionStatus: 'failed'` and
    // return, so the Retry button did nothing at all with no explanation.
    expect(state().error).toContain('Gave up after 3 connection attempts');
  });

  it('surfaces a failed agent reload', async () => {
    await connectStudio();
    mockServer({ ...baseRoutes(), '/api/v1/agents': { status: 500, body: { error: 'registry exploded' } } });

    await state().loadAgents();

    expect(state().error).toBe('registry exploded');
  });

  // Regression: disconnect left `lastExecution` and `currentGraphNode` behind,
  // so the debug view kept describing a run whose logs had just been wiped and
  // the graph kept a highlight pointing at a node that no longer existed.
  it('clears every trace of the old server on disconnect', async () => {
    await connectStudio({ '/api/v1/agents/studio-agent/execute': { body: { execution: executionFixture } } });
    await state().sendMessage('hello');
    expect(state().lastExecution).toBeDefined();

    state().disconnect();

    expect(state().isConnected).toBe(false);
    expect(state().connectionStatus).toBe('disconnected');
    expect(state().lastExecution).toBeUndefined();
    expect(state().currentGraphNode).toBeUndefined();
    expect(state().isExecuting).toBe(false);
    expect(state().retryAttempts).toBe(0);
    expect(state().error).toBeUndefined();
    expect(state().graphNodes).toEqual([]);
    expect(state().selectedAgent).toBeUndefined();
  });
});

describe('graph data', () => {
  // The `/graphs/{id}/topology` endpoint is a placeholder that answers with an
  // empty graph. The store is supposed to fall back to a graph derived from
  // the agent's type; this pins that it actually does.
  it('falls back to the type-derived graph when the topology is empty', async () => {
    await connectStudio();

    expect(state().graphNodes.map((n) => n.label)).toEqual(['Input', 'Studio Agent', 'Output']);
    expect(state().graphNodes.map((n) => n.status)).toEqual(['idle', 'idle', 'idle']);
    expect(state().graphEdges.map((e) => `${e.source}->${e.target}`)).toEqual([
      'input->agent',
      'agent->output',
    ]);
  });

  it('derives a different graph for a react agent', async () => {
    await connectStudio({ '/api/v1/agents': { body: { agents: [reactAgentFixture] } } });

    expect(state().graphNodes.map((n) => n.label)).toEqual(['Input', 'Reasoning', 'Tools', 'Response']);
    expect(state().graphEdges).toHaveLength(4);
  });

  it('falls back when the topology request fails outright', async () => {
    await connectStudio({
      '/api/v1/graphs/studio-agent/topology': { status: 500, body: { error: 'not implemented' } },
    });

    expect(state().graphNodes.map((n) => n.id)).toEqual(['input', 'agent', 'output']);
  });

  it('prefers the real topology when the server returns one', async () => {
    await connectStudio({
      '/api/v1/graphs/studio-agent/topology': {
        body: {
          graph_id: 'studio-agent',
          topology: {
            nodes: [
              { id: 'ingest', name: 'Ingest', type: 'node', is_start: true },
              { id: 'decide', name: 'Decide', type: 'node' },
            ],
            edges: [{ from: 'ingest', to: 'decide', conditional: false }],
          },
        },
      },
    });

    expect(state().graphNodes.map((n) => n.id)).toEqual(['ingest', 'decide']);
    expect(state().graphNodes.map((n) => n.label)).toEqual(['Ingest', 'Decide']);
    // The server names edge endpoints `from`/`to`, not `source`/`target`.
    expect(state().graphEdges).toEqual([
      { id: 'edge-0', source: 'ingest', target: 'decide' },
    ]);
  });

  // Regression: two topology requests raced and whichever came back last won,
  // so picking agent A then B could leave B selected while A's graph was on
  // screen.
  it('ignores a slow topology response for an agent that is no longer selected', async () => {
    await connectStudio({ '/api/v1/agents': { body: { agents: [agentFixture, reactAgentFixture] } } });

    const slowStudio = deferred<{ body: unknown }>();
    mockServer({
      ...baseRoutes(),
      '/api/v1/graphs/studio-agent/topology': () => slowStudio.promise,
    });

    state().selectAgent(agentFixture);
    state().selectAgent(reactAgentFixture);

    // The react agent has no server topology, so it settles on its derived graph.
    await waitFor(() => expect(state().graphNodes).toHaveLength(4));
    expect(state().selectedAgent?.id).toBe('react-agent');

    slowStudio.resolve({
      body: {
        graph_id: 'studio-agent',
        topology: { nodes: [{ id: 'stale', name: 'Stale', type: 'node' }], edges: [] },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state().graphNodes.map((n) => n.id)).toEqual(['input', 'reasoning', 'tools', 'response']);
    expect(state().selectedAgent?.id).toBe('react-agent');
  });

  // Regression: an unknown agent id returned early, leaving the previous
  // agent's graph on screen and silently attributing it to the new selection.
  it('clears the graph rather than showing a stale one for an unknown agent', async () => {
    await connectStudio();
    expect(state().graphNodes).toHaveLength(3);

    await state().fetchGraphData('an-agent-that-does-not-exist');

    expect(state().graphNodes).toEqual([]);
    expect(state().graphEdges).toEqual([]);
  });
});

describe('executing an agent', () => {
  it('records the answer, the execution and a log line', async () => {
    await connectStudio({ '/api/v1/agents/studio-agent/execute': { body: { execution: executionFixture } } });

    await state().sendMessage('hello');

    const messages = state().selectedThread?.messages ?? [];
    expect(messages.map((m) => `${m.role}: ${m.content}`)).toEqual([
      'user: hello',
      'assistant: hi there',
    ]);
    expect(state().lastExecution?.output).toBe('hi there');
    expect(state().lastExecution?.success).toBe(true);
    expect(state().isExecuting).toBe(false);
    expect(state().error).toBeUndefined();

    // 1.5ms in nanoseconds, formatted for the log line.
    expect(state().executionLogs.map((l) => l.message)).toContainEqual(
      expect.stringContaining('Execution completed in 1.5ms'),
    );
    expect(messages[1].metadata).toMatchObject({ status: 'completed', duration_ns: 1500000 });
  });

  it('creates a thread when none is selected yet', async () => {
    await connectStudio({ '/api/v1/agents/studio-agent/execute': { body: { execution: executionFixture } } });
    expect(state().selectedThread).toBeUndefined();

    await state().sendMessage('hello');

    expect(state().threads).toHaveLength(1);
    expect(state().threads[0].messages).toHaveLength(2);
  });

  it('refuses to run without an agent and says so', async () => {
    await state().sendMessage('hello');

    expect(state().error).toBe('No agent selected');
    expect(state().threads).toEqual([]);
  });

  it('logs each tool call the agent made', async () => {
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': {
        body: {
          execution: {
            ...executionFixture,
            tool_calls: [
              { id: '1', type: 'function', function: { name: 'calculator', arguments: '{"expression":"1+1"}' } },
            ],
          },
        },
      },
    });

    await state().sendMessage('what is 1+1?');

    expect(state().executionLogs.filter((l) => l.level === 'debug').map((l) => l.message)).toEqual([
      'Tool call: calculator({"expression":"1+1"})',
    ]);
  });

  // Regression: `execution.error` was never read. A failed run logged only
  // "failed", and because a failed run usually has no output the assistant
  // bubble said "No output returned." — the reason never reached the user.
  it('surfaces the reason a failed execution failed', async () => {
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': {
        body: {
          execution: {
            ...executionFixture,
            success: false,
            output: '',
            error: 'model backend is offline',
          },
        },
      },
    });

    await state().sendMessage('hello');

    const messages = state().selectedThread?.messages ?? [];
    expect(messages[1].content).toContain('model backend is offline');
    expect(messages[1].metadata).toMatchObject({ status: 'failed', error: 'model backend is offline' });
    expect(state().error).toBe('model backend is offline');
    expect(state().executionLogs.map((l) => `${l.level}|${l.message}`)).toContainEqual(
      expect.stringContaining('error|Execution failed in 1.5ms'),
    );
    expect(state().executionLogs.map((l) => l.message)).toContainEqual(
      expect.stringContaining('model backend is offline'),
    );
  });

  it('still says something useful when a failure carries no reason', async () => {
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': {
        body: { execution: { ...executionFixture, success: false, output: '' } },
      },
    });

    await state().sendMessage('hello');

    const messages = state().selectedThread?.messages ?? [];
    expect(messages[1].content).toContain('Execution failed');
    expect(state().error).toBe('The execution failed without a reported reason.');
  });

  // Regression: every node was marked `completed` unconditionally, so a failed
  // run painted the whole graph green. The `error` status existed in the type
  // but nothing ever produced it.
  it('marks the graph as failed, not completed, when the run fails', async () => {
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': {
        body: { execution: { ...executionFixture, success: false, error: 'boom' } },
      },
    });

    await state().sendMessage('hello');

    expect(state().graphNodes.map((n) => n.status)).toEqual(['error', 'error', 'error']);
  });

  it('marks the graph as completed when the run succeeds', async () => {
    await connectStudio({ '/api/v1/agents/studio-agent/execute': { body: { execution: executionFixture } } });

    await state().sendMessage('hello');

    expect(state().graphNodes.map((n) => n.status)).toEqual(['completed', 'completed', 'completed']);
    // Regression: `currentGraphNode` was assigned and then immediately wiped
    // by the `finally` block, so the highlight showing where the run ended was
    // dead code and the graph never highlighted anything after a run.
    expect(state().currentGraphNode).toBe('output');
  });

  it('follows the server execution path when the graph ids line up', async () => {
    await connectStudio({
      '/api/v1/graphs/studio-agent/topology': {
        body: {
          graph_id: 'studio-agent',
          topology: {
            nodes: [
              { id: 'ingest', name: 'Ingest', type: 'node' },
              { id: 'decide', name: 'Decide', type: 'node' },
              { id: 'finish', name: 'Finish', type: 'node' },
            ],
            edges: [
              { from: 'ingest', to: 'decide' },
              { from: 'decide', to: 'finish' },
            ],
          },
        },
      },
      '/api/v1/agents/studio-agent/execute': {
        body: { execution: { ...executionFixture, execution_path: ['ingest', 'decide'] } },
      },
    });

    await state().sendMessage('hello');

    // `finish` never ran, so it must not be reported as completed.
    expect(state().graphNodes.map((n) => `${n.id}:${n.status}`)).toEqual([
      'ingest:completed',
      'decide:completed',
      'finish:idle',
    ]);
    expect(state().currentGraphNode).toBe('decide');
  });

  it('puts a transport failure in the thread and clears the running flag', async () => {
    await connectStudio({
      '/api/v1/agents/studio-agent/execute': { networkError: 'socket hang up' },
    });

    await state().sendMessage('hello');

    const messages = state().selectedThread?.messages ?? [];
    expect(messages[1].content).toContain('socket hang up');
    expect(state().error).toContain('socket hang up');
    expect(state().isExecuting).toBe(false);
    expect(state().currentGraphNode).toBeUndefined();
  });

  // Regression: Stop only flipped `isExecuting`. The request kept running and
  // its answer was appended to the thread seconds after the user stopped it.
  it('drops the result of an execution the user stopped', async () => {
    const slowRun = deferred<{ body: unknown }>();
    await connectStudio({ '/api/v1/agents/studio-agent/execute': () => slowRun.promise });

    const pending = state().sendMessage('hello');
    expect(state().isExecuting).toBe(true);

    state().stopExecution();
    expect(state().isExecuting).toBe(false);

    slowRun.resolve({ body: { execution: executionFixture } });
    await pending;

    expect(state().selectedThread?.messages.map((m) => m.role)).toEqual(['user']);
    expect(state().lastExecution).toBeUndefined();
    expect(state().executionLogs.map((l) => l.message)).toContainEqual(
      expect.stringContaining('Discarded the result of a stopped execution.'),
    );
  });

  it('clears a previous error when a new run starts', async () => {
    await connectStudio({ '/api/v1/agents/studio-agent/execute': { body: { execution: executionFixture } } });
    useStudioStore.setState({ error: 'a stale failure from the last run' });

    await state().sendMessage('hello');

    expect(state().error).toBeUndefined();
  });
});

describe('threads', () => {
  it('keeps the selected thread in step with the thread list', () => {
    state().createThread();
    const threadId = state().selectedThread!.id;

    state().addMessage(threadId, {
      id: 'm1',
      role: 'user',
      content: 'hello',
      timestamp: new Date(),
    });

    expect(state().selectedThread?.messages).toHaveLength(1);
    expect(state().threads[0].messages).toHaveLength(1);
  });

  it('deselects a thread that is deleted', () => {
    state().createThread();
    const threadId = state().selectedThread!.id;

    state().deleteThread(threadId);

    expect(state().threads).toEqual([]);
    expect(state().selectedThread).toBeUndefined();
  });
});
