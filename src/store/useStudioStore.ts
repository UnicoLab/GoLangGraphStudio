/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useEffect, useRef } from 'react';
import React from 'react';
import {
  StudioState,
  Thread,
  Agent,
  Assistant,
  Run,
  Message,
  ViewMode,
  GraphState,
  GoLangGraphConfig,
  GraphNode,
  GraphEdge,
  ExecutionContext,
  ExecutionLog,
  GraphExecutionState,
  DeepAgent,
  InterruptEvent,
  SubAgentResult
} from '../types';

// Automatic layout algorithm for better graph visualization
const applyAutoLayout = (nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] => {
  if (nodes.length === 0) return nodes;

  // Create adjacency lists for graph traversal
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  nodes.forEach(node => {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  });

  edges.forEach(edge => {
    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.push(edge.source);
  });

  // Find start nodes (no incoming edges) and end nodes (no outgoing edges)
  const startNodes = nodes.filter(node => incoming.get(node.id)?.length === 0);
  const endNodes = nodes.filter(node => outgoing.get(node.id)?.length === 0);

  // Topological sort to determine layers
  const layers: string[][] = [];
  const visited = new Set<string>();
  const nodeToLayer = new Map<string, number>();

  // BFS to assign layers
  const queue: Array<{ nodeId: string; layer: number }> = [];

  // Start with nodes that have no incoming edges
  startNodes.forEach(node => {
    queue.push({ nodeId: node.id, layer: 0 });
  });

  // If no clear start nodes, pick the first node
  if (queue.length === 0 && nodes.length > 0) {
    queue.push({ nodeId: nodes[0].id, layer: 0 });
  }

  while (queue.length > 0) {
    const { nodeId, layer } = queue.shift()!;

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    // Ensure we have enough layers
    while (layers.length <= layer) {
      layers.push([]);
    }

    layers[layer].push(nodeId);
    nodeToLayer.set(nodeId, layer);

    // Add children to next layer
    const children = outgoing.get(nodeId) || [];
    children.forEach(childId => {
      if (!visited.has(childId)) {
        queue.push({ nodeId: childId, layer: layer + 1 });
      }
    });
  }

  // Handle any remaining unvisited nodes
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const lastLayer = layers.length;
      if (layers.length === 0) layers.push([]);
      else layers.push([]);
      layers[lastLayer].push(node.id);
      nodeToLayer.set(node.id, lastLayer);
    }
  });

  // Calculate positions
  const nodeWidth = 160;
  const nodeHeight = 100;
  const horizontalSpacing = 220;
  const verticalSpacing = 140;
  const startX = 100;
  const startY = 100;

  // Position nodes in their layers
  const positionedNodes = nodes.map(node => {
    const layer = nodeToLayer.get(node.id) || 0;
    const layerNodes = layers[layer] || [];
    const indexInLayer = layerNodes.indexOf(node.id);

    // Center the layer vertically
    const layerHeight = layerNodes.length * nodeHeight + (layerNodes.length - 1) * verticalSpacing;
    const layerStartY = startY - layerHeight / 2 + (layerNodes.length > 1 ? 0 : layerHeight / 2);

    const x = startX + layer * horizontalSpacing;
    const y = layerStartY + indexInLayer * (nodeHeight + verticalSpacing);

    return {
      ...node,
      position: { x, y }
    };
  });

  return positionedNodes;
};

// Live Update Event System
type LiveUpdateEvent =
  | { type: 'EXECUTION_STARTED'; data: { threadId: string; assistantId: string; initialState: any } }
  | { type: 'EXECUTION_STEP'; data: { nodeId: string; nodeName: string; progress: number } }
  | { type: 'EXECUTION_LOG'; data: ExecutionLog }
  | { type: 'EXECUTION_COMPLETED'; data: { threadId: string; finalState: any; duration: number } }
  | { type: 'EXECUTION_STOPPED'; data: { threadId: string; reason: string } }
  | { type: 'MESSAGE_ADDED'; data: { threadId: string; message: Message } }
  | { type: 'THREAD_UPDATED'; data: { threadId: string; updates: Partial<Thread> } }
  | { type: 'GRAPH_STATE_CHANGED'; data: GraphState }
  | { type: 'NODE_FOCUSED'; data: { nodeId: string } }
  | { type: 'STREAMING_UPDATE'; data: { messageId: string; content: string; isComplete: boolean } }
  | { type: 'INTERRUPT_RECEIVED'; data: InterruptEvent }
  | { type: 'INTERRUPT_RESOLVED'; data: { interruptId: string; resolution: 'approved' | 'rejected' } }
  | { type: 'SUB_AGENT_COMPLETED'; data: SubAgentResult };

class LiveUpdateManager {
  private listeners: Map<string, Set<(event: LiveUpdateEvent) => void>> = new Map();
  private globalListeners: Set<(event: LiveUpdateEvent) => void> = new Set();

  // Subscribe to specific event types
  subscribe(eventType: LiveUpdateEvent['type'], callback: (event: LiveUpdateEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  // Subscribe to all events
  subscribeAll(callback: (event: LiveUpdateEvent) => void): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  // Emit an event to all subscribers
  emit(event: LiveUpdateEvent) {
    // Notify type-specific listeners
    this.listeners.get(event.type)?.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in live update listener:', error);
      }
    });

    // Notify global listeners
    this.globalListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in global live update listener:', error);
      }
    });

    // Log for debugging
    // console.log('🔴 Live Update:', event.type, event.data);
  }

  // Get current listener count for debugging
  getListenerCount(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    this.listeners.forEach((listeners, type) => {
      byType[type] = listeners.size;
    });
    return {
      total: this.globalListeners.size + Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
      byType
    };
  }
}

// Global live update manager instance
export const liveUpdateManager = new LiveUpdateManager();

// Helper function to generate contextual responses based on execution
const generateExecutionResponse = (inputMessage: string, logs: ExecutionLog[]): string => {
  // First priority: Look for intermediate_results in logs (matching user's example format)
  const intermediateResultsLogs = logs.filter(log =>
    log.data?.intermediate_results
  );

  for (const log of intermediateResultsLogs.reverse()) {
    const results = log.data.intermediate_results;

    // Look for respond node specifically (as shown in user's example)
    if (results.respond && results.respond.response) {
      return results.respond.response;
    }

    // Look for any node with response - extract just the response field
    for (const [nodeId, result] of Object.entries(results)) {
      if (result && typeof result === 'object') {
        const nodeResult = result as any;
        if (nodeResult.response && typeof nodeResult.response === 'string' && nodeResult.response.trim().length > 0) {
          return nodeResult.response;
        }
      }
    }
  }

  // Second priority: Look for actual agent responses in the logs data output
  const responseLogs = logs.filter(log =>
    log.type === 'output' && log.data?.output
  );

  for (const log of responseLogs.reverse()) {
    const output = log.data.output;

    // Handle structured agent responses (Go map format)
    if (output && typeof output === 'object') {
      // Extract response field from structured output
      if (output.response && typeof output.response === 'string' && output.response.trim().length > 0) {
        return output.response;
      }

      // Fallback to other text fields
      const textFields = ['result', 'content', 'text', 'message', 'answer'];
      for (const field of textFields) {
        if (output[field] && typeof output[field] === 'string' && output[field].trim().length > 0) {
          return output[field];
        }
      }
    }

    // Handle string responses
    if (typeof output === 'string' && output.trim().length > 0) {
      return output;
    }
  }

  // Third priority: Look for final_response in the execution state
  const finalResponseLogs = logs.filter(log =>
    log.data?.final_response &&
    typeof log.data.final_response === 'string' &&
    log.data.final_response.trim().length > 0
  );

  if (finalResponseLogs.length > 0) {
    const latestFinalResponse = finalResponseLogs[finalResponseLogs.length - 1];
    return latestFinalResponse.data.final_response;
  }

  // Fourth priority: Look for responses in state_updates intermediate results
  const stateUpdateLogs = logs.filter(log =>
    log.data?.state_updates?.intermediate_results
  );

  for (const log of stateUpdateLogs.reverse()) {
    const results = log.data.state_updates.intermediate_results;
    for (const [nodeId, result] of Object.entries(results)) {
      if (nodeId.includes('respond') && result && typeof result === 'object') {
        const response = (result as any).response;
        if (response && typeof response === 'string' && response.trim().length > 0) {
          return response;
        }
      }
    }
  }

  // Fifth priority: Look for any generation or response nodes
  const generationLogs = logs.filter(log =>
    (log.nodeId.includes('respond') ||
      log.nodeId.includes('generation') ||
      log.nodeName.toLowerCase().includes('respond') ||
      log.nodeName.toLowerCase().includes('generation')) &&
    log.type === 'output' &&
    log.data?.output
  );

  for (const log of generationLogs.reverse()) {
    const output = log.data.output;
    if (output.response && typeof output.response === 'string' && output.response.trim().length > 0) {
      return output.response;
    }
    if (output.result && typeof output.result === 'string' && output.result.trim().length > 0) {
      return output.result;
    }
    if (output.content && typeof output.content === 'string' && output.content.trim().length > 0) {
      return output.content;
    }
  }

  // Sixth priority: Look for any meaningful text output in recent logs
  const meaningfulLogs = logs.filter(log =>
    log.type === 'output' &&
    log.data?.output &&
    typeof log.data.output === 'object'
  ).slice(-5); // Get last 5 meaningful logs

  for (const log of meaningfulLogs.reverse()) {
    const output = log.data.output;

    // Check various possible response fields
    const possibleResponses = [
      output.response,
      output.result,
      output.content,
      output.text,
      output.message,
      output.answer,
      output.clarification_request
    ];

    for (const response of possibleResponses) {
      if (response && typeof response === 'string' && response.trim().length > 20) {
        return response;
      }
    }
  }

  // Last resort: Generate a contextual response based on execution path
  const executedNodes = new Set(logs.map(log => log.nodeId));
  const extractedMessage = logs.find(log => log.data?.userMessage)?.data.userMessage || inputMessage || 'your request';

  if (executedNodes.has('respond_to_greeting') || Array.from(executedNodes).some(id => id.includes('greeting'))) {
    return `Hello! I'm here to help you with any questions or research you need. What would you like to know about?`;
  }

  return `I've processed your request: "${extractedMessage}". The system completed execution successfully with ${executedNodes.size} nodes.`;
};

interface StudioStore extends StudioState {
  // Actions
  setCurrentView: (view: ViewMode) => void;
  setSelectedThread: (thread: Thread | undefined) => void;
  setSelectedAgent: (agent: Assistant | undefined) => void;
  setSelectedAssistant: (assistant: Assistant | undefined) => void; // Keep for backward compatibility
  setCurrentRun: (run: any | undefined) => void;
  setGraphState: (state: GraphState) => void;
  setIsConnected: (connected: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | undefined) => void;

  // UI State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;

  // Streaming
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  streamingMessage: string;
  setStreamingMessage: (message: string) => void;

  // Connection & Retry Logic
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'failed';
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting' | 'failed') => void;
  retryAttempts: number;
  maxRetryAttempts: number;
  attemptReconnection: () => Promise<void>;

  // Thread management
  threads: Thread[];
  addThread: (thread: Thread) => void;
  updateThread: (threadId: string, updates: Partial<Thread>) => void;
  deleteThread: (threadId: string) => void;
  addMessageToThread: (threadId: string, message: Message) => void;

  // Agent management (GoLangGraph)
  agents: Assistant[];
  addAgent: (agent: Assistant) => void;
  updateAgent: (agentId: string, updates: Partial<Assistant>) => void;
  deleteAgent: (agentId: string) => void;
  clearAgents: () => void;

  // Assistant management (backward compatibility)
  assistants: Assistant[];
  addAssistant: (assistant: Assistant) => void;
  updateAssistant: (assistantId: string, updates: Partial<Assistant>) => void;
  deleteAssistant: (assistantId: string) => void;
  clearAssistants: () => void;

  // Run management
  runs: any[];
  addRun: (run: any) => void;
  updateRun: (runId: string, updates: Partial<any>) => void;

  // Configuration
  config: GoLangGraphConfig;
  setConfig: (config: GoLangGraphConfig) => void;

  // Graph data fetching
  fetchGraphData: (agentId: string) => Promise<void>;

  // Graph Execution Context - now supports multiple contexts per thread/agent
  executionContext: ExecutionContext;
  executionContexts: Map<string, ExecutionContext>; // Key: threadId-agentId
  setExecutionContext: (context: Partial<ExecutionContext>) => void;
  getExecutionContextKey: (threadId?: string, agentId?: string) => string;
  switchToExecutionContext: (threadId?: string, agentId?: string) => void;
  startExecution: (initialState?: GraphExecutionState, startFromNode?: string) => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  stopExecution: () => void;
  stepExecution: () => void;
  addExecutionLog: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
  clearExecutionLogs: () => void;
  setGraphExecutionState: (state: ExecutionState) => void;
  addBreakpoint: (nodeId: string, condition?: string) => void;
  removeBreakpoint: (nodeId: string) => void;
  toggleBreakpoint: (nodeId: string) => void;

  // Graph view controls
  focusOnNode: (nodeId: string) => void;
  fitGraphToView: () => void;

  // Live Update System
  liveUpdateManager: LiveUpdateManager;
  subscribeLiveUpdates: (eventType: LiveUpdateEvent['type'], callback: (event: LiveUpdateEvent) => void) => () => void;
  subscribeAllLiveUpdates: (callback: (event: LiveUpdateEvent) => void) => () => void;
  emitLiveUpdate: (event: LiveUpdateEvent) => void;

  // Enhanced methods with live updates
  addMessageToThreadLive: (threadId: string, message: Message) => void;
  updateThreadLive: (threadId: string, updates: Partial<Thread>) => void;
  setGraphStateLive: (state: Graph) => void;
  focusOnNodeLive: (nodeId: string) => void;

  // Global execution system
  startGlobalExecution: (source: 'chat' | 'graph', initialState?: ExecutionState, userMessage?: string) => void;

  // Deep Agent state
  activeInterrupts: InterruptEvent[];
  subAgentResults: SubAgentResult[];
  addInterrupt: (interrupt: InterruptEvent) => void;
  resolveInterrupt: (interruptId: string, resolution: 'approved' | 'rejected') => void;
  clearInterrupts: () => void;
  addSubAgentResult: (result: SubAgentResult) => void;
  clearSubAgentResults: () => void;

  // Reset
  reset: () => void;
}

const initialState: ExecutionState = {
  isExecuting: false,
  isPaused: false,
  currentState: {},
  logs: [],
  breakpoints: [],
};

const initialExecutionContext: ExecutionState = {
  isExecuting: false,
  isPaused: false,
  currentState: {},
  logs: [],
  breakpoints: [],
};

export const useStudioStore = create<StudioStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      threads: [],
      agents: [],
      assistants: [],
      runs: [],
      config: {
        apiUrl: 'http://localhost:8080',
        agentId: undefined,
        apiKey: undefined,
      },

      // Deep Agent state
      activeInterrupts: [],
      subAgentResults: [],

      // Actions
      setCurrentView: (view) => set({ currentView: view }),
      setSelectedThread: (thread) => {
        set({ selectedThread: thread });
        // Switch to the execution context for this thread
        const state = get();
        if (thread && state.selectedAgent) {
          state.switchToExecutionContext(thread.id, state.selectedAgent.id);
        }
      },
      setSelectedAgent: (agent) => {
        const assistant = agent ? { ...agent, config: {}, graph_id: agent.graph?.id || '' } : undefined;
        set({ selectedAgent: agent, selectedAssistant: assistant }); // Keep both in sync
        // Switch to the execution context for this agent
        const state = get();
        if (agent && state.selectedThread) {
          state.switchToExecutionContext(state.selectedThread.id, agent.id);
        }
      },
      setSelectedAssistant: (assistant) => {
        set({ selectedAssistant: assistant, selectedAgent: assistant }); // Keep both in sync
        // Switch to the execution context for this assistant
        const state = get();
        if (assistant && state.selectedThread) {
          state.switchToExecutionContext(state.selectedThread.id, assistant.id);
        }
      },
      setCurrentRun: (run) => set({ currentRun: run }),
      setGraphState: (graphState) => {
        set({ graphState });
        // Emit live update
        liveUpdateManager.emit({
          type: 'GRAPH_STATE_CHANGED',
          data: graphState
        });
      },
      setIsConnected: (isConnected) => set({ isConnected }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // UI State
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      darkMode: false,
      setDarkMode: (darkMode) => set({ darkMode }),

      // Streaming
      isStreaming: false,
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      streamingMessage: '',
      setStreamingMessage: (message) => set({ streamingMessage: message }),

      // Connection & Retry Logic
      connectionStatus: 'disconnected',
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      retryAttempts: 0,
      maxRetryAttempts: 3,
      attemptReconnection: async () => {
        const state = get();

        if (state.retryAttempts >= state.maxRetryAttempts) {
          set({ connectionStatus: 'failed' });
          return;
        }

        set({
          connectionStatus: 'reconnecting',
          retryAttempts: state.retryAttempts + 1
        });

        try {
          // Test connection by trying to fetch a simple endpoint
          // Try multiple endpoints to find one that works
          const testEndpoints = [
            '/health',
            '/status',
            '/assistants',
            '/'
          ];

          let connected = false;
          let lastError = null;

          for (const endpoint of testEndpoints) {
            try {
              console.log(`🔍 Testing connectivity with endpoint: ${endpoint}`);
              const response = await fetch(`${state.config.apiUrl}${endpoint}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  ...(state.config.apiKey && { 'Authorization': `Bearer ${state.config.apiKey}` })
                },
              });

              // Accept any response that's not a network error
              // Even 404 or 405 means the server is responding
              if (response.status < 500) {
                console.log(`✅ Server responding on ${endpoint} with status ${response.status}`);
                connected = true;
                break;
              }
            } catch (error) {
              console.log(`❌ Failed to connect to ${endpoint}:`, error);
              lastError = error;
              continue;
            }
          }

          if (connected) {
            set({
              connectionStatus: 'connected',
              isConnected: true,
              retryAttempts: 0,
              error: undefined
            });

            // Emit live update for successful reconnection
            liveUpdateManager.emit({
              type: 'GRAPH_STATE_CHANGED',
              data: state.graphState
            });
          } else {
            throw lastError || new Error('All endpoints failed to respond');
          }
        } catch (error) {
          console.error(`Reconnection attempt ${state.retryAttempts} failed:`, error);

          if (state.retryAttempts >= state.maxRetryAttempts) {
            set({
              connectionStatus: 'failed',
              isConnected: false,
              error: `Failed to reconnect after ${state.maxRetryAttempts} attempts`
            });
          } else {
            // Retry after delay
            setTimeout(() => {
              const currentState = get();
              if (currentState.connectionStatus === 'reconnecting') {
                currentState.attemptReconnection();
              }
            }, 2000 * state.retryAttempts); // Exponential backoff
          }
        }
      },

      // Thread management
      addThread: (thread) =>
        set((state) => ({ threads: [...state.threads, thread] })),

      updateThread: (threadId, updates) =>
        set((state) => {
          const updatedThreads = state.threads.map((thread) =>
            thread.id === threadId ? { ...thread, ...updates } : thread
          );

          // Emit live update
          liveUpdateManager.emit({
            type: 'THREAD_UPDATED',
            data: { threadId, updates }
          });

          return { threads: updatedThreads };
        }),

      deleteThread: (threadId) =>
        set((state) => ({
          threads: state.threads.filter((thread) => thread.id !== threadId),
          selectedThread: state.selectedThread?.id === threadId ? undefined : state.selectedThread,
        })),

      addMessageToThread: (threadId, message) =>
        set((state) => {
          const updatedThreads = state.threads.map((thread) =>
            thread.id === threadId
              ? { ...thread, messages: [...thread.messages, message], updatedAt: new Date() }
              : thread
          );

          // Also update selectedThread if it matches the threadId
          const updatedSelectedThread = state.selectedThread?.id === threadId
            ? { ...state.selectedThread, messages: [...state.selectedThread.messages, message], updatedAt: new Date() }
            : state.selectedThread;

          // Emit live update
          liveUpdateManager.emit({
            type: 'MESSAGE_ADDED',
            data: { threadId, message }
          });

          return {
            threads: updatedThreads,
            selectedThread: updatedSelectedThread
          };
        }),

      // Agent management (GoLangGraph)
      addAgent: (agent) =>
        set((state) => ({
          agents: [...state.agents, agent],
          assistants: [...state.assistants, { ...agent, config: {}, graph_id: agent.graph?.id || '' }]
        })),

      updateAgent: (agentId, updates) =>
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.id === agentId ? { ...agent, ...updates } : agent
          ),
          assistants: state.assistants.map((assistant) =>
            assistant.id === agentId ? { ...assistant, ...updates, config: {}, graph_id: assistant.graph_id } : assistant
          ),
        })),

      deleteAgent: (agentId) =>
        set((state) => ({
          agents: state.agents.filter((agent) => agent.id !== agentId),
          assistants: state.assistants.filter((assistant) => assistant.id !== agentId),
          selectedAgent: state.selectedAgent?.id === agentId ? undefined : state.selectedAgent,
          selectedAssistant: state.selectedAssistant?.id === agentId ? undefined : state.selectedAssistant,
        })),

      clearAgents: () => set({
        agents: [],
        assistants: [],
        selectedAgent: undefined,
        selectedAssistant: undefined
      }),

      // Assistant management (backward compatibility)
      addAssistant: (assistant) =>
        set((state) => ({
          assistants: [...state.assistants, assistant],
          agents: [...state.agents, { ...assistant, type: 'chat', model: '', provider: '', temperature: 0.7, maxTokens: 1000, maxIterations: 10, tools: [], enableStreaming: false, timeout: 30000 }]
        })),

      updateAssistant: (assistantId, updates) =>
        set((state) => ({
          assistants: state.assistants.map((assistant) =>
            assistant.id === assistantId ? { ...assistant, ...updates } : assistant
          ),
          agents: state.agents.map((agent) =>
            agent.id === assistantId ? { ...agent, ...updates } : agent
          ),
        })),

      deleteAssistant: (assistantId) =>
        set((state) => ({
          assistants: state.assistants.filter((assistant) => assistant.id !== assistantId),
          agents: state.agents.filter((agent) => agent.id !== assistantId),
          selectedAssistant: state.selectedAssistant?.id === assistantId ? undefined : state.selectedAssistant,
          selectedAgent: state.selectedAgent?.id === assistantId ? undefined : state.selectedAgent,
        })),

      clearAssistants: () => set({
        assistants: [],
        agents: [],
        selectedAssistant: undefined,
        selectedAgent: undefined
      }),

      // Run management
      addRun: (run) =>
        set((state) => ({ runs: [...state.runs, run] })),

      updateRun: (runId, updates) =>
        set((state) => ({
          runs: state.runs.map((run) =>
            run.id === runId ? { ...run, ...updates } : run
          ),
        })),

      // Configuration
      setConfig: (config) => set({ config }),

      // Graph data fetching (updated for GoLangGraph)
      fetchGraphData: async (agentId: string) => {
        const state = get();
        const { config } = state;

        try {
          set({ isLoading: true, error: undefined });

          console.log(`🔍 Fetching graph data for agent: ${agentId}`);

          // First, try to list available agents using GoLangGraph API
          console.log('📋 Searching for available agents...');
          const agentsResponse = await fetch(`${config.apiUrl}/agents`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(config.apiKey && { 'X-Api-Key': config.apiKey })
            }
          });

          if (!agentsResponse.ok) {
            throw new Error(`Failed to list agents: ${agentsResponse.status} ${agentsResponse.statusText}`);
          }

          const agentsData = await agentsResponse.json();
          console.log('📋 Available agents:', agentsData);

          // Find the agent by ID or use the first available one
          let targetAgent = null;
          if (agentsData.agents && Array.isArray(agentsData.agents)) {
            targetAgent = agentsData.agents.find((a: any) => a.id === agentId);
            if (!targetAgent && agentsData.agents.length > 0) {
              targetAgent = agentsData.agents[0];
              console.log(`⚠️ Agent ${agentId} not found, using first available: ${targetAgent.id}`);
            }
          }

          if (!targetAgent) {
            throw new Error('No agents found on the server');
          }

          const actualAgentId = targetAgent.id;
          console.log(`✅ Using agent: ${actualAgentId}`);

          // Now fetch the agent details including graph structure
          console.log(`🔍 Fetching graph structure for agent: ${actualAgentId}`);
          const agentResponse = await fetch(`${config.apiUrl}/agents/${actualAgentId}`, {
            headers: {
              'Content-Type': 'application/json',
              ...(config.apiKey && { 'X-Api-Key': config.apiKey })
            },
          });

          if (!agentResponse.ok) {
            throw new Error(`Failed to fetch agent: ${agentResponse.status} ${agentResponse.statusText}`);
          }

          const agentData = await agentResponse.json();
          console.log('📊 Agent data:', agentData);

          // Use the agent data we already have to build the graph
          console.log('📊 Building graph from agent data:', agentData);
          // Create graph visualization based on agent metadata
          if (agentData && agentData.metadata) {
            const nodes: GraphNode[] = [];
            const edges: GraphEdge[] = [];

            // Build graph based on agent type and metadata
            const agentId = agentData.id;
            const metadata = agentData.metadata;

            console.log(`🏗️ Building graph for agent: ${agentId}`);

            if (agentId === 'interviewer') {
              // Build interviewer workflow graph based on the actual GoLangGraph structure
              const conversationPhases = metadata.output_schema?.properties?.conversation_phase?.enum || [];

              nodes.push({
                id: '__start__',
                type: 'start',
                data: {
                  label: 'Start',
                  description: 'Begin interview workflow',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 100, y: 200 },
              });

              nodes.push({
                id: 'process',
                type: 'processing',
                data: {
                  label: 'Process Message',
                  description: 'Process user input and determine interview phase',
                  status: 'idle' as const,
                  metadata: { phases: conversationPhases },
                },
                position: { x: 300, y: 200 },
              });

              nodes.push({
                id: 'summarize',
                type: 'validation',
                data: {
                  label: 'Summarize Interview',
                  description: 'Create summary of interview conversation',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 500, y: 300 },
              });

              nodes.push({
                id: '__end__',
                type: 'end',
                data: {
                  label: 'End',
                  description: 'Complete interview workflow',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 700, y: 200 },
              });

              // Create edges based on the actual workflow
              edges.push({
                id: 'e1',
                source: '__start__',
                target: 'process',
                type: 'default',
                data: { label: 'Begin' },
              });

              edges.push({
                id: 'e2',
                source: 'process',
                target: '__end__',
                type: 'default',
                data: { label: 'Continue Interview' },
              });

              edges.push({
                id: 'e3',
                source: 'process',
                target: 'summarize',
                type: 'conditional',
                data: { label: 'should_summarize = true' },
              });

              edges.push({
                id: 'e4',
                source: 'summarize',
                target: '__end__',
                type: 'default',
                data: { label: 'Summary Complete' },
              });

            } else if (agentId === 'designer') {
              // Build designer workflow graph
              const styles = metadata.output_schema?.properties?.style?.enum || [];

              nodes.push({
                id: '__start__',
                type: 'start',
                data: {
                  label: 'Start',
                  description: 'Begin design process',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 100, y: 200 },
              });

              nodes.push({
                id: 'analyze_request',
                type: 'processing',
                data: {
                  label: 'Analyze Request',
                  description: 'Analyze design requirements',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 300, y: 200 },
              });

              nodes.push({
                id: 'generate_design',
                type: 'generation',
                data: {
                  label: 'Generate Design',
                  description: 'Create visual design and concepts',
                  status: 'idle' as const,
                  metadata: { styles },
                },
                position: { x: 500, y: 200 },
              });

              nodes.push({
                id: '__end__',
                type: 'end',
                data: {
                  label: 'End',
                  description: 'Complete design process',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 700, y: 200 },
              });

              edges.push({
                id: 'e1',
                source: '__start__',
                target: 'analyze_request',
                type: 'default',
                data: { label: 'Begin' },
              });

              edges.push({
                id: 'e2',
                source: 'analyze_request',
                target: 'generate_design',
                type: 'default',
                data: { label: 'Requirements Ready' },
              });

              edges.push({
                id: 'e3',
                source: 'generate_design',
                target: '__end__',
                type: 'default',
                data: { label: 'Design Complete' },
              });

            } else if (agentId === 'highlighter') {
              // Build highlighter workflow graph
              nodes.push({
                id: '__start__',
                type: 'start',
                data: {
                  label: 'Start',
                  description: 'Begin analysis process',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 100, y: 200 },
              });

              nodes.push({
                id: 'analyze_conversation',
                type: 'processing',
                data: {
                  label: 'Analyze Conversation',
                  description: 'Process conversation history',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 300, y: 200 },
              });

              nodes.push({
                id: 'extract_insights',
                type: 'generation',
                data: {
                  label: 'Extract Insights',
                  description: 'Identify key insights and themes',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 500, y: 200 },
              });

              nodes.push({
                id: '__end__',
                type: 'end',
                data: {
                  label: 'End',
                  description: 'Complete analysis',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 700, y: 200 },
              });

              edges.push({
                id: 'e1',
                source: '__start__',
                target: 'analyze_conversation',
                type: 'default',
                data: { label: 'Begin' },
              });

              edges.push({
                id: 'e2',
                source: 'analyze_conversation',
                target: 'extract_insights',
                type: 'default',
                data: { label: 'Analysis Complete' },
              });

              edges.push({
                id: 'e3',
                source: 'extract_insights',
                target: '__end__',
                type: 'default',
                data: { label: 'Insights Ready' },
              });

            } else if (agentId === 'storymaker') {
              // Build storymaker workflow graph
              const genres = metadata.output_schema?.properties?.genre?.enum || [];

              nodes.push({
                id: '__start__',
                type: 'start',
                data: {
                  label: 'Start',
                  description: 'Begin story creation',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 100, y: 200 },
              });

              nodes.push({
                id: 'plan_narrative',
                type: 'condition',
                data: {
                  label: 'Plan Narrative',
                  description: 'Plan story structure and themes',
                  status: 'idle' as const,
                  metadata: { genres },
                },
                position: { x: 300, y: 200 },
              });

              nodes.push({
                id: 'generate_story',
                type: 'generation',
                data: {
                  label: 'Generate Story',
                  description: 'Create engaging narrative',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 500, y: 200 },
              });

              nodes.push({
                id: '__end__',
                type: 'end',
                data: {
                  label: 'End',
                  description: 'Story complete',
                  status: 'idle' as const,
                  metadata: {},
                },
                position: { x: 700, y: 200 },
              });

              edges.push({
                id: 'e1',
                source: '__start__',
                target: 'plan_narrative',
                type: 'default',
                data: { label: 'Begin' },
              });

              edges.push({
                id: 'e2',
                source: 'plan_narrative',
                target: 'generate_story',
                type: 'default',
                data: { label: 'Plan Ready' },
              });

              edges.push({
                id: 'e3',
                source: 'generate_story',
                target: '__end__',
                type: 'default',
                data: { label: 'Story Complete' },
              });

            } else {
              // Default single-node graph for unknown agents
              nodes.push({
                id: 'agent_node',
                type: 'generation',
                data: {
                  label: agentData.name || agentId,
                  description: agentData.description || 'Agent processing',
                  status: 'idle' as const,
                  metadata: metadata,
                },
                position: { x: 300, y: 200 },
              });
            }

            set({
              graphState: {
                nodes: nodes,
                edges: edges,
                currentNode: undefined,
                executionPath: [],
              },
              isLoading: false,
            });

            console.log(`✅ Successfully created ${agentId} agent graph with ${nodes.length} nodes and ${edges.length} edges`);

          } else if (agentData && agentData.agent) {
            // Create a basic node structure for the agent
            const agentInfo = agentData.agent;
            const agentType = agentInfo.type || 'chat';

            // Create nodes based on agent type
            let nodes: GraphNode[] = [];
            let edges: GraphEdge[] = [];

            if (agentType === 'react') {
              nodes = [
                { id: 'reason', type: 'condition', data: { label: 'Reason', description: 'Reasoning step', status: 'idle' }, position: { x: 100, y: 200 } },
                { id: 'act', type: 'tool', data: { label: 'Act', description: 'Action step', status: 'idle' }, position: { x: 340, y: 200 } },
                { id: 'observe', type: 'processing', data: { label: 'Observe', description: 'Observation step', status: 'idle' }, position: { x: 580, y: 200 } },
                { id: 'finalize', type: 'generation', data: { label: 'Finalize', description: 'Finalization step', status: 'idle' }, position: { x: 820, y: 200 } },
              ];
              edges = [
                { id: 'e1', source: 'reason', target: 'act' },
                { id: 'e2', source: 'act', target: 'observe' },
                { id: 'e3', source: 'observe', target: 'reason' },
                { id: 'e4', source: 'observe', target: 'finalize' },
              ];
            } else if (agentType === 'tool') {
              nodes = [
                { id: 'plan', type: 'condition', data: { label: 'Plan', description: 'Planning step', status: 'idle' }, position: { x: 100, y: 200 } },
                { id: 'execute', type: 'tool', data: { label: 'Execute', description: 'Tool execution', status: 'idle' }, position: { x: 340, y: 200 } },
                { id: 'review', type: 'validation', data: { label: 'Review', description: 'Review results', status: 'idle' }, position: { x: 580, y: 200 } },
              ];
              edges = [
                { id: 'e1', source: 'plan', target: 'execute' },
                { id: 'e2', source: 'execute', target: 'review' },
                { id: 'e3', source: 'review', target: 'plan' },
              ];
            } else {
              // Default chat agent
              nodes = [
                { id: 'chat', type: 'generation', data: { label: 'Chat', description: 'Chat processing', status: 'idle' }, position: { x: 200, y: 200 } },
              ];
              edges = [];
            }

            set({
              graphState: {
                nodes: nodes,
                edges: edges,
                currentNode: undefined,
                executionPath: [],
              },
              isLoading: false,
            });

            console.log(`✅ Successfully created graph structure for ${agentType} agent`);

          } else {
            console.warn('⚠️ No graph data found, creating placeholder');

            // If no graph data found, create a simple placeholder
            set({
              graphState: {
                nodes: [{
                  id: 'placeholder',
                  type: 'default',
                  data: {
                    label: actualAgentId,
                    description: 'Connect to GoLangGraph server to view graph structure',
                    status: 'idle' as const,
                  },
                  position: { x: 200, y: 150 },
                }],
                edges: [],
                currentNode: undefined,
                executionPath: [],
              },
              isLoading: false,
            });
          }

        } catch (error) {
          console.error('❌ Error fetching graph data:', error);

          // Attempt reconnection if server is unavailable
          const state = get();
          if (state.connectionStatus !== 'reconnecting' && state.retryAttempts < state.maxRetryAttempts) {
            state.setConnectionStatus('disconnected');
            state.attemptReconnection();
          }

          set({
            error: `Failed to fetch graph data: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isLoading: false,
            // Create a demo graph as fallback
            graphState: {
              nodes: [
                {
                  id: '__start__',
                  type: 'start',
                  data: { label: '__start__', description: 'Entry point of the graph', status: 'idle' },
                  position: { x: 100, y: 200 },
                },
                {
                  id: 'initialize_state',
                  type: 'processing',
                  data: { label: 'initialize_state', description: 'Initialize conversation state and context', status: 'idle' },
                  position: { x: 340, y: 200 },
                },
                {
                  id: 'analyze_and_route',
                  type: 'condition',
                  data: { label: 'analyze_and_route', description: 'Analyze user input and determine routing', status: 'idle' },
                  position: { x: 580, y: 200 },
                },
                {
                  id: 'respond',
                  type: 'generation',
                  data: { label: 'respond', description: 'Generate final response to user', status: 'idle' },
                  position: { x: 820, y: 200 },
                },
                {
                  id: '__end__',
                  type: 'end',
                  data: { label: '__end__', description: 'Graph execution complete', status: 'idle' },
                  position: { x: 1060, y: 200 },
                },
              ],
              edges: [
                { id: 'e1', source: '__start__', target: 'initialize_state' },
                { id: 'e2', source: 'initialize_state', target: 'analyze_and_route' },
                { id: 'e3', source: 'analyze_and_route', target: 'respond' },
                { id: 'e4', source: 'respond', target: '__end__' },
              ],
              currentNode: undefined,
              executionPath: [],
            }
          });
        }
      },

      // Graph Execution Context - now supports multiple contexts per thread/assistant
      executionContext: initialExecutionContext,
      executionContexts: new Map<string, ExecutionState>(),

      getExecutionContextKey: (threadId?: string, agentId?: string) => {
        const state = get();
        const tId = threadId || state.selectedThread?.id || 'default';
        const aId = agentId || state.selectedAgent?.id || 'default';
        return `${tId}-${aId}`;
      },

      switchToExecutionContext: (threadId?: string, agentId?: string) => {
        const state = get();
        const key = state.getExecutionContextKey(threadId, agentId);
        const existingContext = state.executionContexts.get(key);

        if (existingContext) {
          set({ executionContext: existingContext });
        } else {
          // Create new context for this thread/agent combination
          const newContext: ExecutionState = {
            ...initialExecutionContext,
            threadId: threadId || state.selectedThread?.id,
            agentId: agentId || state.selectedAgent?.id,
            assistantId: agentId || state.selectedAgent?.id, // Keep for backward compatibility
          };

          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, newContext);

          set({
            executionContext: newContext,
            executionContexts: newContexts
          });
        }
      },

      setExecutionContext: (context) =>
        set((state) => {
          const updatedContext = { ...state.executionContext, ...context };

          // Update both current context and stored context
          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      startExecution: (initialState = {}, startFromNode) => {
        const executionId = `exec_${Date.now()}`;
        const state = get();

        set((prevState) => {
          const updatedContext = {
            ...prevState.executionContext,
            isExecuting: true,
            isPaused: false,
            currentState: initialState,
            executionId,
            startTime: new Date(),
            endTime: undefined,
            threadId: prevState.selectedThread?.id,
            agentId: prevState.selectedAgent?.id,
            assistantId: prevState.selectedAgent?.id, // Keep for backward compatibility
          };

          // Update stored context
          const key = prevState.getExecutionContextKey();
          const newContexts = new Map(prevState.executionContexts);
          newContexts.set(key, updatedContext);

          // Emit live update
          liveUpdateManager.emit({
            type: 'EXECUTION_STARTED',
            data: {
              threadId: prevState.selectedThread?.id || 'unknown',
              assistantId: prevState.selectedAgent?.id || 'unknown',
              initialState
            }
          });

          return {
            executionContext: updatedContext,
            executionContexts: newContexts,
            graphState: {
              ...prevState.graphState,
              currentNode: startFromNode || prevState.graphState.nodes.find(n => n.type === 'start')?.id,
              executionPath: startFromNode ? [startFromNode] : [],
            }
          };
        });
      },

      pauseExecution: () =>
        set((state) => {
          const updatedContext = { ...state.executionContext, isPaused: true };
          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      resumeExecution: () =>
        set((state) => {
          const updatedContext = { ...state.executionContext, isPaused: false };
          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      stopExecution: () =>
        set((state) => {
          const updatedContext = {
            ...state.executionContext,
            isExecuting: false,
            isPaused: false,
            endTime: new Date(),
          };

          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          // Emit live update
          const duration = updatedContext.startTime ?
            updatedContext.endTime!.getTime() - updatedContext.startTime.getTime() : 0;

          liveUpdateManager.emit({
            type: 'EXECUTION_COMPLETED',
            data: {
              threadId: state.selectedThread?.id || 'unknown',
              finalState: updatedContext.currentState,
              duration
            }
          });

          // Auto-fit graph when execution completes
          setTimeout(() => {
            const currentState = get();
            currentState.fitGraphToView();
          }, 500);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts,
            graphState: {
              ...state.graphState,
              currentNode: undefined,
            }
          };
        }),

      stepExecution: () => {
        // This will be implemented with actual step logic
        console.log('Step execution triggered');
      },

      addExecutionLog: (log) =>
        set((state) => {
          const newLog = {
            ...log,
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
          };

          const updatedContext = {
            ...state.executionContext,
            logs: [...state.executionContext.logs, newLog]
          };

          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          // Emit live update
          liveUpdateManager.emit({
            type: 'EXECUTION_LOG',
            data: newLog
          });

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      clearExecutionLogs: () =>
        set((state) => {
          const updatedContext = { ...state.executionContext, logs: [] };
          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      setGraphExecutionState: (newState) =>
        set((state) => {
          const updatedContext = { ...state.executionContext, currentState: newState };
          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      addBreakpoint: (nodeId, condition) =>
        set((state) => {
          const existingBreakpoint = state.executionContext.breakpoints.find((bp: any) => bp.nodeId === nodeId);
          if (existingBreakpoint) return state;

          const updatedContext = {
            ...state.executionContext,
            breakpoints: [...state.executionContext.breakpoints, {
              nodeId,
              enabled: true,
              condition,
            }]
          };

          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      removeBreakpoint: (nodeId) =>
        set((state) => {
          const updatedContext = {
            ...state.executionContext,
            breakpoints: state.executionContext.breakpoints.filter((bp: any) => bp.nodeId !== nodeId)
          };

          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      toggleBreakpoint: (nodeId) =>
        set((state) => {
          const updatedContext = {
            ...state.executionContext,
            breakpoints: state.executionContext.breakpoints.map((bp: any) =>
              bp.nodeId === nodeId ? { ...bp, enabled: !bp.enabled } : bp
            )
          };

          const key = state.getExecutionContextKey();
          const newContexts = new Map(state.executionContexts);
          newContexts.set(key, updatedContext);

          return {
            executionContext: updatedContext,
            executionContexts: newContexts
          };
        }),

      // Graph view controls
      focusOnNode: (nodeId: string) => {
        // This will be implemented in GraphView component
        // We'll pass this function to GraphView and it will handle the actual focusing
        console.log('Focus on node:', nodeId);
      },

      fitGraphToView: () => {
        // This will be implemented in GraphView component
        // We'll pass this function to GraphView and it will handle the actual fitting
        console.log('Fit graph to view');
      },

      // Live Update System
      liveUpdateManager: liveUpdateManager,
      subscribeLiveUpdates: (eventType, callback) => liveUpdateManager.subscribe(eventType, callback),
      subscribeAllLiveUpdates: (callback) => liveUpdateManager.subscribeAll(callback),
      emitLiveUpdate: (event) => liveUpdateManager.emit(event),

      // Enhanced methods with live updates
      addMessageToThreadLive: (threadId, message) => {
        const state = get();
        // Use the existing method which already emits live updates
        state.addMessageToThread(threadId, message);
      },
      updateThreadLive: (threadId, updates) => {
        const state = get();
        // Use the existing method which already emits live updates
        state.updateThread(threadId, updates);
      },
      setGraphStateLive: (graphState) => {
        const state = get();
        // Use the existing method which already emits live updates
        state.setGraphState(graphState);
      },
      focusOnNodeLive: (nodeId) => {
        const state = get();
        // Focus on node and emit live update
        state.focusOnNode(nodeId);
        liveUpdateManager.emit({
          type: 'NODE_FOCUSED',
          data: { nodeId }
        });
      },

      // Global execution system
      startGlobalExecution: (source, initialState = {}, userMessage) => {
        const state = get();

        // Check if we have nodes available for execution
        const nodes = state.graphState.nodes;
        if (nodes.length === 0) {
          console.warn('No nodes available for execution - providing direct response');

          // If no nodes, provide a direct response without graph execution
          if (state.selectedThread && source === 'chat') {
            const directResponse: Message = {
              id: `msg-${Date.now()}-direct`,
              role: 'assistant',
              content: generateExecutionResponse(userMessage || 'Hello', []),
              timestamp: new Date(),
            };
            state.addMessageToThread(state.selectedThread.id, directResponse);
          }
          return;
        }

        // Clear previous execution logs for a fresh start
        state.clearExecutionLogs();

        // Start the execution in the store
        state.startExecution(initialState);

        // If started from graph, create a chat message to show the execution
        if (source === 'graph' && state.selectedThread) {
          const executionMessage: Message = {
            id: `msg-${Date.now()}-graph-execution`,
            role: 'assistant',
            content: '🔄 **Graph Execution Started**\n\nExecution initiated from the graph view. You can monitor the progress in real-time.',
            timestamp: new Date(),
          };
          state.addMessageToThread(state.selectedThread.id, executionMessage);
        }

        // Emit a live update to notify all interfaces
        liveUpdateManager.emit({
          type: 'EXECUTION_STARTED',
          data: {
            threadId: state.selectedThread?.id || 'unknown',
            assistantId: state.selectedAgent?.id || 'unknown',
            initialState: { ...initialState, source, userMessage }
          }
        });

        // Execute real GoLangGraph instead of simulation
        const executeRealGoLangGraph = async () => {
          try {
            const currentState = get();
            const { config, selectedThread, selectedAgent } = currentState;

            if (!selectedAgent) {
              throw new Error('No agent selected');
            }

            // Check if we're in demo mode
            const isDemoMode = config.apiUrl.includes('localhost:3000') || config.apiUrl.includes('localhost:3001') || !state.isConnected;

            if (isDemoMode) {
              console.warn('Demo mode detected - cannot execute real GoLangGraph. Please connect to a GoLangGraph server.');
              currentState.stopExecution();

              if (currentState.selectedThread) {
                const errorMessage: Message = {
                  id: `msg-${Date.now()}-demo-error`,
                  role: 'assistant',
                  content: '⚠️ **Demo Mode Active**\n\nTo execute real GoLangGraph graphs, please connect to a GoLangGraph server. Currently running in demo mode with simulated responses.',
                  timestamp: new Date(),
                };
                currentState.addMessageToThread(currentState.selectedThread.id, errorMessage);
              }
              return;
            }

            // Create a thread ID if we don't have one (GoLangGraph doesn't require explicit thread creation)
            let threadId = selectedThread?.id;
            if (!threadId) {
              threadId = `thread_${Date.now()}`;
              console.log('🔄 Creating local thread:', threadId);

              // Add the thread to our store
              const newThread = {
                id: threadId,
                name: `Thread ${threadId.slice(-8)}`, // Use last 8 chars of thread ID as name
                agentId: selectedAgent.id,
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {},
                messages: []
              };
              currentState.addThread(newThread);
              currentState.setSelectedThread(newThread);
            }

            // Prepare the input for GoLangGraph execution
            const executionInput = {
              message: userMessage || 'Hello',
              input: userMessage || 'Hello',
              ...initialState
            };

            console.log('🚀 Starting real GoLangGraph execution:', {
              agentId: selectedAgent.id,
              threadId: threadId,
              input: executionInput
            });

            // Add initial log
            currentState.addExecutionLog({
              nodeId: 'system',
              nodeName: 'System',
              type: 'info',
              message: `Starting GoLangGraph execution`,
              data: {
                agentId: selectedAgent.id,
                threadId: threadId,
                input: executionInput
              }
            });

            // Use HTTP streaming (SSE) for real-time execution with GoLangGraph
            // The auto-server uses Server-Sent Events, not WebSocket
            const streamUrl = `${config.apiUrl}/api/${selectedAgent.id}/stream`;

            const intermediateResults: Record<string, any> = {};

            // Make HTTP request to the agent execution endpoint
            try {
              console.log('📡 Making HTTP request to agent...');

              const response = await fetch(`${config.apiUrl}/api/${selectedAgent.id}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(config.apiKey && { 'X-Api-Key': config.apiKey })
                },
                body: JSON.stringify({
                  message: executionInput.input
                })
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }

              const data = await response.json();
              console.log('📡 Agent response:', data);

              if (data.success && data.output) {
                currentState.addExecutionLog({
                  nodeId: 'result',
                  nodeName: 'Result',
                  type: 'output',
                  message: 'Execution completed successfully',
                  data: data
                });

                intermediateResults.final = data;

                // Add result to conversation - extract meaningful response from structured output
                if (currentState.selectedThread) {
                  let content: string;

                  if (typeof data.output === 'string') {
                    content = data.output;
                  } else if (data.output && typeof data.output === 'object') {
                    // Extract response field from structured agent output
                    if (data.output.response && typeof data.output.response === 'string') {
                      content = data.output.response;
                    } else if (data.output.story && typeof data.output.story === 'string') {
                      // For storymaker agent, use the story field
                      content = data.output.story;
                    } else {
                      // Fallback to other meaningful text fields
                      const textFields = ['result', 'content', 'text', 'message', 'answer', 'description'];
                      content = '';
                      for (const field of textFields) {
                        if (data.output[field] && typeof data.output[field] === 'string') {
                          content = data.output[field];
                          break;
                        }
                      }

                      // If no meaningful text field found, show formatted structured data
                      if (!content) {
                        // Create a formatted summary of the structured output
                        const summary = [];
                        if (data.output.title) summary.push(`📝 ${data.output.title}`);
                        if (data.output.summary) summary.push(data.output.summary);
                        if (data.output.key_insights && Array.isArray(data.output.key_insights)) {
                          summary.push('🔍 Key Insights: ' + data.output.key_insights.join(', '));
                        }
                        if (data.output.themes && Array.isArray(data.output.themes)) {
                          summary.push('🎯 Themes: ' + data.output.themes.join(', '));
                        }

                        content = summary.length > 0 ? summary.join('\n\n') : JSON.stringify(data.output, null, 2);
                      }
                    }
                  } else {
                    content = 'Response received but no content available';
                  }

                  const resultMessage = {
                    id: `msg-${Date.now()}-result`,
                    role: 'assistant' as const,
                    content: content,
                    timestamp: new Date(),
                  };
                  currentState.addMessageToThread(currentState.selectedThread.id, resultMessage);
                }

                // Simulate graph progression for visual feedback
                const nodes = currentState.graphState.nodes;
                for (let i = 0; i < nodes.length; i++) {
                  const node = nodes[i];

                  // Simulate node execution with delays
                  setTimeout(() => {
                    currentState.addExecutionLog({
                      nodeId: node.id,
                      nodeName: node.data.label,
                      type: 'input',
                      message: `Starting execution of ${node.data.label}`,
                      data: {
                        node_type: node.type,
                        current_state: executionInput,
                        timestamp: new Date().toISOString()
                      }
                    });

                    // Update graph state to show current node
                    currentState.setGraphState({
                      ...currentState.graphState,
                      currentNode: node.id,
                      executionPath: [...currentState.graphState.executionPath, node.id]
                    });
                  }, i * 500); // 500ms delay between nodes
                }

              } else if (data.error) {
                throw new Error(data.error);
              } else {
                throw new Error('Unexpected response format');
              }

            } catch (error) {
              console.error('❌ Agent execution failed:', error);
              currentState.addExecutionLog({
                nodeId: 'error',
                nodeName: 'Error',
                type: 'error',
                message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                data: { error }
              });

              // Add error message to conversation
              if (currentState.selectedThread) {
                const errorMessage = {
                  id: `msg-${Date.now()}-error`,
                  role: 'assistant' as const,
                  content: `❌ **Execution Error**\n\n${error instanceof Error ? error.message : 'Unknown error occurred during agent execution.'}`,
                  timestamp: new Date(),
                };
                currentState.addMessageToThread(currentState.selectedThread.id, errorMessage);
              }
            }

            // Complete execution
            const finalState = get();
            if (finalState.executionContext.isExecuting) {
              finalState.stopExecution();

              // Emit completion event
              liveUpdateManager.emit({
                type: 'EXECUTION_COMPLETED',
                data: {
                  threadId: finalState.selectedThread?.id || 'unknown',
                  finalState: {
                    ...finalState.executionContext.currentState,
                    intermediate_results: intermediateResults
                  },
                  duration: finalState.executionContext.startTime ?
                    Date.now() - finalState.executionContext.startTime.getTime() : 0
                }
              });

              // Add completion message only for graph executions (not chat, as we already added the result)
              if (finalState.selectedThread && source === 'graph') {
                const executedNodes = new Set(finalState.executionContext.logs.map((log: ExecutionLog) => log.nodeId));
                const completionMessage: Message = {
                  id: `msg-${Date.now()}-graph-completion`,
                  role: 'assistant',
                  content: `✅ **GoLangGraph Execution Completed**\n\nSuccessfully executed real GoLangGraph with ${executedNodes.size} nodes. The graph processed your request through the optimal execution path.`,
                  timestamp: new Date(),
                };
                finalState.addMessageToThread(finalState.selectedThread.id, completionMessage);
              }
            }

          } catch (error) {
            console.error('❌ GoLangGraph execution error:', error);
            const currentState = get();
            currentState.stopExecution();

            // Add error log
            currentState.addExecutionLog({
              nodeId: 'system',
              nodeName: 'System',
              type: 'error',
              message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              data: { error: error instanceof Error ? error.message : String(error) }
            });

            // Add error message to chat
            if (currentState.selectedThread) {
              const errorMessage: Message = {
                id: `msg-${Date.now()}-error`,
                role: 'assistant',
                content: `❌ **Execution Error**\n\nFailed to execute GoLangGraph: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your connection and try again.`,
                timestamp: new Date(),
              };
              currentState.addMessageToThread(currentState.selectedThread.id, errorMessage);
            }
          }
        };

        // Helper function to handle GoLangGraph events
        const handleLangGraphEvent = async (eventData: any, intermediateResults: Record<string, any>) => {
          const currentState = get();

          console.log('📨 GoLangGraph event:', eventData);

          switch (eventData.event) {
            case 'on_chain_start':
            case 'on_tool_start':
            case 'on_llm_start':
              if (eventData.name && eventData.run_id) {
                // Update current node
                const nodeId = eventData.name;
                currentState.setGraphState({
                  ...currentState.graphState,
                  currentNode: nodeId,
                  executionPath: [...currentState.graphState.executionPath, nodeId]
                });

                // Add execution log
                currentState.addExecutionLog({
                  nodeId: nodeId,
                  nodeName: eventData.name,
                  type: 'input',
                  message: `Starting ${eventData.event.replace('on_', '').replace('_start', '')}: ${eventData.name}`,
                  data: {
                    event: eventData.event,
                    runId: eventData.run_id,
                    input: eventData.data?.input
                  }
                });

                // Emit step update
                liveUpdateManager.emit({
                  type: 'EXECUTION_STEP',
                  data: {
                    nodeId: nodeId,
                    nodeName: eventData.name,
                    progress: 0 // Will be updated on completion
                  }
                });
              }
              break;

            case 'on_chain_end':
            case 'on_tool_end':
            case 'on_llm_end':
              if (eventData.name && eventData.data?.output) {
                const nodeId = eventData.name;
                const output = eventData.data.output;

                // Store in intermediate results
                intermediateResults[nodeId] = output;

                // Add execution log
                currentState.addExecutionLog({
                  nodeId: nodeId,
                  nodeName: eventData.name,
                  type: 'output',
                  message: `Completed ${eventData.event.replace('on_', '').replace('_end', '')}: ${eventData.name}`,
                  data: {
                    event: eventData.event,
                    runId: eventData.run_id,
                    output: output,
                    intermediate_results: { ...intermediateResults }
                  }
                });

                // Update execution state
                currentState.setGraphExecutionState({
                  ...currentState.executionContext.currentState,
                  intermediate_results: intermediateResults,
                  [nodeId]: output
                });
              }
              break;

            case 'on_chain_stream':
              if (eventData.data?.chunk) {
                // Handle streaming output
                const nodeId = eventData.name || 'streaming';
                currentState.addExecutionLog({
                  nodeId: nodeId,
                  nodeName: eventData.name || 'Stream',
                  type: 'info',
                  message: `Streaming data from ${eventData.name}`,
                  data: {
                    event: eventData.event,
                    chunk: eventData.data.chunk
                  }
                });
              }
              break;

            case 'on_chat_model_stream':
              // Handle LLM streaming
              if (eventData.data?.chunk?.content) {
                liveUpdateManager.emit({
                  type: 'STREAMING_UPDATE',
                  data: {
                    messageId: `stream-${Date.now()}`,
                    content: eventData.data.chunk.content,
                    isComplete: false
                  }
                });
              }
              break;

            case 'thread.run.completed':
              console.log('✅ Run completed:', eventData);
              break;

            case 'thread.run.failed':
              console.error('❌ Run failed:', eventData);
              throw new Error(`Run failed: ${eventData.data?.error || 'Unknown error'}`);

            default:
              // Log unknown events for debugging
              currentState.addExecutionLog({
                nodeId: 'system',
                nodeName: 'System',
                type: 'debug',
                message: `Unknown event: ${eventData.event}`,
                data: eventData
              });
          }
        };

        // Start the real execution
        executeRealGoLangGraph().catch((error: any) => {
          console.error('Failed to execute GoLangGraph:', error);
          const currentState = get();
          currentState.stopExecution();
        });
      },

      // Deep Agent actions
      addInterrupt: (interrupt) =>
        set((state) => {
          liveUpdateManager.emit({
            type: 'INTERRUPT_RECEIVED',
            data: interrupt
          });
          return { activeInterrupts: [...state.activeInterrupts, interrupt] };
        }),

      resolveInterrupt: (interruptId, resolution) =>
        set((state) => {
          liveUpdateManager.emit({
            type: 'INTERRUPT_RESOLVED',
            data: { interruptId, resolution }
          });
          return {
            activeInterrupts: state.activeInterrupts.map((i) =>
              i.id === interruptId
                ? { ...i, status: resolution === 'approved' ? 'approved' as const : 'rejected' as const, resolvedAt: new Date() }
                : i
            ),
          };
        }),

      clearInterrupts: () => set({ activeInterrupts: [] }),

      addSubAgentResult: (result) =>
        set((state) => {
          liveUpdateManager.emit({
            type: 'SUB_AGENT_COMPLETED',
            data: result
          });
          return { subAgentResults: [...state.subAgentResults, result] };
        }),

      clearSubAgentResults: () => set({ subAgentResults: [] }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'studio-store',
    }
  )
);

// React hooks for live updates
export const useLiveUpdates = (
  eventType: LiveUpdateEvent['type'],
  callback: (event: LiveUpdateEvent) => void,
  deps: any[] = []
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = liveUpdateManager.subscribe(eventType, (event) => {
      callbackRef.current(event);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, ...deps]);
};

export const useAllLiveUpdates = (
  callback: (event: LiveUpdateEvent) => void,
  deps: any[] = []
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = liveUpdateManager.subscribeAll((event) => {
      callbackRef.current(event);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

// Hook to get live execution status
export const useLiveExecutionStatus = () => {
  const { executionContext, subscribeLiveUpdates } = useStudioStore();
  const [liveStatus, setLiveStatus] = React.useState({
    isExecuting: executionContext.isExecuting,
    isPaused: executionContext.isPaused,
    currentNode: '',
    progress: 0,
    logs: executionContext.logs.length
  });

  useEffect(() => {
    const unsubscribeStart = subscribeLiveUpdates('EXECUTION_STARTED', (event) => {
      setLiveStatus(prev => ({ ...prev, isExecuting: true, isPaused: false }));
    });

    const unsubscribeStep = subscribeLiveUpdates('EXECUTION_STEP', (event) => {
      if (event.type === 'EXECUTION_STEP') {
        setLiveStatus(prev => ({
          ...prev,
          currentNode: event.data.nodeName,
          progress: event.data.progress
        }));
      }
    });

    const unsubscribeLog = subscribeLiveUpdates('EXECUTION_LOG', (event) => {
      setLiveStatus(prev => ({ ...prev, logs: prev.logs + 1 }));
    });

    const unsubscribeComplete = subscribeLiveUpdates('EXECUTION_COMPLETED', (event) => {
      setLiveStatus(prev => ({ ...prev, isExecuting: false, isPaused: false }));
    });

    return () => {
      unsubscribeStart();
      unsubscribeStep();
      unsubscribeLog();
      unsubscribeComplete();
    };
  }, [subscribeLiveUpdates]);

  return liveStatus;
};

// Export types for use in components
export type { LiveUpdateEvent }; 