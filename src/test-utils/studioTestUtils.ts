/**
 * Shared harness for the studio tests.
 *
 * The tests drive the real store through the real `ApiClient` with only
 * `fetch` replaced, so the code under test is exactly what the app runs and
 * the JSON it reads is exactly what the Go server sends. Nothing here asserts
 * that a mock was called — the stubs stand in for the network and nothing
 * more.
 */
import { AgentConfig, AgentExecution } from '../types';
import { useStudioStore } from '../store/useStudioStore';

/**
 * The pristine store state, captured at import time before any test has had a
 * chance to mutate it. Zustand replaces the state object on every `set`, so
 * this snapshot keeps its original values.
 */
const pristineState = useStudioStore.getState();

/** Restores the store (and the module-private API client) between tests. */
export function resetStudioStore(): void {
  // `disconnect` is what clears the store's private client reference and
  // invalidates in-flight requests; `setState(…, true)` then replaces every
  // remaining field with its initial value.
  pristineState.disconnect();
  useStudioStore.setState(pristineState, true);
}

export interface RouteResult {
  status?: number;
  body?: unknown;
  /** Simulates an unreachable server (fetch itself rejecting). */
  networkError?: string;
}

export type RouteHandler = RouteResult | ((init?: RequestInit) => RouteResult | Promise<RouteResult>);

/**
 * Installs a `fetch` stub that answers by request path, e.g.
 * `{ '/api/v1/health': { body: { status: 'healthy' } } }`.
 *
 * A handler may be a function returning a promise, which lets a test hold a
 * response open and control the order in which concurrent requests resolve.
 */
export function mockServer(routes: Record<string, RouteHandler>): jest.Mock {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const handler = routes[path];
    if (!handler) {
      throw new Error(`No stubbed route for ${path} — add it to mockServer({…})`);
    }

    const result = typeof handler === 'function' ? await handler(init) : handler;
    if (result.networkError) throw new TypeError(result.networkError);

    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: async () => result.body,
    } as Response;
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** A promise whose settlement the test controls, for ordering races. */
export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Fixtures
//
// These mirror the payloads in src/api/__tests__/client.test.ts, which were
// taken from the GoLangGraph end-to-end suite driving a live server. They are
// snake_case because the Go structs tag every field — the studio's types once
// claimed Go's default PascalCase, which made every read undefined.
// ---------------------------------------------------------------------------

export const agentFixture: AgentConfig = {
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

export const reactAgentFixture: AgentConfig = {
  ...agentFixture,
  id: 'react-agent',
  name: 'React Agent',
  type: 'react',
};

export const executionFixture: AgentExecution = {
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

/** The health payload the server answers with; only its 200 status matters. */
export const healthFixture = { status: 'healthy', timestamp: '2024-01-01T00:00:00Z', version: 'test' };

/** The `/graphs/{id}/topology` placeholder response: a well-formed empty graph. */
export const emptyTopologyFixture = {
  graph_id: 'studio-agent',
  topology: { nodes: [], edges: [] },
};
