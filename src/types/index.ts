// Type definitions aligned with the GoLangGraph server API (`/api/v1`).
//
// The backend is written in Go and encodes JSON using struct field tags where
// available, and Go's default (PascalCase) field names otherwise. These types
// mirror that contract exactly so the UI can round-trip data without mapping
// layers.

export type AgentType = 'chat' | 'react' | 'tool';
export type ViewMode = 'graph' | 'chat' | 'debug';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface ConnectionConfig {
  apiUrl: string;
  apiKey?: string;
}

/**
 * Mirrors `agent.AgentConfig` JSON (snake_case).
 * `timeout` is Go's `time.Duration`, serialised as integer nanoseconds.
 */
export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  model: string;
  provider: string;
  system_prompt?: string;
  temperature: number;
  max_tokens: number;
  max_iterations: number;
  tools: string[];
  enable_streaming: boolean;
  /** Present only when the agent sets an explicit streaming mode. */
  streaming_mode?: string;
  timeout: number; // nanoseconds
  metadata?: Record<string, unknown>;
}

/** Mirrors `llm.ToolCall` JSON. */
export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
  index?: number;
  metadata?: Record<string, unknown>;
}

/** Mirrors `llm.Usage` JSON. */
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Mirrors `agent.StateChange` JSON.
 *
 * The server records one entry per node visit while an agent runs, which is
 * what the debug view steps through.
 */
export interface StateChange {
  node_id: string;
  node_name: string;
  timestamp: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * Mirrors `agent.AgentExecution` JSON.
 *
 * The Go struct tags every field, so the wire format is snake_case like the
 * rest of the API — not Go's default PascalCase. There is a single `timestamp`
 * marking the start plus a `duration`, rather than separate start and end
 * timestamps, and `execution_path` lists the nodes that ran.
 */
export interface AgentExecution {
  id: string;
  timestamp: string;
  input: string;
  /** Legacy flat string output, kept by the server for compatibility. */
  output: string;
  structured_output?: unknown;
  tool_calls: ToolCall[] | null;
  /** Go `time.Duration`, serialised as integer nanoseconds. */
  duration: number;
  success: boolean;
  /** Present only when the execution failed. */
  error?: string;
  metadata?: Record<string, unknown>;
  execution_path: string[];
  state_changes?: StateChange[];
}

/** Mirrors `llm.ProviderConfig` (a subset of the useful fields). */
export interface ProviderInfo {
  name: string;
  type?: string;
  endpoint?: string;
  model?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// UI-only types
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Thread {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export type NodeStatus = 'idle' | 'running' | 'completed' | 'error';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  status: NodeStatus;
  position: { x: number; y: number };
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

/** Formats a Go `time.Duration` (nanoseconds) into a human readable string. */
export function formatDuration(ns: number): string {
  if (!ns || ns <= 0) return '0ms';
  const ms = ns / 1e6;
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 1 : 0)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  return `${m}m ${rest}s`;
}
