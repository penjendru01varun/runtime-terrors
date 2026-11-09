import * as vscode from 'vscode';
import { workspaceMcpServer } from './bridge/workspaceMcpServer';
import { settingsManager } from './config/settings';
import { diffManager } from './diff/diffManager';
import { virtualDocumentProvider, VirtualDocumentProvider } from './diff/virtualDocumentProvider';
import { inlineEditController } from './inlineEdit/inlineEditController';
import { trueforgeClientAdapter } from './trueforge/client';
import { sessionManager } from './trueforge/sessionManager';
import { logger } from './utils/logger';
import { RuntimeTerrorsWebviewProvider } from './webview/WebviewProvider';
import type { TrueForgeConnectionState } from './webview/messageProtocol';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  logger.init();
  logger.log('Runtime Terrors extension activating...');

  // Initialize secure settings
  settingsManager.init(context);

  // Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'runtime-terrors.connectTrueForge';
  statusBarItem.text = '$(sync~spin) TrueForge: Connecting';
  statusBarItem.tooltip = 'Click to test TrueForge connection';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = (state: TrueForgeConnectionState) => {
    if (state.checking) {
      statusBarItem.text = '$(sync~spin) TrueForge';
      statusBarItem.tooltip = 'Connecting to TrueForge...';
    } else if (state.connected) {
      statusBarItem.text = `$(check) TrueForge (${state.latencyMs ?? 0}ms)`;
      statusBarItem.tooltip = `Connected to TrueForge at ${state.url}`;
    } else {
      statusBarItem.text = '$(alert) TrueForge Offline';
      statusBarItem.tooltip = state.error || 'TrueForge server is unreachable';
    }
  };

  // Webview Provider
  const webviewProvider = new RuntimeTerrorsWebviewProvider(
    context.extensionUri,
    updateStatusBar
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      RuntimeTerrorsWebviewProvider.viewType,
      webviewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Register Virtual Document Content Provider for Side-by-Side Diffing
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      VirtualDocumentProvider.SCHEME,
      virtualDocumentProvider
    )
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('runtime-terrors.openChat', async () => {
      await vscode.commands.executeCommand('runtime-terrors.chatView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('runtime-terrors.connectTrueForge', async () => {
      statusBarItem.text = '$(sync~spin) TrueForge';
      const state = await webviewProvider.checkAndBroadcastConnection();
      if (state.connected) {
        if (!workspaceMcpServer.isRegisteredWithTrueForge()) {
          try {
            const client = await trueforgeClientAdapter.getSdkClient();
            await workspaceMcpServer.registerWithTrueForge(client);
          } catch {
            // Non-blocking
          }
        }
        vscode.window.showInformationMessage(
          `Runtime Terrors: Connected to TrueForge at ${state.url} (${state.latencyMs}ms)`
        );
      } else {
        vscode.window.showWarningMessage(
          `Runtime Terrors: TrueForge connection failed (${state.error || 'Offline'}). Check your settings.`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('runtime-terrors.newSession', () => {
      sessionManager.resetSession();
      webviewProvider.postMessage({
        type: 'statusUpdate',
        payload: { message: 'Ready for new TrueForge session', level: 'info' },
      });
      vscode.window.showInformationMessage('Runtime Terrors: Session refreshed.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('runtime-terrors.inlineEdit', async () => {
      await inlineEditController.triggerInlineEdit();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('runtime-terrors.autonomousAgent', async () => {
      const task = await vscode.window.showInputBox({
        title: 'Runtime Terrors: Launch Autonomous Agent',
        prompt: 'Describe the multi-step coding task for TrueForge:',
        placeHolder: 'e.g. Audit codebase for security issues and propose fixes',
      });
      if (task && task.trim()) {
        await vscode.commands.executeCommand('runtime-terrors.chatView.focus');
        webviewProvider.postMessage({
          type: 'statusUpdate',
          payload: { message: `Autonomous Task started: ${task.trim()}`, level: 'info' },
        });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('runtime-terrors.reviewDiffs', async () => {
      const pending = diffManager.getAllPendingDiffs();
      if (pending.length > 0) {
        await diffManager.openNativeDiff(pending[0].fileUri);
        await vscode.commands.executeCommand('runtime-terrors.chatView.focus');
      } else {
        vscode.window.showInformationMessage('Runtime Terrors: No pending proposed changes to review.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('runtime-terrors.undoChange', async () => {
      const undone = await diffManager.undoLastChange();
      if (undone) {
        vscode.window.showInformationMessage(
          `Runtime Terrors: Reverted last change to ${vscode.workspace.asRelativePath(undone.fileUri)}.`
        );
      } else {
        vscode.window.showInformationMessage('Runtime Terrors: No changes left to undo.');
      }
    })
  );

  // Start Workspace MCP HTTP/SSE server and attempt registration with TrueForge
  void workspaceMcpServer
    .startHttpServer(3182)
    .then(async info => {
      logger.log(`Workspace MCP HTTP/SSE server ready at: ${info.url}`);
      try {
        const client = await trueforgeClientAdapter.getSdkClient();
        await workspaceMcpServer.registerWithTrueForge(client, info.url);
      } catch {
        // Will attempt registration when TrueForge connects
      }
    })
    .catch(err => {
      logger.warn('Failed to start Workspace MCP HTTP server:', String(err));
    });

  // Trigger initial background connection check
  void webviewProvider.checkAndBroadcastConnection();

  logger.log('Runtime Terrors extension activated successfully.');
}

export function deactivate() {
  logger.log('Runtime Terrors extension deactivating...');
  void workspaceMcpServer.stopHttpServer();
}
