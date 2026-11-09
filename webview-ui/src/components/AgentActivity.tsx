import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import type { AgentTaskUpdate } from '../types/messageProtocol';

interface AgentActivityProps {
  task?: AgentTaskUpdate;
}

export const AgentActivity: React.FC<AgentActivityProps> = ({ task }) => {
  if (!task || !task.taskId) {
    return null;
  }

  return (
    <div className="mb-3 p-3 rounded-lg bg-[#141824] border border-purple-900/40 text-xs text-gray-200">
      <div className="flex items-center justify-between pb-2 border-b border-[#252a3a] mb-2">
        <div className="font-semibold text-purple-300 flex items-center gap-1.5">
          <Loader2 className={`w-3.5 h-3.5 ${task.status === 'executing' || task.status === 'planning' ? 'animate-spin text-purple-400' : 'text-gray-400'}`} />
          <span>Task: {task.goal}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase font-mono">
          {task.status}
        </span>
      </div>

      {/* Windows Sandbox Notice (if applicable) */}
      {task.windowsSandboxNotice && (
        <div className="mb-2 p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{task.windowsSandboxNotice}</span>
        </div>
      )}

      {/* Steps List */}
      <div className="space-y-1.5">
        {task.steps.map(step => (
          <div key={step.id} className="flex items-start gap-2 p-1.5 rounded bg-[#10131d]">
            {step.status === 'completed' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : step.status === 'running' ? (
              <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin flex-shrink-0 mt-0.5" />
            ) : step.status === 'failed' ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-medium text-gray-200 flex items-center justify-between">
                <span>{step.title}</span>
                {step.toolName && (
                  <span className="text-[10px] text-purple-400 font-mono">[{step.toolName}]</span>
                )}
              </div>
              {step.details && (
                <div className="text-[11px] text-gray-400 mt-0.5">{step.details}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

