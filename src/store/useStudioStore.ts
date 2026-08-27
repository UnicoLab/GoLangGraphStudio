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

/** Normalises anything thrown into a message we can put in front of the user. */
const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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

/**
 * Monotonic tokens used to discard the results of superseded async work.
 *
 * Graph fetches and agent executions are promises that write into shared state
 * whenever they happen to resolve. Without a token, selecting agent A and then
 * agent B leaves B's graph overwritten by A's slower topology response, and
 * pressing Stop still appends the abandoned answer to the thread once the
 * in-flight request lands. Each async entry point takes a token on the way in
 * and only writes state back if it is still the current one.
 */
const graphRequestRef = { current: 0 };
const executionRef = { current: 0 };

function resetClient() {
  clientRef.current = null;
  // Anything already in flight belongs to the previous server/config, so its
  // result must never be applied.
  graphRequestRef.current += 1;
  executionRef.current += 1;
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

          // Only the health probe decides whether we are connected; the three
          // catalogue calls are allowed to fail independently. They must not
          // fail *silently* though: these were previously `.catch(() => [])`,
          // so a server whose /agents endpoint was broken was indistinguishable
          // from one with no agents configured — the studio just showed an
          // empty agent list and said "Connected".
          const failures: string[] = [];
          const loadOrReport = async <T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> => {
            try {
              return await load();
            } catch (error) {
              failures.push(`${label} (${describeError(error)})`);
              return fallback;
            }
          };

          const [agents, tools, providers] = await Promise.all([
            loadOrReport('agents', () => client.listAgents(), [] as AgentConfig[]),
            loadOrReport('tools', () => client.listTools(), [] as string[]),
            loadOrReport('providers', () => client.listProviders(), [] as ProviderInfo[]),
          ]);

          set({
            isConnected: true,
            isConnecting: false,
            connectionStatus: 'connected',
            retryAttempts: 0,
            error: failures.length > 0 ? `Connected, but could not load ${failures.join(', ')}` : undefined,
            agents,
            tools,
            providers,
          });

          failures.forEach((failure) =>
            get().addExecutionLog({ level: 'warn', message: `Could not load ${failure}` }),
          );

          if (agents.length > 0) {
            get().selectAgent(agents[0]);
          }
        } catch (error) {
          set({
            isConnected: false,
            isConnecting: false,
            connectionStatus: 'failed',
            error: describeError(error),
          });
        }
      },

      disconnect: () => {
        resetClient();
        set({
          isConnected: false,
          // Everything below describes the server we are walking away from.
          // Leaving `lastExecution` and `currentGraphNode` behind made the
          // debug view describe a run whose logs had just been cleared and the
          // graph highlight point at a node that no longer existed, and a
          // stuck `isExecuting` left the composer showing a Stop button.
          isConnecting: false,
          isExecuting: false,
          connectionStatus: 'disconnected',
          retryAttempts: 0,
          error: undefined,
          agents: [],
          selectedAgent: undefined,
          tools: [],
          providers: [],
          executionLogs: [],
          lastExecution: undefined,
          graphNodes: [],
          graphEdges: [],
          currentGraphNode: undefined,
        });
      },

      attemptReconnection: async () => {
        const { retryAttempts, maxRetryAttempts } = get();
        if (retryAttempts >= maxRetryAttempts) {
          // The Retry button stays on screen once the budget is spent, so say
          // why pressing it does nothing rather than failing silently.
          set({
            connectionStatus: 'failed',
            error: `Gave up after ${maxRetryAttempts} connection attempts. Check the server URL and that the GoLangGraph server is running, then reconnect from the setup screen.`,
          });
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
          set({ error: describeError(error) });
        }
      },

      selectAgent: (agent) => {
        // Clear the highlight up front: it names a node in the outgoing
        // agent's graph and means nothing in the incoming one.
        set({ selectedAgent: agent, currentGraphNode: undefined });
        if (!agent) {
          set({ graphNodes: [], graphEdges: [] });
          return;
        }
        // Fire and forget, but report rather than discard: this used to be
        // `.catch(() => undefined)`, which hid any graph failure completely.
        get()
          .fetchGraphData(agent.id)
          .catch((error) =>
            get().addExecutionLog({
              level: 'warn',
              message: `Could not build the graph for "${agent.name}": ${describeError(error)}`,
            }),
          );
      },

      fetchGraphData: async (agentId) => {
        const agent = get().agents.find((a) => a.id === agentId);
        if (!agent) {
          // Nothing is known about this agent, so there is no graph to draw.
          // Returning early used to leave the *previous* agent's graph on
          // screen, silently attributing it to the new selection.
          set({ graphNodes: [], graphEdges: [], currentGraphNode: undefined });
          return;
        }

        const token = ++graphRequestRef.current;
        const isCurrent = () => graphRequestRef.current === token;

        // Prefer the real topology when the server provides one.
        try {
          if (clientRef.current) {
            const topology = await clientRef.current.getGraphTopology(agentId);
            if (!isCurrent()) return;
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
                currentGraphNode: undefined,
              });
              return;
            }
          }
        } catch {
          // Fall through to the type-derived graph.
        }

        if (!isCurrent()) return;
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

      stopExecution: () => {
        // The API client exposes no cancellation, so the HTTP request itself
        // runs to completion. Bumping the token makes `sendMessage` drop
        // whatever comes back: without it, pressing Stop cleared the spinner
        // but the abandoned answer still appeared in the thread seconds later.
        executionRef.current += 1;
        set({ isExecuting: false, currentGraphNode: undefined });
        get().addExecutionLog({ level: 'warn', message: 'Execution stopped.' });
      },

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

        const token = ++executionRef.current;
        // `error` describes the most recent failure only — a new run must not
        // be read against the previous run's message.
        set({ isExecuting: true, currentGraphNode: 'input', error: undefined });
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

          // Superseded by Stop or by a newer run while we were waiting.
          if (executionRef.current !== token) {
            get().addExecutionLog({
              level: 'warn',
              message: 'Discarded the result of a stopped execution.',
            });
            return;
          }

          set({ lastExecution: execution });

          // A failed execution carries its reason in `error`. It was never
          // read, so the log line said only "failed" and the assistant bubble
          // said "No output returned." — the user was told nothing at all
          // about why the run did not work.
          const reason = execution.error?.trim();
          const outcome = execution.success ? 'completed' : 'failed';
          get().addExecutionLog({
            level: execution.success ? 'info' : 'error',
            message:
              `Execution ${outcome} in ${formatDuration(execution.duration)} (HTTP ${wallMs}ms)` +
              (!execution.success && reason ? `: ${reason}` : ''),
            data: execution,
          });

          for (const call of summariseToolCalls(execution.tool_calls ?? [])) {
            get().addExecutionLog({ level: 'debug', message: `Tool call: ${call}` });
          }

          // Reflect node statuses from the execution.
          //
          // `execution_path` names the nodes the server actually ran. Those ids
          // only line up with the graph when the server returned a real
          // topology — the type-derived fallback graph uses its own ids — so
          // when none of them match we fall back to marking the whole graph.
          // Either way a failed run must not be painted green, which is what
          // the previous unconditional `markNode(id, 'completed')` did: the
          // `error` node status existed but was never produced.
          const path = execution.execution_path ?? [];
          const nodes = get().graphNodes;
          const visited = path.filter((id) => nodes.some((n) => n.id === id));
          const finalStatus: GraphNode['status'] = execution.success ? 'completed' : 'error';

          if (visited.length > 0) {
            const lastVisited = visited[visited.length - 1];
            nodes.forEach((node) =>
              markNode(node.id, visited.indexOf(node.id) >= 0 ? 'completed' : 'idle'),
            );
            markNode(lastVisited, finalStatus);
            set({ currentGraphNode: lastVisited });
          } else {
            nodes.forEach((node) => markNode(node.id, finalStatus));
            set({ currentGraphNode: nodes[nodes.length - 1]?.id });
          }

          const text = extractOutputText(execution.output);
          const assistantMessage: Message = {
            id: uid('msg'),
            role: 'assistant',
            content:
              text ||
              (execution.success
                ? 'No output returned.'
                : `❌ Execution failed: ${reason || 'the server did not report a reason.'}`),
            timestamp: new Date(),
            metadata: {
              duration_ns: execution.duration,
              status: outcome,
              tool_calls: execution.tool_calls?.length ?? 0,
              ...(reason ? { error: reason } : {}),
            },
          };
          get().addMessage(thread.id, assistantMessage);

          if (!execution.success) {
            set({ error: reason || 'The execution failed without a reported reason.' });
          }
        } catch (error) {
          if (executionRef.current !== token) return;
          const message = describeError(error);
          get().addExecutionLog({ level: 'error', message: `Execution failed: ${message}` });
          const errorMessage: Message = {
            id: uid('msg'),
            role: 'assistant',
            content: `❌ Execution failed: ${message}`,
            timestamp: new Date(),
          };
          get().addMessage(thread.id, errorMessage);
          set({ error: message, currentGraphNode: undefined });
        } finally {
          // Only the run that is still current owns these flags, and the
          // `currentGraphNode` set above must survive: clearing it here threw
          // away the highlight identifying where the run ended, making that
          // whole computation dead code.
          if (executionRef.current === token) set({ isExecuting: false });
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
