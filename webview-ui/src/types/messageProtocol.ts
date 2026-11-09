/**
 * Typesafe message protocol between the VS Code Extension Host and the React Webview.
 */

export type HunkStatus = 'pending' | 'accepted' | 'rejected';

export interface DiffLine {
  type: 'add' | 'del' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  status: HunkStatus;
  rawText: string;
}

export interface FileDiff {
  fileUri: string;
  relativePath: string;
  originalContent: string;
  proposedContent: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface AgentStepItem {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details?: string;
  toolName?: string;
  timestamp: string;
}

export interface AgentTaskUpdate {
  taskId: string;
  goal: string;
  status: string;
  steps: AgentStepItem[];
  error?: string;
  windowsSandboxNotice?: string;
}

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'checkConnection' }
  | { type: 'getSettings' }
  | { type: 'saveSettings'; payload: { trueforgeUrl: string; apiToken?: string; defaultModel: string } }
  | { type: 'sendMessage'; payload: { text: string; mode?: 'chat' | 'agent' } }
  | { type: 'cancelTurn' }
  | { type: 'clearChat' }
  | { type: 'newSession' }
  | { type: 'openSettings' }
  | { type: 'getPendingDiffs' }
  | { type: 'acceptHunk'; payload: { fileUri: string; hunkId: string } }
  | { type: 'rejectHunk'; payload: { fileUri: string; hunkId: string } }
  | { type: 'acceptAllHunks'; payload: { fileUri: string } }
  | { type: 'rejectAllHunks'; payload: { fileUri: string } }
  | { type: 'undoLastChange' }
  | { type: 'openNativeDiff'; payload: { fileUri: string } };

export interface TrueForgeConnectionState {
  connected: boolean;
  url: string;
  latencyMs?: number;
  models?: string[];
  error?: string;
  checking?: boolean;
}

export type ExtensionToWebviewMessage =
  | { type: 'connectionStatus'; payload: TrueForgeConnectionState }
  | { type: 'settingsLoaded'; payload: { trueforgeUrl: string; hasToken: boolean; defaultModel: string } }
  | {
      type: 'messageChunk';
      payload: {
        id: string;
        role: 'user' | 'assistant' | 'system';
        text: string;
        reasoning?: string;
        isComplete?: boolean;
        isStreaming?: boolean;
      };
    }
  | { type: 'agentTaskUpdate'; payload: AgentTaskUpdate }
  | { type: 'pendingDiffsUpdated'; payload: FileDiff[] }
  | { type: 'statusUpdate'; payload: { message: string; level: 'info' | 'warn' | 'error' | 'success' } };
