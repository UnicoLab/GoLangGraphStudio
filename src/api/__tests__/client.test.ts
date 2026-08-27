/**
 * Contract tests for the GoLangGraph API client.
 *
 * The fixtures below are the payloads the Go server actually produces; they
 * were taken from the end-to-end suite in the GoLangGraph repository
 * (test/e2e/studio_compat_test.go), which drives a live server. A type
 * definition that merely compiles proves nothing about the wire format, so
 * these tests assert the client reads the real shapes.
 */

import { createApiClient, ApiError, extractOutputText, summariseToolCalls } from '../client';
import { vi } from 'vitest';
import { AgentConfig } from '../../types';

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;

/** Builds a fetch stub returning one JSON body. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}

let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

const client = () => createApiClient({ baseUrl: 'http://localhost:8080', apiKey: 'test-key' });

describe('request plumbing', () => {
  it('sends the API key the server expects', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'healthy' }));

    await client().health();

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers['X-API-Key']).toBe('test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('surfaces the server error field', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'graph not found', timestamp: '2024-01-01T00:00:00Z' }, 404),
    );

    await expect(client().getAgent('missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'graph not found',
    });
  });

  it('reports an unreachable server rather than throwing a raw network error', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));

    const error = await client().health().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toContain('connection refused');
  });

  it('rejects with the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    await expect(client().health()).rejects.toMatchObject({ status: 502 });
  });
});

describe('agents', () => {
  // The server returns full configurations; it previously returned bare ID
  // strings, which left every rendered field undefined.
  const agentConfig: AgentConfig = {
    id: 'studio-agent',
    name: 'Studio Agent',
    type: 'chat',
    model: 'fake-model',
    provider: 'fake',
    system_prompt: 'You are helpful.',
    temperature: 0.7,
    max_tokens: 1000,
    max_iterations: 10,
    tools: ['calculator'],
    enable_streaming: true,
    timeout: 30000000000,
    metadata: {},
  };

  it('reads agent configurations from the list endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ agents: [agentConfig] }));

    const agents = await client().listAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('Studio Agent');
    expect(agents[0].type).toBe('chat');
    expect(agents[0].tools).toEqual(['calculator']);
  });

  it('treats a missing agents field as an empty list', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(client().listAgents()).resolves.toEqual([]);
  });

  it('unwraps a single agent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ agent: agentConfig }));
    await expect(client().getAgent('studio-agent')).resolves.toMatchObject({ id: 'studio-agent' });
  });

  it('creates, updates, and deletes agents through the live CRUD routes', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ agent: agentConfig }, 201))
      .mockResolvedValueOnce(jsonResponse({ agent: { ...agentConfig, name: 'Updated Agent' } }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Agent deleted successfully' }));

    await expect(client().createAgent(agentConfig)).resolves.toMatchObject({ id: 'studio-agent' });
    await expect(client().updateAgent('studio-agent', agentConfig)).resolves.toMatchObject({ name: 'Updated Agent' });
    await expect(client().deleteAgent('studio-agent')).resolves.toMatchObject({ message: expect.any(String) });

    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'PUT', 'DELETE']);
  });
});

describe('executions', () => {
  // Snake_case, matching agent.AgentExecution's JSON tags. The types
  // previously declared Go's default PascalCase, so every field read as
  // undefined and the debug view showed a blank result for a successful run.
  const execution = {
    id: 'exec-1',
    timestamp: '2024-01-01T00:00:00Z',
    input: 'hello',
    output: 'hi there',
    structured_output: 'hi there',
    tool_calls: null,
    duration: 1500000,
    success: true,
    metadata: {},
    execution_path: ['chat'],
  };

  it('reads an execution in the shape the server sends', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ execution }));

    const result = await client().executeAgent('studio-agent', 'hello');
    expect(result.success).toBe(true);
    expect(result.output).toBe('hi there');
    expect(result.duration).toBe(1500000);
    expect(result.execution_path).toEqual(['chat']);
  });

  it('reads a failed execution and its reason', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        execution: { ...execution, success: false, error: 'model backend is offline' },
      }),
    );

    const result = await client().executeAgent('studio-agent', 'hello');
    expect(result.success).toBe(false);
    expect(result.error).toBe('model backend is offline');
  });

  it('reads history', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ history: [execution, execution] }));
    await expect(client().getAgentHistory('studio-agent')).resolves.toHaveLength(2);
  });

  it('treats a missing history field as an empty list', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(client().getAgentHistory('a')).resolves.toEqual([]);
  });
});

describe('tools and providers', () => {
  it('reads tool names', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tools: ['calculator', 'time'] }));
    await expect(client().listTools()).resolves.toEqual(['calculator', 'time']);
  });

  // Providers are described objects; the endpoint previously returned bare
  // names, which left ProviderInfo.name undefined.
  it('reads provider descriptions', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        providers: [{ name: 'ollama', type: 'ollama', endpoint: 'http://localhost:11434', model: 'gemma3:1b' }],
      }),
    );

    const providers = await client().listProviders();
    expect(providers[0].name).toBe('ollama');
    expect(providers[0].model).toBe('gemma3:1b');
  });
});

describe('graph topology', () => {
  // The server sends node.id/name/type and edge.from/to. The store maps these
  // directly, so a change here breaks the graph view.
  it('reads the topology the graph view renders', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        graph_id: 'studio-workflow',
        topology: {
          nodes: [
            { id: 'ingest', name: 'Ingest', type: 'node', is_start: true, is_end: false },
            { id: 'decide', name: 'Decide', type: 'node', is_start: false, is_end: false },
          ],
          edges: [
            { from: 'ingest', to: 'decide', conditional: false },
            { from: 'decide', to: 'long', conditional: true, route_key: 'long' },
          ],
        },
      }),
    );

    const topology = await client().getGraphTopology('studio-workflow');
    expect(topology.graph_id).toBe('studio-workflow');
    expect(topology.topology.nodes).toHaveLength(2);
    expect(topology.topology.edges).toHaveLength(2);

    const [firstNode] = topology.topology.nodes as Array<Record<string, unknown>>;
    expect(firstNode.id).toBe('ingest');
    expect(firstNode.name).toBe('Ingest');

    const conditional = (topology.topology.edges as Array<Record<string, unknown>>)[1];
    expect(conditional.from).toBe('decide');
    expect(conditional.to).toBe('long');
  });

  it('publishes and executes the safe multi-agent pipeline contract', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        pipeline: { id: 'review', name: 'Review', start_node: 'draft', end_nodes: ['review'], node_count: 2, edge_count: 1, running: false },
        topology: { nodes: [], edges: [] },
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        graph_id: 'review', status: 'completed', steps: [{ node_id: 'draft', step: 1, success: true, duration_ms: 2, attempts: 1 }], state: { input: 'done' },
      }));

    const pipeline = await client().createPipeline({ id: 'review', name: 'Review', nodes: [{ id: 'draft', agent_id: 'writer' }] });
    expect(pipeline.pipeline.node_count).toBe(2);
    await expect(client().executeGraph('review', 'hello')).resolves.toMatchObject({ status: 'completed' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/pipelines');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/v1/graphs/review/execute');
  });
});

describe('display helpers', () => {
  it('extracts text from the flat string output', () => {
    expect(extractOutputText('plain answer')).toBe('plain answer');
  });

  it('handles structured and empty output without throwing', () => {
    expect(extractOutputText(undefined)).toBe('');
    expect(extractOutputText(null)).toBe('');
    expect(typeof extractOutputText({ answer: 42 })).toBe('string');
  });

  it('summarises tool calls and tolerates none', () => {
    expect(summariseToolCalls([])).toEqual([]);
    const summary = summariseToolCalls([
      { id: '1', type: 'function', function: { name: 'calculator', arguments: '{"expression":"1+1"}' } },
    ]);
    expect(summary).toHaveLength(1);
    expect(String(summary[0])).toContain('calculator');
  });
});
