import React from 'react';
import { Activity, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { TrueForgeConnectionState } from '../types/messageProtocol';

interface StatusBarProps {
  connection: TrueForgeConnectionState;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ connection, onRefresh, onOpenSettings }) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#161922] border-b border-[#2a3042] text-xs">
      <div className="flex items-center gap-2 overflow-hidden">
        {connection.checking ? (
          <div className="flex items-center gap-1.5 text-amber-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="truncate">Connecting to TrueForge...</span>
          </div>
        ) : connection.connected ? (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium text-gray-200 truncate">TrueForge Online</span>
            {connection.latencyMs !== undefined && (
              <span className="text-[10px] text-gray-400 font-mono">({connection.latencyMs}ms)</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-rose-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium truncate">TrueForge Offline</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onRefresh}
          title="Refresh TrueForge Status"
          className="p-1 rounded text-gray-400 hover:text-purple-300 hover:bg-[#252a3a] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${connection.checking ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={onOpenSettings}
          title="Open Settings"
          className="px-2 py-0.5 rounded text-gray-400 hover:text-purple-300 hover:bg-[#252a3a] transition-colors font-medium text-[11px]"
        >
          Config
        </button>
      </div>
    </div>
  );
};

