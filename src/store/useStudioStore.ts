import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  AgentConfig,
  AgentExecution,
  ConnectionConfig,
  ConnectionStatus,
  ExecutionLog,
  GraphEdge,
  GraphNode,
  Message,
  ProviderInfo,
  Thread,
  ViewMode,
  formatDuration,
} from '../types';
import { ApiClient, createApiClient, extractOutputText, summariseToolCalls } from '../api/client';

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------------------
// Graph construction
//
// The server's `/graphs/{id}/topology` endpoint is currently a placeholder, so
// we derive a representative execution graph from the agent's type. This is a
// faithful model of how each agent type actually runs (see pkg/agent).
// ---------------------------------------------------------------------------

interface AgentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function buildTypeGraph(agent: AgentConfig): AgentGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const addNode = (id: string, label: string, type: string, index: number, description?: string) => {
    nodes.push({
      id,
      label,
      type,
      description,
      status: 'idle',
      position: { x: 80, y: 80 + index * 130 },
    });
  };
  const addEdge = (source: string, target: string, label?: string) => {
    edges.push({ id: `${source}-${target}`, source, target, label });
  };

  switch (agent.type) {
    case 'react':
      addNode('input', 'Input', 'input', 0, 'User message');
      addNode('reasoning', 'Reasoning', 'llm', 1, 'ReAct reasoning loop');
      addNode('tools', 'Tools', 'tool', 2, 'Tool execution');
      addNode('response', 'Response', 'output', 3, 'Final answer');
      addEdge('input', 'reasoning');
      addEdge('reasoning', 'tools', 'tool call');
      addEdge('tools', 'reasoning', 'observe');
      addEdge('reasoning', 'response', 'finish');
      break;
    case 'tool':
      addNode('input', 'Input', 'input', 0, 'User message');
      addNode('planning', 'Planning', 'llm', 1, 'Plan tool usage');
      addNode('execution', 'Execution', 'tool', 2, 'Run tools');
      addNode('review', 'Review', 'llm', 3, 'Review results');
      addNode('output', 'Output', 'output', 4, 'Final answer');
      addEdge('input', 'planning');
      addEdge('planning', 'execution');
      addEdge('execution', 'review');
      addEdge('review', 'output');
      break;
    case 'chat':
    default:
      addNode('input', 'Input', 'input', 0, 'User message');
      addNode('agent', agent.name, 'llm', 1, 'LLM generation');
      addNode('output', 'Output', 'output', 2, 'Assistant response');
      addEdge('input', 'agent');
      addEdge('agent', 'output');
      break;
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface StudioStore {
  // connection
  config: ConnectionConfig;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
  retryAttempts: number;
  maxRetryAttempts: number;
  setConfig: (config: ConnectionConfig) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  attemptReconnection: () => Promise<void>;

  // agents / tools / providers
  agents: AgentConfig[];
  selectedAgent?: AgentConfig;
  tools: string[];
  providers: ProviderInfo[];
  loadAgents: () => Promise<void>;
  selectAgent: (agent?: AgentConfig) => void;
  fetchGraphData: (agentId: string) => Promise<void>;

  // threads
  threads: Thread[];
  selectedThread?: Thread;
  createThread: () => void;
  selectThread: (thread: Thread) => void;
  deleteThread: (id: string) => void;
  addMessage: (threadId: string, message: Message) => void;

  // execution
  isExecuting: boolean;
  executionLogs: ExecutionLog[];
  lastExecution?: AgentExecution;
  sendMessage: (content: string) => Promise<void>;
  stopExecution: () => void;
  clearLogs: () => void;
  addExecutionLog: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;

  // graph
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  currentGraphNode?: string;

  // ui
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

const clientRef: { current: ApiClient | null } = { current: null };

function resetClient() {
  clientRef.current = null;
}

export const useStudioStore = create<StudioStore>()(
  devtools(
    (set, get) => ({
      // connection
      config: { apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8080' },
      connectionStatus: 'disconnected',
      isConnected: false,
      isConnecting: false,
      error: undefined,
      retryAttempts: 0,
      maxRetryAttempts: 3,

      setConfig: (config) => {
        resetClient();
        set({ config });
      },

      connect: async () => {
        const { config } = get();
        set({ isConnecting: true, connectionStatus: 'connecting', error: undefined });
        try {
          const client = createApiClient({ baseUrl: config.apiUrl, apiKey: config.apiKey });
          clientRef.current = client;

          await client.health();

          const [agents, tools, providers] = await Promise.all([
            client.listAgents().catch(() => [] as AgentConfig[]),
            client.listTools().catch(() => [] as string[]),
            client.listProviders().catch(() => [] as ProviderInfo[]),
          ]);

          set({
            isConnected: true,
            isConnecting: false,
            connectionStatus: 'connected',
            retryAttempts: 0,
            error: undefined,
            agents,
            tools,
            providers,
          });

          if (agents.length > 0) {
            get().selectAgent(agents[0]);
          }
        } catch (error) {
          set({
            isConnected: false,
            isConnecting: false,
            connectionStatus: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },

      disconnect: () => {
        resetClient();
        set({
          isConnected: false,
          connectionStatus: 'disconnected',
          agents: [],
          selectedAgent: undefined,
          tools: [],
          providers: [],
          executionLogs: [],
          graphNodes: [],
          graphEdges: [],
        });
      },

      attemptReconnection: async () => {
        const { retryAttempts, maxRetryAttempts } = get();
        if (retryAttempts >= maxRetryAttempts) {
          set({ connectionStatus: 'failed' });
          return;
        }
        set({ retryAttempts: retryAttempts + 1, connectionStatus: 'connecting' });
        await get().connect();
      },

      loadAgents: async () => {
        const { config } = get();
        if (!clientRef.current) clientRef.current = createApiClient({ baseUrl: config.apiUrl, apiKey: config.apiKey });
        try {
          const agents = await clientRef.current.listAgents();
          set({ agents });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : String(error) });
        }
      },

      selectAgent: (agent) => {
        set({ selectedAgent: agent });
        if (agent) get().fetchGraphData(agent.id).catch(() => undefined);
      },

      fetchGraphData: async (agentId) => {
        const agent = get().agents.find((a) => a.id === agentId);
        if (!agent) return;

        // Prefer the real topology when the server provides one.
        try {
          if (clientRef.current) {
            const topology = await clientRef.current.getGraphTopology(agentId);
            const rawNodes = topology?.topology?.nodes ?? [];
            const rawEdges = topology?.topology?.edges ?? [];
            if (rawNodes.length > 0 || rawEdges.length > 0) {
              set({
                graphNodes: rawNodes.map((n: any, i: number) => ({
                  id: String(n.id ?? `node-${i}`),
                  label: String(n.name ?? n.id ?? `node-${i}`),
                  type: String(n.type ?? 'default'),
                  status: 'idle',
                  position: { x: 80, y: 80 + i * 130 },
                })),
                graphEdges: rawEdges.map((e: any, i: number) => ({
                  id: String(e.id ?? `edge-${i}`),
                  source: String(e.from ?? e.source),
                  target: String(e.to ?? e.target),
                })),
              });
              return;
            }
          }
        } catch {
          // Fall through to the type-derived graph.
        }

        const { nodes, edges } = buildTypeGraph(agent);
        set({ graphNodes: nodes, graphEdges: edges, currentGraphNode: undefined });
      },

      // agents / tools / providers
      agents: [],
      selectedAgent: undefined,
      tools: [],
      providers: [],

      // threads
      threads: [],
      selectedThread: undefined,

      createThread: () => {
        const thread: Thread = {
          id: uid('thread'),
          name: `Thread ${get().threads.length + 1}`,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ threads: [...state.threads, thread], selectedThread: thread }));
      },

      selectThread: (thread) => set({ selectedThread: thread }),

      deleteThread: (id) =>
        set((state) => {
          const threads = state.threads.filter((t) => t.id !== id);
          return {
            threads,
            selectedThread: state.selectedThread?.id === id ? undefined : state.selectedThread,
          };
        }),

      addMessage: (threadId, message) =>
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, message], updatedAt: new Date() }
              : t,
          ),
          selectedThread:
            state.selectedThread?.id === threadId
              ? {
                  ...state.selectedThread,
                  messages: [...state.selectedThread.messages, message],
                  updatedAt: new Date(),
                }
              : state.selectedThread,
        })),

      // execution
      isExecuting: false,
      executionLogs: [],
      lastExecution: undefined,

      addExecutionLog: (log) =>
        set((state) => ({
          executionLogs: [
            ...state.executionLogs,
            { ...log, id: uid('log'), timestamp: new Date() },
          ],
        })),

      clearLogs: () => set({ executionLogs: [], lastExecution: undefined }),

      stopExecution: () => set({ isExecuting: false }),

      sendMessage: async (content) => {
        const { config, selectedAgent, selectedThread } = get();
        if (!selectedAgent) {
          set({ error: 'No agent selected' });
          return;
        }
        if (!content.trim()) return;

        let thread = selectedThread;
        if (!thread) {
          get().createThread();
          thread = get().selectedThread;
        }
        if (!thread) return;

        const userMessage: Message = {
          id: uid('msg'),
          role: 'user',
          content,
          timestamp: new Date(),
        };
        get().addMessage(thread.id, userMessage);

        set({ isExecuting: true, currentGraphNode: 'input' });
        get().addExecutionLog({ level: 'info', message: `Executing agent "${selectedAgent.name}"` });

        const markNode = (nodeId: string, status: GraphNode['status']) =>
          set((state) => ({
            graphNodes: state.graphNodes.map((n) =>
              n.id === nodeId ? { ...n, status } : n,
            ),
            currentGraphNode: status === 'running' ? nodeId : state.currentGraphNode,
          }));

        try {
          const client = createApiClient({ baseUrl: config.apiUrl, apiKey: config.apiKey });
          clientRef.current = client;

          const started = Date.now();
          const execution = await client.executeAgent(selectedAgent.id, content);
          const wallMs = Date.now() - started;

          set({ lastExecution: execution });
          get().addExecutionLog({
            level: execution.Success ? 'info' : 'error',
            message: `Execution ${execution.Status || (execution.Success ? 'completed' : 'failed')} in ${formatDuration(execution.Duration)} (HTTP ${wallMs}ms)`,
            data: execution,
          });

          for (const call of summariseToolCalls(execution.ToolCalls)) {
            get().addExecutionLog({ level: 'debug', message: `Tool call: ${call}` });
          }

          // Reflect node statuses from the execution path when available.
          const path = execution.ExecutionPath ?? [];
          const nodes = get().graphNodes;
          nodes.forEach((node) => markNode(node.id, 'completed'));
          if (path.length > 0) {
            path.forEach((id) => markNode(id, 'completed'));
          }
          set({ currentGraphNode: path[path.length - 1] ?? nodes[nodes.length - 1]?.id });

          const text = extractOutputText(execution.Output);
          const assistantMessage: Message = {
            id: uid('msg'),
            role: 'assistant',
            content: text || 'No output returned.',
            timestamp: new Date(),
            metadata: {
              duration_ns: execution.Duration,
              status: execution.Status,
              tool_calls: execution.ToolCalls?.length ?? 0,
            },
          };
          get().addMessage(thread.id, assistantMessage);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          get().addExecutionLog({ level: 'error', message: `Execution failed: ${message}` });
          const errorMessage: Message = {
            id: uid('msg'),
            role: 'assistant',
            content: `❌ Execution failed: ${message}`,
            timestamp: new Date(),
          };
          get().addMessage(thread.id, errorMessage);
          set({ error: message });
        } finally {
          set({ isExecuting: false, currentGraphNode: undefined });
        }
      },

      // graph
      graphNodes: [],
      graphEdges: [],
      currentGraphNode: undefined,

      // ui
      currentView: 'chat',
      setCurrentView: (view) => set({ currentView: view }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      darkMode: false,
      setDarkMode: (dark) => set({ darkMode: dark }),
    }),
    { name: 'golanggraph-studio' },
  ),
);
