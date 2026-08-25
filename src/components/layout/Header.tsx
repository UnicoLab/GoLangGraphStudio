import React, { useState } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { AgentConfig, ViewMode } from '../../types';
import {
  Bars3Icon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  CommandLineIcon,
  CogIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';

const views: { key: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'chat', label: 'Chat', icon: ChatBubbleLeftRightIcon },
  { key: 'graph', label: 'Graph', icon: CommandLineIcon },
  { key: 'debug', label: 'Debug', icon: CogIcon },
];

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
    <header className={`h-16 flex items-center justify-between px-4 sm:px-6 border-b backdrop-blur-sm transition-colors ${
      darkMode ? 'bg-gray-800/95 border-gray-700 text-white' : 'bg-white/95 border-gray-200 text-gray-900'
    }`}>
      {/* Left */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? <Bars3Icon className="w-5 h-5" /> : <XMarkIcon className="w-5 h-5" />}
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
            <span className="text-white font-bold text-sm">LS</span>
          </div>
          <h1 className="text-lg font-semibold hidden sm:block">GoLangGraph Studio</h1>
        </div>

        <nav className={`hidden md:flex items-center space-x-1 rounded-xl p-1 ml-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          {views.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCurrentView(key)}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                currentView === key
                  ? darkMode ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow'
                  : darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 mr-1.5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Agent selector */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
            darkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          <span className="font-medium">{selectedAgent?.name ?? 'Select agent'}</span>
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {selectedAgent ? `${selectedAgent.type} · ${selectedAgent.model}` : ''}
          </span>
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
            <div className={`absolute right-0 mt-2 w-80 rounded-xl border shadow-2xl z-40 overflow-hidden ${
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
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            connectionStatus === 'failed' ? 'bg-red-500' : 'bg-gray-500'
          }`} />
          <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {connectionStatus === 'connected' ? 'Connected' :
             connectionStatus === 'connecting' ? `Reconnecting (${retryAttempts}/${maxRetryAttempts})` :
             connectionStatus === 'failed' ? 'Failed' : 'Disconnected'}
          </span>
          {(connectionStatus === 'disconnected' || connectionStatus === 'failed') && (
            <button
              onClick={attemptReconnection}
              className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Retry
            </button>
          )}
        </div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}
          title="Toggle theme"
        >
          {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
      </div>
    </header>
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
        ? darkMode ? 'bg-blue-900/60' : 'bg-blue-50'
        : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
    }`}
  >
    <div className="min-w-0">
      <div className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        {agent.name}
      </div>
      <div className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {agent.type} · {agent.provider}/{agent.model}
      </div>
    </div>
    {selected && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
  </button>
);
