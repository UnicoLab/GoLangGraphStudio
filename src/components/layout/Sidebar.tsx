import React from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { PlusIcon, ChatBubbleLeftIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export const Sidebar: React.FC = () => {
  const {
    threads,
    selectedThread,
    selectThread,
    createThread,
    deleteThread,
    darkMode,
  } = useStudioStore();

  return (
    <div className={`h-full flex flex-col border-r transition-colors ${
      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ChatBubbleLeftIcon className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Threads</h2>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
            {threads.length}
          </span>
        </div>

        <button
          onClick={createThread}
          className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          New Thread
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className={`p-6 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <ChatBubbleLeftIcon className={`w-8 h-8 mx-auto mb-2 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className="text-sm">No threads yet</p>
            <p className="text-xs mt-1">Create a thread to start chatting.</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {threads.map((thread) => {
              const last = thread.messages[thread.messages.length - 1];
              const active = selectedThread?.id === thread.id;
              return (
                <div
                  key={thread.id}
                  onClick={() => selectThread(thread)}
                  className={`group relative p-3 rounded-xl cursor-pointer border-2 transition-colors ${
                    active
                      ? darkMode ? 'bg-blue-900/50 border-blue-600' : 'bg-blue-50 border-blue-200'
                      : darkMode ? 'hover:bg-gray-700 border-transparent' : 'hover:bg-gray-50 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-medium truncate ${
                        darkMode ? 'text-white' : 'text-gray-900'
                      }`}>{thread.name}</h3>
                      <p className={`text-xs truncate mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {last ? last.content : 'No messages yet'}
                      </p>
                      <div className={`flex items-center space-x-1 text-xs mt-1.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        <ClockIcon className="w-3 h-3" />
                        <span>{format(thread.updatedAt, 'MMM d, HH:mm')}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThread(thread.id);
                      }}
                      className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg ${darkMode ? 'text-gray-400 hover:text-red-300' : 'text-gray-400 hover:text-red-600'}`}
                      title="Delete thread"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
