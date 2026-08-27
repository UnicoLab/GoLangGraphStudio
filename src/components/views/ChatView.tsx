import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';
import { useStudioStore } from '../../store/useStudioStore';
import { Message, AgentConfig } from '../../types';
import { PaperAirplaneIcon, StopIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/solid';
import { UserCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

export const ChatView: React.FC = () => {
  const { selectedThread, selectedAgent, sendMessage, isExecuting, stopExecution, darkMode } = useStudioStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThread?.messages.length, isExecuting]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isExecuting) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {!selectedThread || selectedThread.messages.length === 0 ? (
            <EmptyState agent={selectedAgent} darkMode={darkMode} />
          ) : (
            selectedThread.messages.map((message) => (
              <MessageBubble key={message.id} message={message} darkMode={darkMode} />
            ))
          )}

          {isExecuting && <TypingIndicator name={selectedAgent?.name} darkMode={darkMode} />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className={`border-t px-4 py-4 ${darkMode ? 'border-gray-700/80 bg-gray-800/70 backdrop-blur' : 'border-gray-200 bg-white/80 backdrop-blur'}`}>
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={selectedAgent ? `Message ${selectedAgent.name}…` : 'Select an agent to begin'}
            disabled={!selectedAgent}
            className={`flex-1 resize-none px-4 py-3 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 transition-shadow ${
              darkMode
                ? 'bg-gray-900/70 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />
          {isExecuting ? (
            <button
              onClick={stopExecution}
              className="flex-shrink-0 p-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5"
              title="Stop"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedAgent}
              className="flex-shrink-0 p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              title="Send"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className={`max-w-3xl mx-auto mt-2 text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          <kbd className="px-1 py-0.5 rounded border border-current/20 font-mono">Enter</kbd> to send ·{' '}
          <kbd className="px-1 py-0.5 rounded border border-current/20 font-mono">Shift+Enter</kbd> for newline
        </p>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ agent?: AgentConfig; darkMode: boolean }> = ({ agent, darkMode }) => (
  <div className="text-center py-20">
    <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/25`}>
      <SparklesIcon className="w-8 h-8 text-white" />
    </div>
    <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      {agent ? `Chat with ${agent.name}` : 'Start a conversation'}
    </h3>
    <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
      {agent
        ? `${agent.type} agent · ${agent.provider}/${agent.model}`
        : 'Select an agent from the header, then send a message.'}
    </p>
  </div>
);

const TypingIndicator: React.FC<{ name?: string; darkMode: boolean }> = ({ name, darkMode }) => (
  <div className="flex items-end gap-3 animate-fade-in">
    <Avatar />
    <div className={`px-4 py-3 rounded-2xl rounded-bl-sm ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
      <div className="flex items-center gap-2">
        <span className="flex space-x-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
        </span>
        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {name ?? 'Agent'} is thinking…
        </span>
      </div>
    </div>
  </div>
);

const MessageBubble: React.FC<{ message: Message; darkMode: boolean }> = ({ message, darkMode }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-end gap-3 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Avatar />}
      <div
        className={`relative group max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-br-sm'
            : darkMode
              ? 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <Markdown content={message.content} darkMode={darkMode} />
        )}
        {!isUser && <CopyButton content={message.content} darkMode={darkMode} />}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
          <UserCircleIcon className="w-6 h-6 text-gray-500 dark:text-gray-300" />
        </div>
      )}
    </div>
  );
};

const Avatar: React.FC = () => (
  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
    <SparklesIcon className="w-4 h-4 text-white" />
  </div>
);

const CopyButton: React.FC<{ content: string; darkMode: boolean }> = ({ content, darkMode }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };
  return (
    <button
      onClick={copy}
      className={`absolute -top-3 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow ${
        darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-100'
      }`}
      title="Copy"
    >
      {copied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
    </button>
  );
};

const Markdown: React.FC<{ content: string; darkMode: boolean }> = ({ content, darkMode }) => (
  <div className="markdown-body">
    <ReactMarkdown
      components={{
        a: ({ children, ...props }) => <a {...props} className="text-blue-500 hover:underline" target="_blank" rel="noreferrer">{children}</a>,
        ul: ({ children, ...props }) => <ul {...props} className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
        ol: ({ children, ...props }) => <ol {...props} className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
        p: ({ children, ...props }) => <p {...props} className="my-1.5">{children}</p>,
        h1: ({ children, ...props }) => <h1 {...props} className="text-xl font-bold mt-4 mb-2">{children}</h1>,
        h2: ({ children, ...props }) => <h2 {...props} className="text-lg font-semibold mt-4 mb-2">{children}</h2>,
        h3: ({ children, ...props }) => <h3 {...props} className="text-base font-semibold mt-3 mb-1.5">{children}</h3>,
        blockquote: ({ children, ...props }) => (
          <blockquote {...props} className={`border-l-4 pl-3 my-2 ${darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}`}>{children}</blockquote>
        ),
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const raw = String(children).replace(/\n$/, '');
          const isBlock = raw.includes('\n') || !!match;
          if (isBlock) {
            return (
              <SyntaxHighlighter
                language={match?.[1] ?? 'text'}
                style={oneDark as any}
                customStyle={{ borderRadius: '0.75rem', fontSize: '0.8rem', margin: '0.5rem 0' }}
                {...props}
              >
                {raw}
              </SyntaxHighlighter>
            );
          }
          return (
            <code className={`px-1.5 py-0.5 rounded font-mono text-[0.85em] ${darkMode ? 'bg-gray-700 text-blue-300' : 'bg-gray-100 text-blue-700'}`}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
