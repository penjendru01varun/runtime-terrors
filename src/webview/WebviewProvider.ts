import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { autonomousAgentCoordinator } from '../agent/autonomousAgent';
import { settingsManager } from '../config/settings';
import { ContextEngine } from '../context/contextEngine';
import { trueforgeClientAdapter } from '../trueforge/client';
import { sessionManager } from '../trueforge/sessionManager';
import { turnStreamer } from '../trueforge/turnStreamer';
import { logger } from '../utils/logger';
import type {
  ExtensionToWebviewMessage,
  TrueForgeConnectionState,
  WebviewToExtensionMessage,
} from './messageProtocol';

export class RuntimeTerrorsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'runtime-terrors.chatView';
  private view?: vscode.WebviewView;
  private onConnectionStateChange?: (state: TrueForgeConnectionState) => void;
  private activeAssistantMsgId?: string;
  private currentAccumulatedText = '';

  constructor(
    private readonly extensionUri: vscode.Uri,
    onConnectionChange?: (state: TrueForgeConnectionState) => void
  ) {
    this.onConnectionStateChange = onConnectionChange;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
      logger.log(`Received webview message: ${message.type}`);

      switch (message.type) {
        case 'ready':
        case 'getSettings': {
          await this.sendSettings();
          break;
        }

        case 'checkConnection': {
          await this.checkAndBroadcastConnection();
          break;
        }

        case 'saveSettings': {
          try {
            await settingsManager.setTrueForgeUrl(message.payload.trueforgeUrl);
            await settingsManager.setDefaultModel(message.payload.defaultModel);
            if (message.payload.apiToken !== undefined) {
              await settingsManager.setApiToken(message.payload.apiToken);
            }
            this.postMessage({
              type: 'statusUpdate',
              payload: { message: 'Settings saved successfully', level: 'success' },
            });
            await this.sendSettings();
            await this.checkAndBroadcastConnection();
          } catch (err) {
            this.postMessage({
              type: 'statusUpdate',
              payload: { message: `Failed to save settings: ${String(err)}`, level: 'error' },
            });
          }
          break;
        }

        case 'cancelTurn': {
          logger.log('[STAGE 9] Webview requested turn cancellation');
          await sessionManager.cancelActiveSession();
          autonomousAgentCoordinator.cancel();

          // Complete the active in-flight assistant message cleanly
          if (this.activeAssistantMsgId) {
            const stoppedText = this.currentAccumulatedText
              ? `${this.currentAccumulatedText}\n\n*(Generation stopped by developer)*`
              : '*(Generation cancelled by developer)*';

            this.postMessage({
              type: 'messageChunk',
              payload: {
                id: this.activeAssistantMsgId,
                role: 'assistant',
                text: stoppedText,
                isComplete: true,
                isStreaming: false,
              },
            });
            this.activeAssistantMsgId = undefined;
            this.currentAccumulatedText = '';
          }

          this.postMessage({
            type: 'statusUpdate',
            payload: { message: 'Turn execution cancelled', level: 'info' },
          });
          break;
        }

        case 'newSession': {
          sessionManager.resetSession();
          this.postMessage({
            type: 'statusUpdate',
            payload: { message: 'Started new TrueForge session', level: 'info' },
          });
          break;
        }

        case 'clearChat': {
          sessionManager.resetSession();
          this.postMessage({
            type: 'statusUpdate',
            payload: { message: 'Chat cleared and session reset', level: 'info' },
          });
          break;
        }

        case 'sendMessage': {
          const userText = message.payload.text;
          const isAgentMode = message.payload.mode === 'agent';

          // Stage 1: Log user message received and ensure Runtime Terrors output channel is visible
          logger.log(
            `[STAGE 1] User message received by WebviewProvider (mode: ${message.payload.mode || 'chat'}, length: ${userText.length})`
          );
          logger.show(true);

          // 1. Echo user message to webview
          this.postMessage({
            type: 'messageChunk',
            payload: {
              id: 'user-' + Date.now(),
              role: 'user',
              text: userText,
              isComplete: true,
            },
          });

          // 2. Check connection
          const conn = await trueforgeClientAdapter.testConnection();
          if (!conn.connected) {
            logger.warn(`[STAGE 9] TrueForge offline check triggered: ${conn.error}`);
            this.postMessage({
              type: 'messageChunk',
              payload: {
                id: 'err-' + Date.now(),
                role: 'system',
                text: `TrueForge is offline (${conn.error || 'Connection failed'}). Please check your TrueForge URL in Settings.`,
                isComplete: true,
              },
            });
            return;
          }

          // 3. Agent Mode vs Chat Mode
          if (isAgentMode) {
            try {
              await autonomousAgentCoordinator.executeTask(userText, {
                onStateChange: state => {
                  this.postMessage({
                    type: 'agentTaskUpdate',
                    payload: state,
                  });
                },
                onDelta: delta => {
                  this.postMessage({
                    type: 'messageChunk',
                    payload: {
                      id: 'agent-msg-' + Date.now(),
                      role: 'assistant',
                      text: delta,
                      isStreaming: true,
                    },
                  });
                },
                onError: err => {
                  logger.error(`[STAGE 9] Agent Mode error: ${err.message}`);
                  this.postMessage({
                    type: 'statusUpdate',
                    payload: { message: `Agent error: ${err.message}`, level: 'error' },
                  });
                },
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              logger.error(`[STAGE 9] Agent task execution failed: ${msg}`);
              this.postMessage({
                type: 'statusUpdate',
                payload: { message: `Task failed: ${msg}`, level: 'error' },
              });
            }
            return;
          }

          // 4. Chat Mode: Assemble workspace context
          const assistantMsgId = 'ast-' + Date.now();
          this.activeAssistantMsgId = assistantMsgId;
          this.currentAccumulatedText = '';
          let accumulatedText = '';

          try {
            const modelName = settingsManager.getDefaultModel();
            logger.log(`Preparing chat turn with model: ${modelName}`);

            const enriched = await ContextEngine.assembleContext(userText);
            const client = await trueforgeClientAdapter.getSdkClient();
            const sessionId = await sessionManager.getOrCreateSession(modelName);

            await turnStreamer.streamTurn(
              client,
              sessionId,
              enriched.fullPrompt,
              {
                onDelta: delta => {
                  accumulatedText += delta;
                  this.currentAccumulatedText = accumulatedText;
                  logger.log(
                    `[STAGE 7] Streaming callback onDelta dispatched to Webview (chunkLength: ${delta.length}, totalText: ${accumulatedText.length})`
                  );
                  this.postMessage({
                    type: 'messageChunk',
                    payload: {
                      id: assistantMsgId,
                      role: 'assistant',
                      text: accumulatedText,
                      isStreaming: true,
                    },
                  });
                },
                onReasoningDelta: rDelta => {
                  // Internal reasoning is recorded for diagnostics but never exposed in UI
                  logger.log(`[DIAGNOSTIC] Internal reasoning delta received (${rDelta.length} chars)`);
                },
                onTurnComplete: () => {
                  this.activeAssistantMsgId = undefined;
                  logger.log(
                    `[STAGE 7] Streaming callback onTurnComplete reached WebviewProvider (totalTextLength: ${accumulatedText.length})`
                  );
                  if (!accumulatedText.trim()) {
                    logger.warn(
                      `[STAGE 6/9] Turn complete but accumulatedText is empty! Model: ${modelName}`
                    );
                    this.postMessage({
                      type: 'messageChunk',
                      payload: {
                        id: assistantMsgId,
                        role: 'assistant',
                        text: `⚠️ TrueForge completed the turn, but model "${modelName}" produced no response text. Check the "Runtime Terrors" Output channel for details or select a different model in Settings.`,
                        isComplete: true,
                        isStreaming: false,
                      },
                    });
                  } else {
                    this.postMessage({
                      type: 'messageChunk',
                      payload: {
                        id: assistantMsgId,
                        role: 'assistant',
                        text: accumulatedText,
                        isComplete: true,
                        isStreaming: false,
                      },
                    });
                  }
                },
                onError: err => {
                  this.activeAssistantMsgId = undefined;
                  // (3) Log any caught exception with its full message
                  logger.error(`Caught exception: ${err.message}`, err.stack || '');
                  this.postMessage({
                    type: 'messageChunk',
                    payload: {
                      id: assistantMsgId,
                      role: 'assistant',
                      text: `❌ TrueForge Error: ${err.message}`,
                      isComplete: true,
                      isStreaming: false,
                    },
                  });
                },
              },
              modelName
            );
          } catch (err: unknown) {
            this.activeAssistantMsgId = undefined;
            const errorObj = err instanceof Error ? err : new Error(String(err));
            // (3) Log any caught exception with its full message
            logger.error(`Caught exception: ${errorObj.message}`, errorObj.stack || '');
            this.postMessage({
              type: 'messageChunk',
              payload: {
                id: assistantMsgId,
                role: 'assistant',
                text: `❌ Execution failed: ${errorObj.message}`,
                isComplete: true,
                isStreaming: false,
              },
            });
          }
          break;
        }
      }
    });
  }

  public async checkAndBroadcastConnection(): Promise<TrueForgeConnectionState> {
    this.postMessage({
      type: 'connectionStatus',
      payload: {
        connected: false,
        url: settingsManager.getTrueForgeUrl(),
        checking: true,
      },
    });

    const state = await trueforgeClientAdapter.testConnection();
    this.postMessage({
      type: 'connectionStatus',
      payload: state,
    });

    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(state);
    }
    return state;
  }

  public async sendSettings() {
    const trueforgeUrl = settingsManager.getTrueForgeUrl();
    const hasToken = await settingsManager.hasApiToken();
    const defaultModel = settingsManager.getDefaultModel();

    this.postMessage({
      type: 'settingsLoaded',
      payload: {
        trueforgeUrl,
        hasToken,
        defaultModel,
      },
    });
  }

  public postMessage(message: ExtensionToWebviewMessage) {
    this.view?.webview.postMessage(message);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const webviewDist = path.join(this.extensionUri.fsPath, 'dist', 'webview');
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.js')
    );

    let styleUri: vscode.Uri | undefined;
    const directCss = path.join(webviewDist, 'index.css');
    const assetsDir = path.join(webviewDist, 'assets');

    if (fs.existsSync(directCss)) {
      styleUri = webview.asWebviewUri(vscode.Uri.file(directCss));
    } else if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      const cssFile = files.find(f => f.endsWith('.css'));
      if (cssFile) {
        styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, cssFile)));
      }
    }

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Runtime Terrors</title>
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}" />` : ''}
</head>
<body class="bg-[#0f1117] text-gray-100 antialiased overflow-hidden select-none">
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
