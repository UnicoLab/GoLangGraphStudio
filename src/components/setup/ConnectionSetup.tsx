import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStudioStore } from '../../store/useStudioStore';

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
      navigate('/studio');
    } else {
      toast.error(error || 'Failed to connect');
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-blue-600' : 'bg-blue-600'}`}>
            <span className="text-white font-bold text-2xl">LS</span>
          </div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            GoLangGraph Studio
          </h1>
          <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Connect to a running GoLangGraph server to inspect and test your agents.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`rounded-2xl border p-6 space-y-5 shadow-sm ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Server URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8080"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode
                  ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              API Key <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="X-API-Key"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode
                  ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting…' : 'Connect'}
          </button>
        </form>

        <p className={`mt-6 text-xs text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Start the server with the GoLangGraph CLI, e.g.{' '}
          <code className={darkMode ? 'text-gray-300' : 'text-gray-600'}>golanggraph serve</code>.
        </p>
      </div>
    </div>
  );
};
