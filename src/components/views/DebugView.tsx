import React, { useMemo, useState } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { ExecutionLog, formatDuration } from '../../types';
import { extractOutputText, summariseToolCalls } from '../../api/client';
import { CheckCircleIcon, XCircleIcon, ClipboardDocumentIcon, CheckIcon, ClockIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const levelColor: Record<ExecutionLog['level'], string> = {
  info: 'text-sky-400',
  debug: 'text-gray-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const levelDot: Record<ExecutionLog['level'], string> = {
  info: 'bg-sky-400',
  debug: 'bg-gray-400',
  warn: 'bg-amber-400',
  error: 'bg-red-400',
};

type LogFilter = 'ALL' | ExecutionLog['level'];

export const DebugView: React.FC = () => {
  const { executionLogs, lastExecution, selectedAgent, selectedThread, darkMode } = useStudioStore();
  const [filter, setFilter] = useState<LogFilter>('ALL');

  const filteredLogs = useMemo(
    () => (filter === 'ALL' ? executionLogs : executionLogs.filter((l) => l.level === filter)),
    [executionLogs, filter],
  );

  const tools = summariseToolCalls(lastExecution?.ToolCalls ?? []);

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Summary */}
      <div className={`lg:w-96 border-b lg:border-b-0 lg:border-r overflow-y-auto ${darkMode ? 'border-gray-700/80' : 'border-gray-200'}`}>
        <div className="p-5 space-y-4">
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Last Execution
          </h3>

          {!lastExecution ? (
            <div className={`text-center py-10 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              <p className="text-sm">No execution yet.</p>
              <p className="text-xs mt-1">Send a message in the Chat view to see details here.</p>
            </div>
          ) : (
            <>
              {/* Status card */}
              <div className={`rounded-2xl border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {lastExecution.Success ? (
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-red-500" />
                  )}
                  <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {lastExecution.Status ?? (lastExecution.Success ? 'Completed' : 'Failed')}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <SummaryRow icon={<ClockIcon className="w-4 h-4" />} label="Duration" value={formatDuration(lastExecution.Duration)} darkMode={darkMode} />
                  <SummaryRow icon={<WrenchScrewdriverIcon className="w-4 h-4" />} label="Tool calls" value={String(tools.length)} darkMode={darkMode} />
                  <SummaryRow label="Agent" value={selectedAgent?.name ?? lastExecution.ID} darkMode={darkMode} />
                  <SummaryRow label="Thread" value={selectedThread?.name ?? '—'} darkMode={darkMode} />
                </div>
              </div>

              {/* Tool calls */}
              {tools.length > 0 && (
                <div>
                  <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Tool Calls
                  </h4>
                  <ul className="space-y-1.5">
                    {tools.map((call, i) => (
                      <li key={i} className={`font-mono text-xs px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                        {call}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Output */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Output
                  </h4>
                  <CopyButton text={extractOutputText(lastExecution.Output)} darkMode={darkMode} />
                </div>
                <pre className={`whitespace-pre-wrap rounded-2xl p-3 text-xs font-mono leading-relaxed ${
                  darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'
                }`}>
                  {extractOutputText(lastExecution.Output) || '—'}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`flex items-center justify-between px-5 py-3 border-b ${darkMode ? 'border-gray-700/80' : 'border-gray-200'}`}>
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Execution Logs
          </h3>
          <div className="flex items-center gap-1">
            {(['ALL', 'info', 'debug', 'warn', 'error'] as LogFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium uppercase transition-colors ${
                  filter === f
                    ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                    : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
          {filteredLogs.length === 0 ? (
            <p className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No logs{filter !== 'ALL' ? ` at ${filter} level` : ''}.</p>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 py-0.5">
                <span className={`flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${levelDot[log.level]}`} />
                <span className={`flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{log.timestamp.toLocaleTimeString()}</span>
                <span className={`flex-shrink-0 font-semibold ${levelColor[log.level]}`}>{log.level.toUpperCase()}</span>
                <span className={`break-words ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryRow: React.FC<{ icon?: React.ReactNode; label: string; value: string; darkMode: boolean }> = ({
  icon,
  label,
  value,
  darkMode,
}) => (
  <div className="flex items-center justify-between">
    <span className={`flex items-center gap-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
      {icon}
      {label}
    </span>
    <span className={`font-medium truncate ml-3 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{value}</span>
  </div>
);

const CopyButton: React.FC<{ text: string; darkMode: boolean }> = ({ text, darkMode }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied output');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
        darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};
