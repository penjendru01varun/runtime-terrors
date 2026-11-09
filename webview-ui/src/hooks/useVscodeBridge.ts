import { useEffect, useRef, useState } from 'react';
import type {
  AgentTaskUpdate,
  ExtensionToWebviewMessage,
  FileDiff,
  TrueForgeConnectionState,
  WebviewToExtensionMessage,
} from '../types/messageProtocol';

declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | undefined;

export function getVsCodeApi() {
  if (!vscodeApi) {
    if (typeof acquireVsCodeApi === 'function') {
      vscodeApi = acquireVsCodeApi();
    } else {
      vscodeApi = {
        postMessage: (msg: unknown) => console.log('[Mock VS Code PostMessage]:', msg),
        getState: () => ({}),
        setState: () => {},
      };
    }
  }
  return vscodeApi;
}

export function useVscodeBridge() {
  const [connection, setConnection] = useState<TrueForgeConnectionState>({
    connected: false,
    url: 'http://127.0.0.1:8790',
    checking: true,
  });

  const [settings, setSettings] = useState<{
    trueforgeUrl: string;
    hasToken: boolean;
    defaultModel: string;
  }>({
    trueforgeUrl: 'http://127.0.0.1:8790',
    hasToken: false,
    defaultModel: 'openai/gpt-4o',
  });

  const [statusMessage, setStatusMessage] = useState<{
    message: string;
    level: 'info' | 'warn' | 'error' | 'success';
  } | null>(null);

  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant' | 'system';
      text: string;
      reasoning?: string;
      isStreaming?: boolean;
    }>
  >([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTask, setActiveTask] = useState<AgentTaskUpdate | undefined>();
  const [pendingDiffs, setPendingDiffs] = useState<FileDiff[]>([]);

  const isReadyRef = useRef(false);

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      const msg = event.data as ExtensionToWebviewMessage;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'connectionStatus':
          setConnection(msg.payload);
          break;
        case 'settingsLoaded':
          setSettings(msg.payload);
          break;
        case 'pendingDiffsUpdated':
          setPendingDiffs(msg.payload);
          break;
        case 'statusUpdate':
          setStatusMessage(msg.payload);
          setTimeout(() => setStatusMessage(null), 4000);
          break;
        case 'agentTaskUpdate':
          setActiveTask(msg.payload);
          if (msg.payload.status === 'completed' || msg.payload.status === 'failed' || msg.payload.status === 'cancelled') {
            setIsGenerating(false);
          } else {
            setIsGenerating(true);
          }
          break;
        case 'messageChunk': {
          const { id, role, text, isComplete, isStreaming } = msg.payload;

          if (isStreaming) {
            setIsGenerating(true);
          }
          if (isComplete) {
            setIsGenerating(false);
          }

          console.log('[STAGE 8] Webview received messageChunk:', {
            id,
            role,
            textLength: text?.length,
            isStreaming,
            isComplete,
          });

          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { id, role, text, isStreaming };
              return updated;
            }
            return [...prev, { id, role, text, isStreaming }];
          });
          break;
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);

    if (!isReadyRef.current) {
      isReadyRef.current = true;
      getVsCodeApi().postMessage({ type: 'ready' } satisfies WebviewToExtensionMessage);
      getVsCodeApi().postMessage({ type: 'getSettings' } satisfies WebviewToExtensionMessage);
      getVsCodeApi().postMessage({ type: 'checkConnection' } satisfies WebviewToExtensionMessage);
      getVsCodeApi().postMessage({ type: 'getPendingDiffs' } satisfies WebviewToExtensionMessage);
    }

    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  }, []);

  const sendMessageToExtension = (msg: WebviewToExtensionMessage) => {
    if (msg.type === 'sendMessage') {
      setIsGenerating(true);
    } else if (msg.type === 'cancelTurn') {
      setIsGenerating(false);
    }
    getVsCodeApi().postMessage(msg);
  };

  return {
    connection,
    settings,
    statusMessage,
    messages,
    isGenerating,
    activeTask,
    pendingDiffs,
    sendMessageToExtension,
  };
}
