import React from 'react';
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode,
  GitCompare,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import type { DiffHunk, FileDiff, HunkStatus } from '../types/messageProtocol';

interface DiffReviewPanelProps {
  pendingDiffs: FileDiff[];
  onAcceptHunk: (fileUri: string, hunkId: string) => void;
  onRejectHunk: (fileUri: string, hunkId: string) => void;
  onAcceptAllHunks: (fileUri: string) => void;
  onRejectAllHunks: (fileUri: string) => void;
  onUndoLastChange: () => void;
  onOpenNativeDiff: (fileUri: string) => void;
}

export const DiffReviewPanel: React.FC<DiffReviewPanelProps> = ({
  pendingDiffs,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAllHunks,
  onRejectAllHunks,
  onUndoLastChange,
  onOpenNativeDiff,
}) => {
  const [expandedFiles, setExpandedFiles] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const d of pendingDiffs) {
      initial[d.fileUri] = true;
    }
    return initial;
  });

  const toggleFile = (fileUri: string) => {
    setExpandedFiles(prev => ({ ...prev, [fileUri]: !prev[fileUri] }));
  };

  if (pendingDiffs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400">
        <div className="w-12 h-12 mb-3 rounded-full bg-[#161922] border border-[#2a3042] flex items-center justify-center text-purple-400">
          <GitCompare className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-gray-200 mb-1">No Pending Changes</h3>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed mb-4">
          All workspace changes are up to date. Use Inline Edit or run the Autonomous Agent to propose code modifications safely.
        </p>
        <button
          onClick={onUndoLastChange}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#1f2430] hover:bg-[#282f3f] text-gray-300 border border-[#2e3648] transition-colors"
          title="Revert the most recent change applied to disk"
        >
          <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
          Undo Last Applied Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden text-xs">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#12141c] border-b border-[#2a3042]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-200 flex items-center gap-1.5">
            <GitCompare className="w-4 h-4 text-purple-400" />
            Pending Code Reviews
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-900/60 text-purple-300 border border-purple-700/50">
            {pendingDiffs.length} {pendingDiffs.length === 1 ? 'file' : 'files'}
          </span>
        </div>
        <button
          onClick={onUndoLastChange}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-[#1c202c] hover:bg-[#252b3a] text-gray-300 border border-[#2e3648] transition-colors"
          title="Revert the most recent change applied to disk"
        >
          <RotateCcw className="w-3 h-3 text-purple-400" />
          Undo Last Change
        </button>
      </div>

      {/* Diffs List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {pendingDiffs.map(diff => {
          const isExpanded = expandedFiles[diff.fileUri] ?? true;
          const pendingCount = diff.hunks.filter(h => h.status === 'pending').length;
          const acceptedCount = diff.hunks.filter(h => h.status === 'accepted').length;
          const rejectedCount = diff.hunks.filter(h => h.status === 'rejected').length;

          return (
            <div
              key={diff.fileUri}
              className="rounded-lg border border-[#2a3042] bg-[#141721] overflow-hidden shadow-sm"
            >
              {/* File header */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-[#171b26] border-b border-[#2a3042]">
                <div
                  className="flex items-center gap-2 cursor-pointer select-none flex-1 min-w-0"
                  onClick={() => toggleFile(diff.fileUri)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                  <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="font-mono text-xs text-gray-200 font-medium truncate" title={diff.relativePath}>
                    {diff.relativePath}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                      +{diff.additions}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-rose-950/70 text-rose-400 border border-rose-800/40">
                      -{diff.deletions}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    onClick={() => onOpenNativeDiff(diff.fileUri)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#202534] hover:bg-[#2b3246] text-gray-300 border border-[#323b50] text-[10px] transition-colors"
                    title="Open side-by-side native diff in VS Code"
                  >
                    <ExternalLink className="w-3 h-3 text-purple-400" />
                    Side-by-Side Diff
                  </button>
                  <button
                    onClick={() => onAcceptAllHunks(diff.fileUri)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800/70 text-emerald-200 border border-emerald-700/60 text-[10px] font-medium transition-colors"
                    title="Accept all proposed changes for this file"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Accept All
                  </button>
                  <button
                    onClick={() => onRejectAllHunks(diff.fileUri)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/50 text-[10px] font-medium transition-colors"
                    title="Discard all proposed changes for this file"
                  >
                    <XCircle className="w-3 h-3" />
                    Reject All
                  </button>
                </div>
              </div>

              {/* Hunks list */}
              {isExpanded && (
                <div className="p-3 space-y-3 bg-[#0d1017]">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                    <span>
                      {diff.hunks.length} {diff.hunks.length === 1 ? 'Hunk' : 'Hunks'} (
                      {pendingCount > 0 && <span className="text-amber-400">{pendingCount} pending</span>}
                      {acceptedCount > 0 && <span className="text-emerald-400 ml-1.5">{acceptedCount} accepted</span>}
                      {rejectedCount > 0 && <span className="text-rose-400 ml-1.5">{rejectedCount} rejected</span>}
                      )
                    </span>
                  </div>

                  {diff.hunks.map(hunk => (
                    <HunkCard
                      key={hunk.id}
                      fileUri={diff.fileUri}
                      hunk={hunk}
                      onAccept={() => onAcceptHunk(diff.fileUri, hunk.id)}
                      onReject={() => onRejectHunk(diff.fileUri, hunk.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface HunkCardProps {
  fileUri: string;
  hunk: DiffHunk;
  onAccept: () => void;
  onReject: () => void;
}

const HunkCard: React.FC<HunkCardProps> = ({ hunk, onAccept, onReject }) => {
  return (
    <div className="rounded border border-[#242b3b] bg-[#12151f] overflow-hidden text-[11px]">
      {/* Hunk Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#181d2a] border-b border-[#242b3b]">
        <div className="flex items-center gap-2 font-mono text-[10px] text-purple-300">
          <span>
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </span>
          <StatusBadge status={hunk.status} />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAccept}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              hunk.status === 'accepted'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-emerald-950/60 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-800/50'
            }`}
            title="Accept this hunk"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>
          <button
            onClick={onReject}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              hunk.status === 'rejected'
                ? 'bg-rose-600 text-white font-semibold'
                : 'bg-rose-950/60 hover:bg-rose-800/60 text-rose-300 border border-rose-800/50'
            }`}
            title="Reject this hunk"
          >
            <X className="w-3 h-3" />
            Reject
          </button>
        </div>
      </div>

      {/* Lines code display */}
      <div className="font-mono text-[11px] leading-tight overflow-x-auto divide-y divide-[#1e2330]">
        {hunk.lines.map((line, idx) => {
          let lineBg = 'bg-transparent text-gray-400';
          let prefix = ' ';
          let markerColor = 'text-gray-500';

          if (line.type === 'add') {
            lineBg = 'bg-emerald-950/30 text-emerald-300';
            prefix = '+';
            markerColor = 'text-emerald-500 font-bold';
          } else if (line.type === 'del') {
            lineBg = 'bg-rose-950/30 text-rose-300';
            prefix = '-';
            markerColor = 'text-rose-500 font-bold';
          }

          return (
            <div key={idx} className={`flex items-start px-2 py-0.5 ${lineBg}`}>
              <div className="w-8 shrink-0 text-right pr-2 select-none text-[9px] text-gray-600 font-mono">
                {line.oldLineNumber ?? ''}
              </div>
              <div className="w-8 shrink-0 text-right pr-2 select-none text-[9px] text-gray-600 font-mono">
                {line.newLineNumber ?? ''}
              </div>
              <div className={`w-4 shrink-0 text-center select-none ${markerColor}`}>
                {prefix}
              </div>
              <div className="flex-1 whitespace-pre font-mono overflow-x-auto pl-1">
                {line.content || ' '}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: HunkStatus }> = ({ status }) => {
  switch (status) {
    case 'accepted':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
          Accepted
        </span>
      );
    case 'rejected':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-rose-950 text-rose-300 border border-rose-700/60">
          Rejected
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-700/50">
          Pending Review
        </span>
      );
  }
};

