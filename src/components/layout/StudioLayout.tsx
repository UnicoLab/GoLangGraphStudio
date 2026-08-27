import React, { useEffect } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { GraphView } from '../views/GraphView';
import { ChatView } from '../views/ChatView';
import { DebugView } from '../views/DebugView';
import { AgentLabView } from '../views/AgentLabView';
import { PipelineLabView } from '../views/PipelineLabView';
import { RunsView } from '../views/RunsView';

export const StudioLayout: React.FC = () => {
  const { currentView, setCurrentView, sidebarCollapsed, darkMode } = useStudioStore();

  // Set default view to chat
  useEffect(() => {
    if (!currentView) {
      setCurrentView('chat');
    }
  }, [currentView, setCurrentView]);

  // Add keyboard shortcuts for view switching
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setCurrentView('chat');
            break;
          case '2':
            e.preventDefault();
            setCurrentView('graph');
            break;
          case '3':
            e.preventDefault();
            setCurrentView('debug');
            break;
          case '4':
            e.preventDefault();
            setCurrentView('agents');
            break;
          case '5':
            e.preventDefault();
            setCurrentView('pipelines');
            break;
          case '6':
            e.preventDefault();
            setCurrentView('runs');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setCurrentView]);

  const renderMainView = () => {
    switch (currentView) {
      case 'graph':
        return <GraphView />;
      case 'chat':
        return <ChatView />;
      case 'debug':
        return <DebugView />;
      case 'agents':
        return <AgentLabView />;
      case 'pipelines':
        return <PipelineLabView />;
      case 'runs':
        return <RunsView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <Header />
      </div>
      
      {/* Main Layout Container */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar - Full Height */}
        <div 
          className={`flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            sidebarCollapsed ? 'w-0' : 'w-80'
          }`}
          style={{ height: '100%' }}
        >
          <Sidebar />
        </div>
        
        {/* Main Content Area - Takes remaining space */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <MainContent>
            {renderMainView()}
          </MainContent>
        </div>
      </div>
    </div>
  );
};
