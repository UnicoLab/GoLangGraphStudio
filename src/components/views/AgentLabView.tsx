import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { AgentConfig, AgentType } from '../../types';
import { useStudioStore } from '../../store/useStudioStore';

const emptyAgent = (): AgentConfig => ({
  id: '', name: '', type: 'chat', model: '', provider: '', system_prompt: '',
  temperature: 0.7, max_tokens: 1000, max_iterations: 10, tools: [],
  enable_streaming: false, timeout: 30_000_000_000, metadata: {},
});

const label = (text: string) => text.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

/** A production-backed editor for the API's agent CRUD endpoints. */
export const AgentLabView: React.FC = () => {
  const { agents, providers, tools, selectedAgent, selectAgent, createAgent, updateAgent, deleteAgent, principal, darkMode } = useStudioStore();
  const [draft, setDraft] = useState<AgentConfig>(emptyAgent);
  const [editingId, setEditingId] = useState<string>();
  const [busy, setBusy] = useState(false);

  const providerNames = useMemo(() => providers.map((provider) => provider.name), [providers]);
  const canAuthor = principal?.role === 'author' || principal?.role === 'admin';

  const startCreate = () => {
    setEditingId(undefined);
    setDraft({ ...emptyAgent(), provider: providerNames[0] ?? '', model: String(providers[0]?.model ?? '') });
  };

  const startEdit = (agent: AgentConfig) => {
    setEditingId(agent.id);
    setDraft({ ...agent, tools: [...(agent.tools ?? [])] });
  };

  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleTool = (tool: string) => setDraft((current) => ({
    ...current,
    tools: current.tools.indexOf(tool) >= 0 ? current.tools.filter((value) => value !== tool) : [...current.tools, tool],
  }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAuthor) { toast.error('An author or admin API key is required to change agents.'); return; }
    if (!draft.name.trim() || !draft.provider.trim() || !draft.model.trim()) {
      toast.error('Name, provider, and model are required.');
      return;
    }
    setBusy(true);
    try {
      const saved = editingId
        ? await updateAgent(editingId, { ...draft, id: editingId, name: draft.name.trim() })
        : await createAgent({ ...draft, name: draft.name.trim() });
      toast.success(editingId ? `Updated ${saved.name}` : `Created ${saved.name}`);
      startCreate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (agent: AgentConfig) => {
    if (!canAuthor) { toast.error('An author or admin API key is required to delete agents.'); return; }
    if (!window.confirm(`Delete agent “${agent.name}”? Existing pipelines that use it will fail safely until repaired.`)) return;
    setBusy(true);
    try {
      await deleteAgent(agent.id);
      if (editingId === agent.id) startCreate();
      toast.success(`Deleted ${agent.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const surface = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const control = `w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${darkMode ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  return (
    <div className="h-full overflow-y-auto p-5 lg:p-7">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${muted}`}>Agent Lab</p>
            <h2 className={`mt-1 text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Build agents, then test them in context.</h2>
            <p className={`mt-2 max-w-2xl text-sm ${muted}`}>Changes are saved directly through GoLangGraph’s agent API. Models and tools stay visible so a draft cannot quietly diverge from the server.</p>
          </div>
          <button disabled={!canAuthor} onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <PlusIcon className="w-4 h-4" /> New agent
          </button>
        </div>

        {!canAuthor && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${darkMode ? 'border-amber-500/30 bg-amber-950/20 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>This session has <strong>{principal?.role ?? 'unknown'}</strong> access. Viewing and testing remain available; agent changes require an <strong>author</strong> or <strong>admin</strong> key.</div>}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="space-y-3">
            {agents.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-12 text-center ${surface}`}>
                <SparklesIcon className="w-9 h-9 mx-auto text-blue-500" />
                <h3 className={`mt-3 font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>No agents on this server</h3>
                <p className={`mt-1 text-sm ${muted}`}>Use the form to create the first live agent.</p>
              </div>
            ) : agents.map((agent) => {
              const selected = selectedAgent?.id === agent.id;
              return (
                <article key={agent.id} className={`rounded-2xl border p-4 transition-colors ${selected ? 'border-blue-500 ring-2 ring-blue-500/15' : ''} ${surface}`}>
                  <div className="flex gap-4">
                    <button onClick={() => selectAgent(agent)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500"><SparklesIcon className="w-5 h-5" /></div>
                        <div className="min-w-0">
                          <h3 className={`font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{agent.name}</h3>
                          <p className={`text-xs ${muted}`}>{agent.provider}/{agent.model} · {label(agent.type)}</p>
                        </div>
                      </div>
                      {agent.system_prompt && <p className={`mt-3 line-clamp-2 text-sm ${muted}`}>{agent.system_prompt}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {agent.tools.map((tool) => <span key={tool} className={`rounded-md px-2 py-1 text-[11px] ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{tool}</span>)}
                        {agent.enable_streaming && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-600">Streaming</span>}
                      </div>
                    </button>
                    <div className="flex flex-col gap-2">
                      <button disabled={!canAuthor} onClick={() => startEdit(agent)} className={`rounded-lg p-2 disabled:opacity-30 ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title={`Edit ${agent.name}`}><PencilSquareIcon className="w-4 h-4" /></button>
                      <button disabled={!canAuthor} onClick={() => remove(agent)} className={`rounded-lg p-2 disabled:opacity-30 ${darkMode ? 'hover:bg-red-950 text-red-300' : 'hover:bg-red-50 text-red-600'}`} title={`Delete ${agent.name}`}><TrashIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <form onSubmit={submit} className={`h-fit rounded-2xl border p-5 space-y-4 shadow-sm ${surface}`}>
            <fieldset disabled={!canAuthor} className="space-y-4 disabled:opacity-55">
            <div className="flex items-center justify-between">
              <div><h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{editingId ? 'Edit live agent' : 'New live agent'}</h3><p className={`mt-0.5 text-xs ${muted}`}>{editingId ? 'Updates replace the current runtime config.' : 'Created on the connected server.'}</p></div>
              <WrenchScrewdriverIcon className="w-5 h-5 text-blue-500" />
            </div>
            <Field label="Name"><input className={control} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Research assistant" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><select className={control} value={draft.type} onChange={(event) => update('type', event.target.value as AgentType)}>{(['chat', 'react', 'tool'] as AgentType[]).map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></Field>
              <Field label="Temperature"><input className={control} type="number" min="0" max="2" step="0.1" value={draft.temperature} onChange={(event) => update('temperature', Number(event.target.value))} /></Field>
            </div>
            <Field label="Provider"><select className={control} value={draft.provider} onChange={(event) => update('provider', event.target.value)}><option value="">Select provider</option>{providerNames.map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></Field>
            <Field label="Model"><input className={control} value={draft.model} onChange={(event) => update('model', event.target.value)} placeholder="gemma3:1b" /></Field>
            <Field label="System prompt"><textarea className={`${control} min-h-24 resize-y`} value={draft.system_prompt ?? ''} onChange={(event) => update('system_prompt', event.target.value)} placeholder="You are a precise, helpful assistant." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max tokens"><input className={control} type="number" min="101" max="100000" value={draft.max_tokens} onChange={(event) => update('max_tokens', Number(event.target.value))} /></Field>
              <Field label="Iterations"><input className={control} type="number" min="1" max="100" value={draft.max_iterations} onChange={(event) => update('max_iterations', Number(event.target.value))} /></Field>
            </div>
            <div><p className={`mb-2 text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Tools</p>{tools.length === 0 ? <p className={`text-xs ${muted}`}>No tools exposed by this server.</p> : <div className="flex flex-wrap gap-2">{tools.map((tool) => <label key={tool} className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs ${draft.tools.indexOf(tool) >= 0 ? 'border-blue-500 bg-blue-500/10 text-blue-600' : darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`}><input className="sr-only" type="checkbox" checked={draft.tools.indexOf(tool) >= 0} onChange={() => toggleTool(tool)} />{tool}</label>)}</div>}</div>
            <label className={`flex cursor-pointer items-center gap-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}><input type="checkbox" checked={draft.enable_streaming} onChange={(event) => update('enable_streaming', event.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Enable streaming</label>
            <button disabled={busy || !canAuthor} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700"><CheckCircleIcon className="w-4 h-4" />{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create agent'}</button>
            </fieldset>
          </form>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label: fieldLabel, children }) => <label className="block"><span className="mb-1.5 block text-xs font-medium text-gray-500">{fieldLabel}</span>{children}</label>;
