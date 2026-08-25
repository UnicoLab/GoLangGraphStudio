export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Thread {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
  // GoLangGraph specific fields
  agentId?: string;
  sessionId?: string;
}

// GoLangGraph uses agents instead of assistants
export interface Agent {
  id: string;
  name: string;
  description?: string;
  type: 'react' | 'chat' | 'tool';
  model: string;
  provider: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number;
  tools: string[];
  enableStreaming: boolean;
  timeout: number;
  metadata?: Record<string, any>;
  // Graph structure
  graph?: GoLangGraph;
}

// Keep Assistant as alias for backward compatibility
export interface Assistant extends Agent {
  config: Record<string, any>;
  graph_id: string;
}

// GoLangGraph specific types
export interface GoLangGraph {
  id: string;
  name: string;
  nodes: GoLangGraphNode[];
  edges: GoLangGraphEdge[];
  startNode: string;
  endNodes: string[];
  config: GraphConfig;
  metadata?: Record<string, any>;
}

export interface GoLangGraphNode {
  id: string;
  name: string;
  metadata: Record<string, any>;
}

export interface GoLangGraphEdge {
  id: string;
  from: string;
  to: string;
  metadata?: Record<string, any>;
}

export interface GraphConfig {
  maxIterations: number;
  timeout: number;
  enableStreaming: boolean;
  enableCheckpoints: boolean;
  parallelExecution: boolean;
  retryAttempts: number;
  retryDelay: number;
}

// UI representation of graph nodes (converted from GoLangGraph)
export interface GraphNode {
  id: string;
  type: string;
  data: {
    label: string;
    description?: string;
    status: 'idle' | 'running' | 'completed' | 'error' | 'paused';
    metadata?: any;
  };
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: any;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  currentNode?: string;
  executionPath: string[];
}

// GoLangGraph execution types
export interface AgentExecution {
  id: string;
  timestamp: Date;
  input: string;
  output: string;
  toolCalls: ToolCall[];
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  nodeId: string;
  success: boolean;
  error?: string;
  duration: number;
  timestamp: Date;
  state?: Record<string, any>;
}

export interface RunStep {
  id: string;
  node: string;
  input: any;
  output: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Run {
  id: string;
  thread_id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'interrupted';
  steps: RunStep[];
  createdAt: Date;
  updatedAt: Date;
  input?: any;
  output?: any;
  error?: string;
  execution?: AgentExecution;
}

export interface StreamEvent {
  event: string;
  data: any;
  timestamp: Date;
}

// GoLangGraph config (replaces LangGraphConfig)
export interface GoLangGraphConfig {
  apiUrl: string;
  agentId?: string;
  assistantId?: string;
  apiKey?: string;
}

// Keep LangGraphConfig as alias for backward compatibility
export interface LangGraphConfig extends GoLangGraphConfig { }

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  error?: string;
}

export interface Checkpoint {
  id: string;
  thread_id: string;
  step: number;
  state: any;
  timestamp: Date;
}

export interface Memory {
  id: string;
  key: string;
  value: any;
  type: 'short_term' | 'long_term';
  createdAt: Date;
  updatedAt: Date;
}

export interface Interrupt {
  id: string;
  node: string;
  reason: string;
  data: any;
  timestamp: Date;
}

// Deep Agent types - extends base Agent with middleware and sub-agent capabilities
export interface DeepAgent extends Agent {
  middleware: MiddlewareConfig[];
  subAgents: SubAgentConfig[];
  interruptOn: string[];
  enablePlanning: boolean;
  enableReflection: boolean;
  enableFilesystem: boolean;
}

export interface MiddlewareConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface SubAgentConfig {
  name: string;
  agentId: string;
  description?: string;
}

export interface SubAgentResult {
  agentName: string;
  task: string;
  result: string;
  duration: number;
  success: boolean;
  error?: string;
}

export interface InterruptEvent {
  id: string;
  agentId: string;
  threadId: string;
  toolName: string;
  toolArgs: Record<string, any>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: Date;
  resolvedAt?: Date;
}

export type ViewMode = 'graph' | 'chat' | 'debug';

export interface StudioState {
  currentView: ViewMode;
  selectedThread?: Thread;
  selectedAgent?: Agent; // Changed from selectedAssistant
  selectedAssistant?: Assistant; // Keep for backward compatibility
  currentRun?: Run;
  graphState: GraphState;
  isConnected: boolean;
  isLoading: boolean;
  error?: string;
}

// Enhanced types for graph execution (keep existing)
export interface ExecutionLog {
  id: string;
  nodeId: string;
  nodeName: string;
  timestamp: Date;
  type: 'input' | 'output' | 'error' | 'info' | 'debug';
  message: string;
  data?: any;
  duration?: number;
}

export interface GraphExecutionState {
  [key: string]: any;
}

export interface NodeBreakpoint {
  nodeId: string;
  enabled: boolean;
  condition?: string;
}

export interface ExecutionContext {
  isExecuting: boolean;
  isPaused: boolean;
  currentState: GraphExecutionState;
  logs: ExecutionLog[];
  breakpoints: NodeBreakpoint[];
  executionId?: string;
  startTime?: Date;
  endTime?: Date;
  threadId?: string;
  agentId?: string; // Changed from assistantId
  assistantId?: string; // Keep for backward compatibility
} 