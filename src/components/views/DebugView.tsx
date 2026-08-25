import React from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { ExecutionLog, formatDuration } from '../../types';
import { extractOutputText, summariseToolCalls } from '../../api/client';

const levelColor: Record<ExecutionLog['level'], string> = {
  info: 'text-blue-500',
  debug: 'text-gray-400',
  warn: 'text-yellow-500',
  error: 'text-red-500',
};

export const DebugView: React.FC = () => {
  const { executionLogs, lastExecution, selectedAgent, selectedThread, darkMode } = useStudioStore();

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Execution details */}
      <div className={`lg:w-96 border-b lg:border-b-0 lg:border-r p-5 overflow-y-auto ${
        darkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Last Execution
        </h3>

        {!lastExecution ? (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No execution yet. Send a message in the Chat view.
          </p>
        ) : (
          <dl className={`space-y-3 text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            <Field label="Agent" value={selectedAgent?.name ?? lastExecution.ID} darkMode={darkMode} />
            <Field label="Status" value={lastExecution.Status ?? (lastExecution.Success ? 'completed' : 'failed')} darkMode={darkMode} />
            <Field label="Duration" value={formatDuration(lastExecution.Duration)} darkMode={darkMode} />
            <Field label="Thread" value={selectedThread?.name ?? '—'} darkMode={darkMode} />

            <div>
              <dt className={`text-xs uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Tool Calls</dt>
              <dd className="mt-1">
                {summariseToolCalls(lastExecution.ToolCalls).length === 0 ? (
                  <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>None</span>
                ) : (
                  <ul className="space-y-1">
                    {summariseToolCalls(lastExecution.ToolCalls).map((call, i) => (
                      <li key={i} className="font-mono text-xs">· {call}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>

            <div>
              <dt className={`text-xs uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Output</dt>
              <dd className={`mt-1 whitespace-pre-wrap rounded-lg p-3 text-xs font-mono ${
                darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'
              }`}>
                {extractOutputText(lastExecution.Output) || '—'}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Logs */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-sm font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Execution Logs
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5">
          {executionLogs.length === 0 ? (
            <p className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No logs yet.</p>
          ) : (
            executionLogs.map((log) => (
              <div key={log.id} className="flex items-start space-x-2">
                <span className={`flex-shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className={`flex-shrink-0 ${levelColor[log.level]}`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; darkMode: boolean }> = ({ label, value, darkMode }) => (
  <div>
    <dt className={`text-xs uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</dt>
    <dd className="mt-0.5 font-medium">{value}</dd>
  </div>
);
