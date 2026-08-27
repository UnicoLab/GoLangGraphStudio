import React, { useEffect, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, ClockIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { extractOutputText } from '../../api/client';
import { formatDuration } from '../../types';
import { useStudioStore } from '../../store/useStudioStore';

/** A real run catalogue: agent history comes from the server, graph runs from this Studio session. */
export const RunsView: React.FC = () => {
  const { selectedAgent, agentHistory, loadAgentHistory, pipelineRuns, darkMode } = useStudioStore();
  const selectedAgentID = selectedAgent?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = async () => {
    if (!selectedAgent) return;
    setLoading(true); setError(undefined);
    try { await loadAgentHistory(selectedAgent.id); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setLoading(false); }
  };
  useEffect(() => {
    if (!selectedAgentID) return;
    let current = true;
    void loadAgentHistory(selectedAgentID).catch((cause) => {
      if (current) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { current = false; };
  }, [loadAgentHistory, selectedAgentID]);
  const surface = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';

  return <div className="h-full overflow-y-auto p-5 lg:p-7"><div className="max-w-6xl mx-auto"><div className="flex flex-wrap items-start justify-between gap-4 mb-6"><div><p className={`text-xs font-semibold uppercase tracking-[0.18em] ${muted}`}>Run explorer</p><h2 className={`mt-1 text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Inspect history, failures, and graph-state checkpoints.</h2><p className={`mt-2 text-sm ${muted}`}>Agent history is persisted by the connected GoLangGraph runtime; pipeline results are retained for this Studio session.</p></div><button onClick={refresh} disabled={!selectedAgent || loading} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${darkMode ? 'border-gray-600 text-gray-100 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}><ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div><div className="grid gap-6 lg:grid-cols-2"><section className={`rounded-2xl border p-5 ${surface}`}><div className="flex items-center justify-between"><div><h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Agent history</h3><p className={`mt-0.5 text-xs ${muted}`}>{selectedAgent ? selectedAgent.name : 'Select an agent in the header'}</p></div><span className={`rounded-full px-2 py-1 text-xs ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{agentHistory.length}</span></div>{error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-600">{error}</p>}<div className="mt-4 space-y-3">{agentHistory.length === 0 ? <Empty text={selectedAgent ? 'No executions recorded for this agent.' : 'Choose an agent to load its execution history.'} muted={muted} /> : agentHistory.map((run) => <article key={run.id} className={`rounded-xl border p-3 ${darkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2">{run.success ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> : <ExclamationCircleIcon className="w-4 h-4 text-red-500" />}<span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{run.success ? 'Completed' : 'Failed'}</span></div><span className={`flex items-center gap-1 text-xs ${muted}`}><ClockIcon className="w-3.5 h-3.5" />{formatDuration(run.duration)}</span></div><p className={`mt-2 line-clamp-2 text-xs ${muted}`}>Input: {run.input}</p>{run.error && <p className="mt-2 text-xs text-red-500">{run.error}</p>}<pre className={`mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg p-2 text-[11px] ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`}>{extractOutputText(run.output) || 'No output'}</pre></article>)}</div></section><section className={`rounded-2xl border p-5 ${surface}`}><div className="flex items-center justify-between"><div><h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Pipeline runs</h3><p className={`mt-0.5 text-xs ${muted}`}>Per-step states from Pipeline Lab</p></div><span className={`rounded-full px-2 py-1 text-xs ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{pipelineRuns.length}</span></div><div className="mt-4 space-y-3">{pipelineRuns.length === 0 ? <Empty text="Run a published pipeline to inspect node-level checkpoints here." muted={muted} /> : pipelineRuns.map((run, index) => <article key={`${run.graph_id}-${index}`} className={`rounded-xl border p-3 ${darkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}><div className="flex items-center justify-between"><span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{run.graph_id}</span><span className={`text-xs font-semibold ${run.status === 'completed' ? 'text-emerald-500' : 'text-red-500'}`}>{run.status}</span></div>{run.error && <p className="mt-2 text-xs text-red-500">{run.error}</p>}<div className="mt-3 space-y-2">{run.steps.map((step) => <div key={`${step.node_id}-${step.step}`} className={`rounded-lg p-2 text-xs ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`}><div className="flex justify-between gap-2"><span>{step.node_id}</span><span>{step.duration_ms.toFixed(1)}ms</span></div>{step.error && <p className="mt-1 text-red-500">{step.error}</p>}{step.state && <details className="mt-1.5"><summary className="cursor-pointer text-[11px] text-blue-500">State checkpoint</summary><pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(step.state, null, 2)}</pre></details>}</div>)}</div></article>)}</div></section></div></div></div>;
};
const Empty: React.FC<{ text: string; muted: string }> = ({ text, muted }) => <p className={`py-12 text-center text-sm ${muted}`}>{text}</p>;
