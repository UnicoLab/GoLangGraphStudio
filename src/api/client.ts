import {
  AgentConfig,
  AgentExecution,
  ProviderInfo,
  ToolCall,
} from '../types';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  providers?: Record<string, unknown>;
}

interface GraphTopologyResponse {
  graph_id: string;
  topology: {
    nodes: unknown[];
    edges: unknown[];
  };
}

export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
}

/**
 * Minimal typed client for the GoLangGraph server (`/api/v1`).
 *
 * The server reads the `X-API-Key` header for authentication and always
 * responds with JSON. Errors are surfaced as `ApiError` with the server's
 * `error` field when available.
 */
export function createApiClient(options: ApiClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
      ...((init.headers as Record<string, string> | undefined) || {}),
    };

    let response: Response;
    try {
      response = await fetch(`${base}${path}`, { ...init, headers });
    } catch (error) {
      throw new ApiError(0, `Unable to reach server: ${(error as Error).message}`);
    }

    if (!response.ok) {
      let message = `HTTP ${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        if (body && typeof body.error === 'string') message = body.error;
      } catch {
        // Ignore JSON parse failures on error bodies.
      }
      throw new ApiError(response.status, message);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    health: () => request<HealthResponse>('/api/v1/health'),

    listAgents: async (): Promise<AgentConfig[]> => {
      const res = await request<{ agents: AgentConfig[] }>('/api/v1/agents');
      return res.agents ?? [];
    },

    getAgent: async (id: string): Promise<AgentConfig> => {
      const res = await request<{ agent: AgentConfig }>(`/api/v1/agents/${id}`);
      return res.agent;
    },

    executeAgent: async (id: string, input: string): Promise<AgentExecution> => {
      const res = await request<{ execution: AgentExecution }>(
        `/api/v1/agents/${id}/execute`,
        { method: 'POST', body: JSON.stringify({ input }) },
      );
      return res.execution;
    },

    getAgentHistory: async (id: string): Promise<AgentExecution[]> => {
      const res = await request<{ history: AgentExecution[] }>(
        `/api/v1/agents/${id}/history`,
      );
      return res.history ?? [];
    },

    listTools: async (): Promise<string[]> => {
      const res = await request<{ tools: string[] }>('/api/v1/tools');
      return res.tools ?? [];
    },

    listProviders: async (): Promise<ProviderInfo[]> => {
      const res = await request<{ providers: ProviderInfo[] }>('/api/v1/providers');
      return res.providers ?? [];
    },

    getGraphTopology: (id: string) =>
      request<GraphTopologyResponse>(`/api/v1/graphs/${id}/topology`),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Extracts a human readable string from an `AgentExecution.output` value. */
export function extractOutputText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output == null) return '';
  if (typeof output === 'object') {
    const obj = output as Record<string, unknown>;
    const preferred = ['response', 'result', 'output', 'content', 'text', 'message', 'answer'];
    for (const key of preferred) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return JSON.stringify(output, null, 2);
  }
  return String(output);
}

/** Summarises the tool calls of an execution for display in the debug view. */
export function summariseToolCalls(calls: ToolCall[]): string[] {
  return (calls ?? []).map((call) => {
    const name = call?.function?.name ?? call?.type ?? 'tool';
    let args = '';
    try {
      if (call?.function?.arguments) {
        args = JSON.stringify(JSON.parse(call.function.arguments));
      }
    } catch {
      args = call?.function?.arguments ?? '';
    }
    return args ? `${name}(${args})` : name;
  });
}
