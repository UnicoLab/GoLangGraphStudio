import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowDownIcon,
  BoltIcon,
  CheckCircleIcon,
  CubeTransparentIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { GraphExecution, PipelineNode, PipelineSchema } from '../../types';
import { useStudioStore } from '../../store/useStudioStore';

const nodeId = () => `step-${Math.random().toString(36).slice(2, 8)}`;
const pipelineId = () => `pipeline-${Date.now().toString(36)}`;

/**
 * Visual authoring for the server's safe sequential-agent pipeline contract.
 * It never pretends custom Go node functions can be created in a browser;
 * Studio creates a real executable graph only from existing live agents.
 */
export const PipelineLabView: React.FC = () => {
  const { agents, graphs, loadGraphs, createPipeline, deletePipeline, executeGraph, principal, darkMode } = useStudioStore();
  const [id, setId] = useState(pipelineId);
  const [name, setName] = useState('Untitled pipeline');
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [input, setInput] = useState('');
  const [runtimeState, setRuntimeState] = useState('{}');
  const [inputSchema, setInputSchema] = useState('{}');
  const [outputSchema, setOutputSchema] = useState('{}');
  const [lastRun, setLastRun] = useState<GraphExecution>();
  const [busy, setBusy] = useState(false);
  const [selectedGraph, setSelectedGraph] = useState<string>();

  useEffect(() => { loadGraphs().catch(() => undefined); }, [loadGraphs]);
  const agentByID = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const canAuthor = principal?.role === 'author' || principal?.role === 'admin';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const surface = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const control = `w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${darkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  const addNode = () => {
    const firstUnused = agents.find((agent) => !nodes.some((node) => node.agent_id === agent.id)) ?? agents[0];
    if (!firstUnused) { toast.error('Create an agent before adding a pipeline step.'); return; }
    setNodes((current) => [...current, { id: nodeId(), agent_id: firstUnused.id }]);
  };
  const updateNode = (index: number, field: keyof PipelineNode, value: string) => setNodes((current) => current.map((node, currentIndex) => currentIndex === index ? { ...node, [field]: value } : node));
  const reset = () => { setId(pipelineId()); setName('Untitled pipeline'); setNodes(agents[0] ? [{ id: nodeId(), agent_id: agents[0].id }] : []); setInputSchema('{}'); setOutputSchema('{}'); setRuntimeState('{}'); setLastRun(undefined); };

  const parseObject = (value: string, label: string): Record<string, unknown> | undefined => {
    try {
      const parsed = JSON.parse(value || '{}');
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('must be a JSON object');
      return parsed as Record<string, unknown>;
    } catch (error) { toast.error(`${label} ${error instanceof Error ? error.message : 'is invalid JSON'}`); return undefined; }
  };

  const publish = async () => {
    if (!canAuthor) { toast.error('An author or admin API key is required to publish pipelines.'); return; }
    if (!id.trim() || !name.trim() || nodes.length === 0 || nodes.some((node) => !node.agent_id)) { toast.error('Give the pipeline a name and add at least one agent step.'); return; }
    setBusy(true);
    try {
      const parsedInputSchema = parseObject(inputSchema, 'Input contract');
      const parsedOutputSchema = parseObject(outputSchema, 'Output contract');
      if (!parsedInputSchema || !parsedOutputSchema) return;
      const graph = await createPipeline({ id: id.trim(), name: name.trim(), nodes, input_schema: parsedInputSchema as PipelineSchema, output_schema: parsedOutputSchema as PipelineSchema });
      setSelectedGraph(graph.id);
      toast.success(`Published ${graph.name}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
  };

  const run = async () => {
    const target = selectedGraph ?? id.trim();
    if (!target) { toast.error('Publish the pipeline before running it.'); return; }
    const parsedState = parseObject(runtimeState, 'Runtime state');
    if (!parsedState) return;
    setBusy(true);
    try {
      const result = await executeGraph(target, input, parsedState);
      setLastRun(result);
      toast[result.status === 'completed' ? 'success' : 'error'](`Pipeline ${result.status}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
  };

  return (
    <div className="h-full overflow-y-auto p-5 lg:p-7">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div><p className={`text-xs font-semibold uppercase tracking-[0.18em] ${muted}`}>Pipeline Lab</p><h2 className={`mt-1 text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Compose live agents into an executable graph.</h2><p className={`mt-2 max-w-3xl text-sm ${muted}`}>Each step calls a registered GoLangGraph agent and feeds its output to the next one. The server validates every referenced agent before it publishes the graph.</p></div>
          <button onClick={reset} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>New draft</button>
        </div>
        {!canAuthor && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${darkMode ? 'border-amber-500/30 bg-amber-950/20 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>Pipeline authoring is locked for this <strong>{principal?.role ?? 'unknown'}</strong> session. An <strong>author</strong> or <strong>admin</strong> key is required to publish or delete pipelines.</div>}
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className={`h-fit rounded-2xl border p-5 space-y-4 ${surface}`}>
            <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Pipeline settings</h3>
            <Field label="Pipeline ID"><input disabled={!canAuthor} value={id} onChange={(event) => setId(event.target.value)} className={control} /></Field>
            <Field label="Display name"><input disabled={!canAuthor} value={name} onChange={(event) => setName(event.target.value)} className={control} /></Field>
            <Field label="Input contract (JSON)"><textarea disabled={!canAuthor} value={inputSchema} onChange={(event) => setInputSchema(event.target.value)} className={`${control} min-h-20 font-mono text-xs`} placeholder={'{"query":{"type":"string","required":true}}'} /></Field>
            <Field label="Output contract (JSON)"><textarea disabled={!canAuthor} value={outputSchema} onChange={(event) => setOutputSchema(event.target.value)} className={`${control} min-h-20 font-mono text-xs`} placeholder={'{"last_output":{"type":"string","required":true}}'} /></Field>
            <div className={`rounded-xl border p-3 text-xs leading-relaxed ${darkMode ? 'border-blue-500/30 bg-blue-950/20 text-blue-200' : 'border-blue-100 bg-blue-50 text-blue-800'}`}><strong>Safe by design.</strong> Studio can publish sequential agent pipelines. Custom Go functions, conditional routes, and arbitrary code remain application-owned capabilities and are not emulated here.</div>
            <button onClick={publish} disabled={busy || !agents.length || !canAuthor} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700"><CheckCircleIcon className="w-4 h-4" />{busy ? 'Working…' : 'Publish pipeline'}</button>
          </aside>

          <section className={`min-h-[520px] rounded-2xl border p-5 ${surface}`}>
            <div className="flex items-center justify-between"><div><h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Visual flow</h3><p className={`mt-0.5 text-xs ${muted}`}>Drag-free, keyboard-friendly authoring for a deterministic execution order.</p></div><button disabled={!canAuthor} onClick={addNode} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${darkMode ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><PlusIcon className="w-4 h-4" /> Add agent</button></div>
            <div className="mx-auto mt-8 max-w-xl">
              {nodes.length === 0 ? <div className={`rounded-xl border border-dashed py-16 text-center text-sm ${muted}`}>Add an agent to begin a pipeline.</div> : nodes.map((node, index) => {
                const agent = agentByID.get(node.agent_id);
                return <React.Fragment key={node.id}>
                  <div className={`rounded-2xl border p-4 shadow-sm ${darkMode ? 'border-gray-600 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-violet-500/10 p-2 text-violet-500"><CubeTransparentIcon className="w-5 h-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Step {index + 1}</p><button onClick={() => setNodes((current) => current.filter((_, currentIndex) => currentIndex !== index))} disabled={nodes.length === 1 || !canAuthor} className="text-red-500 disabled:opacity-30" title="Remove step"><TrashIcon className="w-4 h-4" /></button></div><select disabled={!canAuthor} className={`${control} mt-2`} value={node.agent_id} onChange={(event) => updateNode(index, 'agent_id', event.target.value)}>{agents.map((choice) => <option key={choice.id} value={choice.id}>{choice.name} · {choice.provider}/{choice.model}</option>)}</select><input disabled={!canAuthor} className={`${control} mt-2`} value={node.name ?? ''} onChange={(event) => updateNode(index, 'name', event.target.value)} placeholder={agent?.name ?? 'Optional step label'} /></div></div>
                  </div>
                  {index < nodes.length - 1 && <div className="flex h-12 flex-col items-center justify-center text-blue-500"><span className="h-5 border-l-2 border-current" /><ArrowDownIcon className="w-5 h-5" /></div>}
                </React.Fragment>;
              })}
            </div>
          </section>

          <aside className="space-y-5">
            <section className={`rounded-2xl border p-5 ${surface}`}><div className="flex items-center gap-2"><BoltIcon className="w-5 h-5 text-amber-500" /><h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Run lab</h3></div><p className={`mt-1 text-xs ${muted}`}>Runs the published graph and returns per-node state snapshots.</p><textarea value={input} onChange={(event) => setInput(event.target.value)} className={`${control} mt-4 min-h-20 resize-y`} placeholder="Test input…" /><textarea value={runtimeState} onChange={(event) => setRuntimeState(event.target.value)} className={`${control} mt-3 min-h-20 font-mono text-xs`} placeholder="Runtime state JSON, e.g. {&quot;query&quot;:&quot;...&quot;}" /><button onClick={run} disabled={busy || !(selectedGraph ?? id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-emerald-700"><PlayIcon className="w-4 h-4" /> Run pipeline</button></section>
            {lastRun && <RunResult run={lastRun} darkMode={darkMode} />}
            <section className={`rounded-2xl border p-5 ${surface}`}><h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Registered graphs</h3><div className="mt-3 space-y-2">{graphs.length === 0 ? <p className={`text-xs ${muted}`}>No registered graphs yet.</p> : graphs.map((graph) => <div key={graph.id} className={`rounded-xl border p-3 ${selectedGraph === graph.id ? 'border-blue-500' : darkMode ? 'border-gray-700' : 'border-gray-200'}`}><button onClick={() => setSelectedGraph(graph.id)} className="w-full text-left"><p className={`truncate text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{graph.name}</p><p className={`mt-0.5 text-[11px] ${muted}`}>{graph.node_count} nodes · {graph.edge_count} edges</p></button><button disabled={!canAuthor} onClick={async () => { try { await deletePipeline(graph.id); if (selectedGraph === graph.id) setSelectedGraph(undefined); toast.success('Pipeline deleted'); } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); } }} className="mt-2 text-[11px] text-red-500 hover:underline disabled:opacity-30">Delete if Studio pipeline</button></div>)}</div></section>
          </aside>
        </div>
      </div>
    </div>
  );
};

const RunResult: React.FC<{ run: GraphExecution; darkMode: boolean }> = ({ run, darkMode }) => <section className={`rounded-2xl border p-5 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}><div className="flex items-center justify-between"><h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Last run</h3><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${run.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>{run.status}</span></div>{run.error && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-600">{run.error}</p>}<ol className="mt-3 space-y-2">{run.steps.map((step) => <li key={`${step.node_id}-${step.step}`} className={`rounded-lg px-3 py-2 text-xs ${darkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-700'}`}><div className="flex justify-between gap-2"><span className="truncate font-medium">{step.node_id}</span><span>{step.duration_ms.toFixed(1)}ms</span></div>{step.error && <p className="mt-1 text-red-500">{step.error}</p>}</li>)}</ol></section>;
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block"><span className="mb-1.5 block text-xs font-medium text-gray-500">{label}</span>{children}</label>;
