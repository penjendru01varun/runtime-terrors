import React, { useState } from 'react';
import { StatusBar } from './components/StatusBar';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { DiffReviewPanel } from './components/DiffReviewPanel';
import { useVscodeBridge } from './hooks/useVscodeBridge';
import { MessageSquare, Sliders, Info, ShieldCheck, GitCompare } from 'lucide-react';

export const App: React.FC = () => {
  const {
    connection,
    settings,
    statusMessage,
    messages,
    isGenerating,
    activeTask,
    pendingDiffs,
    sendMessageToExtension,
  } = useVscodeBridge();

  const [activeTab, setActiveTab] = useState<'chat' | 'diffs' | 'settings' | 'about'>('chat');

  const handleRefresh = () => {
    sendMessageToExtension({ type: 'checkConnection' });
  };

  const handleSendMessage = (text: string, mode?: 'chat' | 'agent') => {
    sendMessageToExtension({ type: 'sendMessage', payload: { text, mode } });
  };

  const handleCancel = () => {
    sendMessageToExtension({ type: 'cancelTurn' });
  };

  const handleClear = () => {
    sendMessageToExtension({ type: 'clearChat' });
  };

  const handleNewSession = () => {
    sendMessageToExtension({ type: 'newSession' });
  };

  const handleSaveSettings = (payload: { trueforgeUrl: string; apiToken?: string; defaultModel: string }) => {
    sendMessageToExtension({ type: 'saveSettings', payload });
  };

  const handleAcceptHunk = (fileUri: string, hunkId: string) => {
    sendMessageToExtension({ type: 'acceptHunk', payload: { fileUri, hunkId } });
  };

  const handleRejectHunk = (fileUri: string, hunkId: string) => {
    sendMessageToExtension({ type: 'rejectHunk', payload: { fileUri, hunkId } });
  };

  const handleAcceptAllHunks = (fileUri: string) => {
    sendMessageToExtension({ type: 'acceptAllHunks', payload: { fileUri } });
  };

  const handleRejectAllHunks = (fileUri: string) => {
    sendMessageToExtension({ type: 'rejectAllHunks', payload: { fileUri } });
  };

  const handleUndoLastChange = () => {
    sendMessageToExtension({ type: 'undoLastChange' });
  };

  const handleOpenNativeDiff = (fileUri: string) => {
    sendMessageToExtension({ type: 'openNativeDiff', payload: { fileUri } });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-gray-100 overflow-hidden select-text">
      {/* Status Bar */}
      <StatusBar
        connection={connection}
        onRefresh={handleRefresh}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Tabs */}
      <div className="flex items-center px-2 bg-[#12141c] border-b border-[#2a3042] text-xs">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
            activeTab === 'chat'
              ? 'border-purple-500 text-purple-300'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat & Agent
        </button>

        <button
          onClick={() => setActiveTab('diffs')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors relative ${
            activeTab === 'diffs'
              ? 'border-purple-500 text-purple-300'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          Diff Review
          {pendingDiffs.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-600 text-white">
              {pendingDiffs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-purple-500 text-purple-300'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Settings
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors ${
            activeTab === 'about'
              ? 'border-purple-500 text-purple-300'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          About
        </button>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`px-3 py-1.5 text-xs text-center border-b transition-all ${
            statusMessage.level === 'error'
              ? 'bg-rose-950/80 border-rose-800 text-rose-200'
              : statusMessage.level === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-purple-950/80 border-purple-800 text-purple-200'
          }`}
        >
          {statusMessage.message}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatPanel
            messages={messages}
            connection={connection}
            isGenerating={isGenerating}
            activeTask={activeTask}
            onSendMessage={handleSendMessage}
            onCancel={handleCancel}
            onClear={handleClear}
            onNewSession={handleNewSession}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'diffs' && (
          <DiffReviewPanel
            pendingDiffs={pendingDiffs}
            onAcceptHunk={handleAcceptHunk}
            onRejectHunk={handleRejectHunk}
            onAcceptAllHunks={handleAcceptAllHunks}
            onRejectAllHunks={handleRejectAllHunks}
            onUndoLastChange={handleUndoLastChange}
            onOpenNativeDiff={handleOpenNativeDiff}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            settings={settings}
            connection={connection}
            onSave={handleSaveSettings}
            onClose={() => setActiveTab('chat')}
          />
        )}

        {activeTab === 'about' && (
          <div className="h-full p-4 overflow-y-auto text-xs text-gray-300 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-900/50 border border-purple-700 flex items-center justify-center text-purple-300 font-bold">
                RT
              </div>
              <div>
                <h3 className="font-semibold text-gray-100">Runtime Terrors</h3>
                <p className="text-[11px] text-gray-400">VS Code Native Agent Environment</p>
              </div>
            </div>

            <div className="p-3 rounded bg-[#161922] border border-[#2a3042] space-y-2">
              <div className="flex items-center gap-1.5 text-purple-300 font-medium">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                TrueForge Architecture Guard
              </div>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                This extension strictly routes all agent planning, reasoning, and tool execution through the official TrueForge Agent Harness. No separate LLM loop or direct commercial model calls are executed in this client.
              </p>
            </div>

            <div className="space-y-1 text-gray-400 text-[11px]">
              <p><span className="text-gray-300 font-medium">Extension Version:</span> 0.1.0</p>
              <p><span className="text-gray-300 font-medium">Active TrueForge URL:</span> <code className="text-purple-300">{connection.url}</code></p>
              <p><span className="text-gray-300 font-medium">Connection State:</span> {connection.connected ? <span className="text-emerald-400 font-medium">Connected</span> : <span className="text-rose-400 font-medium">Disconnected</span>}</p>
              <p><span className="text-gray-300 font-medium">Platform:</span> <code className="text-purple-300">{navigator.platform}</code> (Windows sandbox limitation documented)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
