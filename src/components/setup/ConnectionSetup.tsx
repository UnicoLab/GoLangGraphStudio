import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStudioStore } from '../../store/useStudioStore';
import { ServerIcon, KeyIcon, ChatBubbleLeftRightIcon, CommandLineIcon, CogIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const features = [
  { icon: ChatBubbleLeftRightIcon, title: 'Chat', desc: 'Test agents conversationally' },
  { icon: CommandLineIcon, title: 'Graph', desc: 'Visualise execution flow' },
  { icon: CogIcon, title: 'Debug', desc: 'Inspect logs & state' },
];

export const ConnectionSetup: React.FC = () => {
  const navigate = useNavigate();
  const { config, setConfig, connect, isConnecting, darkMode } = useStudioStore();
  const [apiUrl, setApiUrl] = useState(config.apiUrl);
  const [apiKey, setApiKey] = useState(config.apiKey ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl.trim()) {
      toast.error('Please enter a server URL');
      return;
    }

    setConfig({ apiUrl: apiUrl.trim(), apiKey: apiKey.trim() || undefined });
    await connect();

    const { isConnected, error } = useStudioStore.getState();
    if (isConnected) {
      toast.success('Connected to GoLangGraph server');
      // The server can answer /health and still fail to list agents, tools or
      // providers. `connect` records that in `error` while staying connected;
      // showing it here is the difference between "this server has no agents"
      // and "this server's agent endpoint is broken".
      if (error) toast.error(error);
      navigate('/studio');
    } else {
      toast.error(error || 'Failed to connect');
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-600/25">
            <span className="text-white font-bold text-2xl">LS</span>
          </div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>GoLangGraph Studio</h1>
          <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Connect to a running GoLangGraph server to inspect and test your agents.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`rounded-2xl border p-6 space-y-4 shadow-xl ${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-200'}`}
        >
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Server URL</label>
            <div className="relative">
              <ServerIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8080"
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  darkMode ? 'bg-gray-900/70 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              API Key <span className="font-normal opacity-60">(optional)</span>
            </label>
            <div className="relative">
              <KeyIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="X-API-Key"
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  darkMode ? 'bg-gray-900/70 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white font-medium shadow-lg shadow-blue-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {isConnecting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                Connect
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="grid grid-cols-3 gap-3 mt-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className={`text-center p-3 rounded-xl border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
              <Icon className={`w-5 h-5 mx-auto mb-1.5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <div className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{title}</div>
              <div className={`text-[10px] mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</div>
            </div>
          ))}
        </div>

        <p className={`mt-6 text-xs text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Start the server with the GoLangGraph CLI, e.g.{' '}
          <code className={darkMode ? 'text-gray-300' : 'text-gray-600'}>golanggraph serve</code>.
        </p>
      </div>
    </div>
  );
};
