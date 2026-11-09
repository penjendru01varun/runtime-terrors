import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Trash2, Bot, User, AlertCircle, Sparkles, Layers, MessageSquare, Loader2 } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { AgentActivity } from './AgentActivity';
import type { AgentTaskUpdate, TrueForgeConnectionState } from '../types/messageProtocol';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  isStreaming?: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  connection: TrueForgeConnectionState;
  isGenerating: boolean;
  activeTask?: AgentTaskUpdate;
  onSendMessage: (text: string, mode?: 'chat' | 'agent') => void;
  onCancel: () => void;
  onClear: () => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  connection,
  isGenerating,
  activeTask,
  onSendMessage,
  onCancel,
  onClear,
  onNewSession,
  onOpenSettings,
}) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    console.log('[STAGE 8] Webview rendered ChatPanel messages count:', messages.length);
  }, [messages, activeTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    onSendMessage(trimmed, mode);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1117] text-gray-100 overflow-hidden">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#12141c] border-b border-[#2a3042]/50 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex rounded bg-[#1b1f2e] p-0.5 border border-[#2a3042]">
            <button
              onClick={() => setMode('chat')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                mode === 'chat'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              Chat
            </button>
            <button
              onClick={() => setMode('agent')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                mode === 'agent'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              Agent Mode
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onNewSession}
            className="px-2 py-0.5 rounded text-gray-400 hover:text-purple-300 hover:bg-[#1f2433] transition-colors text-[11px]"
            title="Start New TrueForge Session"
          >
            New Session
          </button>
          {messages.length > 0 && (
            <button
              onClick={onClear}
              className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-[#1f2433] transition-colors"
              title="Clear History"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Disconnected Banner */}
      {!connection.connected && !connection.checking && (
        <div className="p-2.5 bg-rose-950/40 border-b border-rose-900/60 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>TrueForge server offline at <span className="font-mono text-purple-300">{connection.url}</span></span>
          </div>
          <button
            onClick={onOpenSettings}
            className="text-[11px] underline font-medium text-rose-300 hover:text-white"
          >
            Configure
          </button>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Agent Activity Progress Card */}
        {activeTask && <AgentActivity task={activeTask} />}

        {messages.length === 0 && !activeTask ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/50 border border-purple-800/40 flex items-center justify-center text-purple-400 mb-3">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-gray-300">Runtime Terrors</h3>
            <p className="text-xs text-gray-400 max-w-xs mt-1">
              Ask coding questions, reference files with <span className="text-purple-300 font-mono">@file</span>, symbols with <span className="text-purple-300 font-mono">@symbol</span>, or switch to <span className="text-purple-300 font-medium">Agent Mode</span> for multi-step tasks.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => onSendMessage('Explain how TrueForge streams turn events over SSE.', 'chat')}
                className="text-[11px] px-2.5 py-1.5 rounded-md bg-[#161922] border border-[#2a3042] text-gray-300 hover:border-purple-500 transition-colors"
              >
                "Explain TrueForge SSE turns"
              </button>
              <button
                onClick={() => onSendMessage('Inspect the workspace structure and suggest code optimizations.', 'agent')}
                className="text-[11px] px-2.5 py-1.5 rounded-md bg-[#161922] border border-[#2a3042] text-gray-300 hover:border-purple-500 transition-colors"
              >
                "Launch Agent Mode task"
              </button>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                {msg.role === 'user' ? (
                  <>
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-blue-300">Developer</span>
                  </>
                ) : msg.role === 'system' ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">System</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300">TrueForge</span>
                    {msg.isStreaming && (
                      <Loader2 className="w-3 h-3 text-purple-400 animate-spin ml-1" />
                    )}
                  </>
                )}
              </div>

              {/* Message Content */}
              <div
                className={`text-xs leading-relaxed p-3 rounded-lg border ${
                  msg.role === 'user'
                    ? 'bg-[#1a2030] border-blue-900/40 text-gray-100 self-end max-w-[90%]'
                    : msg.role === 'system'
                    ? 'bg-[#1e1717] border-amber-900/40 text-amber-200 w-full'
                    : 'bg-[#141721] border-[#2a3042] text-gray-200 w-full'
                }`}
              >
                {msg.text && msg.text.trim() ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : msg.isStreaming ? (
                  <div className="flex items-center gap-2 text-purple-400 italic">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>TrueForge is generating response...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-300 bg-rose-950/40 p-2 rounded border border-rose-900/60">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>No response received from model. Check the "Runtime Terrors" Output channel for details.</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-[#12141c] border-t border-[#2a3042]">
        <div className="relative rounded-lg bg-[#181c28] border border-[#2a3042] focus-within:border-purple-500 transition-colors">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'agent'
                ? 'Describe autonomous task for TrueForge Agent Mode...'
                : 'Ask TrueForge a coding question or use @file and @symbol...'
            }
            rows={3}
            className="w-full text-xs bg-transparent p-2.5 text-gray-100 placeholder-gray-500 focus:outline-none resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between px-2.5 pb-2 text-[11px] text-gray-500">
            <span className="text-[10px]">
              {mode === 'agent' ? '⚡ Autonomous Multi-step Mode' : '💬 Interactive Chat Mode'}
            </span>
            <div className="flex items-center gap-1">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center gap-1 transition-colors"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Stop Generation
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={`px-3 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                    input.trim()
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-[#252a3a] text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
