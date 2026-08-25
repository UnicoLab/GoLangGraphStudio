import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStudioStore } from '../../store/useStudioStore';
import { Message } from '../../types';
import { PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid';

export const ChatView: React.FC = () => {
  const {
    selectedThread,
    selectedAgent,
    sendMessage,
    isExecuting,
    stopExecution,
    darkMode,
  } = useStudioStore();

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThread?.messages.length, isExecuting]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isExecuting) return;
    setInput('');
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {!selectedThread || selectedThread.messages.length === 0 ? (
            <EmptyState darkMode={darkMode} agentName={selectedAgent?.name} />
          ) : (
            selectedThread.messages.map((message) => (
              <MessageBubble key={message.id} message={message} darkMode={darkMode} />
            ))
          )}

          {isExecuting && (
            <div className={`flex items-center space-x-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="flex space-x-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </span>
              <span>{selectedAgent?.name ?? 'Agent'} is thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className={`border-t p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className="max-w-3xl mx-auto flex items-end space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={selectedAgent ? `Message ${selectedAgent.name}…` : 'Select an agent to begin'}
            disabled={!selectedAgent}
            className={`flex-1 resize-none px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 ${
              darkMode
                ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />
          {isExecuting ? (
            <button
              onClick={stopExecution}
              className="p-3 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="Stop"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedAgent}
              className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ darkMode: boolean; agentName?: string }> = ({ darkMode, agentName }) => (
  <div className="text-center py-16">
    <div className={`text-5xl mb-4`}>💬</div>
    <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      Start a conversation
    </h3>
    <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
      {agentName
        ? `Ask ${agentName} anything to test your GoLangGraph agent.`
        : 'Select an agent from the header, then send a message.'}
    </p>
  </div>
);

const MessageBubble: React.FC<{ message: Message; darkMode: boolean }> = ({ message, darkMode }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : darkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900 border border-gray-200'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
