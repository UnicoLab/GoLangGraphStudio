import React, { useState } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { AgentConfig, AgentType, ViewMode } from '../../types';
import {
  Bars3Icon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  CommandLineIcon,
  CogIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PowerIcon,
} from '@heroicons/react/24/outline';

const views: { key: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'chat', label: 'Chat', icon: ChatBubbleLeftRightIcon },
  { key: 'graph', label: 'Graph', icon: CommandLineIcon },
  { key: 'debug', label: 'Debug', icon: CogIcon },
];

const typeStyles: Record<AgentType, string> = {
  chat: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  react: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  tool: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
};

export const Header: React.FC = () => {
  const {
    agents,
    selectedAgent,
    selectAgent,
    currentView,
    setCurrentView,
    darkMode,
    setDarkMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    connectionStatus,
    retryAttempts,
    maxRetryAttempts,
    attemptReconnection,
  } = useStudioStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className={`h-16 flex items-center justify-between px-4 sm:px-6 border-b backdrop-blur-md transition-colors ${
      darkMode ? 'bg-gray-900/80 border-gray-700/80 text-white' : 'bg-white/80 border-gray-200 text-gray-900'
    }`}>
      {/* Left */}
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700/60 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? <Bars3Icon className="w-5 h-5" /> : <XMarkIcon className="w-5 h-5" />}
        </button>

        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-600/25">
            <span className="text-white font-bold text-sm">LS</span>
          </div>
          <div className="hidden lg:block leading-tight">
            <h1 className="text-base font-semibold">GoLangGraph Studio</h1>
            <p className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Agent debugging console</p>
          </div>
        </div>

        <nav className={`hidden md:flex items-center space-x-1 rounded-xl p-1 ml-4 ${darkMode ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
          {views.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCurrentView(key)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                currentView === key
                  ? darkMode ? 'bg-gray-700 text-white shadow' : 'bg-white text-blue-600 shadow'
                  : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 mr-1.5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Agent selector */}
      <div className="relative flex-shrink-0 mx-3">
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
            darkMode ? 'bg-gray-800/80 border-gray-600 hover:bg-gray-700' : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          {selectedAgent && (
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${typeStyles[selectedAgent.type]}`}>
              {selectedAgent.type}
            </span>
          )}
          <span className="font-medium max-w-[160px] truncate">{selectedAgent?.name ?? 'Select agent'}</span>
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
            <div className={`absolute right-0 mt-2 w-80 rounded-2xl border shadow-2xl z-40 overflow-hidden ${
              darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
            }`}>
              {agents.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">No agents found on server.</div>
              ) : (
                agents.map((agent) => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    selected={selectedAgent?.id === agent.id}
                    darkMode={darkMode}
                    onSelect={() => {
                      selectAgent(agent);
                      setDropdownOpen(false);
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center space-x-2.5">
        <ConnectionPill
          status={connectionStatus}
          retryAttempts={retryAttempts}
          maxRetryAttempts={maxRetryAttempts}
          darkMode={darkMode}
          onRetry={attemptReconnection}
        />

        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700/60 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}
          title="Toggle theme"
        >
          {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};

const ConnectionPill: React.FC<{
  status: string;
  retryAttempts: number;
  maxRetryAttempts: number;
  darkMode: boolean;
  onRetry: () => void;
}> = ({ status, retryAttempts, maxRetryAttempts, darkMode, onRetry }) => {
  const config = {
    connected: { icon: CheckCircleIcon, color: 'text-emerald-500', label: 'Connected' },
    connecting: { icon: ArrowPathIcon, color: 'text-amber-500 animate-spin', label: `Reconnecting (${retryAttempts}/${maxRetryAttempts})` },
    failed: { icon: ExclamationTriangleIcon, color: 'text-red-500', label: 'Failed' },
    disconnected: { icon: PowerIcon, color: 'text-gray-400', label: 'Disconnected' },
  }[status] ?? { icon: PowerIcon, color: 'text-gray-400', label: status };

  const Icon = config.icon;
  const showRetry = status === 'disconnected' || status === 'failed';

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs ${
      darkMode ? 'border-gray-700 bg-gray-800/80' : 'border-gray-200 bg-white'
    }`}>
      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
      <span className={`hidden sm:inline ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{config.label}</span>
      {showRetry && (
        <button onClick={onRetry} className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] hover:bg-blue-700">
          Retry
        </button>
      )}
    </div>
  );
};

const AgentRow: React.FC<{
  agent: AgentConfig;
  selected: boolean;
  darkMode: boolean;
  onSelect: () => void;
}> = ({ agent, selected, darkMode, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
      selected
        ? darkMode ? 'bg-blue-900/40' : 'bg-blue-50'
        : darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-50'
    }`}
  >
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{agent.name}</span>
        <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold uppercase ${typeStyles[agent.type]}`}>
          {agent.type}
        </span>
      </div>
      <div className={`text-xs truncate mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {agent.provider}/{agent.model}
      </div>
    </div>
    {selected && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 ml-2" />}
  </button>
);
