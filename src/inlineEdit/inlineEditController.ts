import * as vscode from 'vscode';
import { diffManager } from '../diff/diffManager';
import { sessionManager } from '../trueforge/sessionManager';
import { trueforgeClientAdapter } from '../trueforge/client';
import { turnStreamer } from '../trueforge/turnStreamer';
import { logger } from '../utils/logger';
import { InlineEditPromptTemplate } from './promptTemplate';

export interface ProposedInlineEdit {
  documentUri: vscode.Uri;
  range: vscode.Range;
  originalText: string;
  proposedText: string;
  instruction: string;
}

export class InlineEditController {
  private lastProposedEdit?: ProposedInlineEdit;

  public getLastProposedEdit(): ProposedInlineEdit | undefined {
    return this.lastProposedEdit;
  }

  public async triggerInlineEdit(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Runtime Terrors: Open a file and select code to edit.');
      return;
    }

    const selection = editor.selection;
    let targetRange: vscode.Range = selection;
    let selectedText = editor.document.getText(selection);

    if (selection.isEmpty) {
      const line = editor.document.lineAt(selection.active.line);
      targetRange = line.range;
      selectedText = line.text;
    }

    if (!selectedText.trim()) {
      vscode.window.showInformationMessage('Runtime Terrors: Please select non-empty code to edit.');
      return;
    }

    const instruction = await vscode.window.showInputBox({
      title: 'Runtime Terrors: Inline Code Edit',
      prompt: 'Describe the modification you want TrueForge to make:',
      placeHolder: 'e.g. Refactor this function to handle async errors and add TypeScript types',
    });

    if (!instruction || !instruction.trim()) {
      return;
    }

    // Check TrueForge connection
    const conn = await trueforgeClientAdapter.testConnection();
    if (!conn.connected) {
      vscode.window.showErrorMessage(
        `Runtime Terrors: TrueForge is offline (${conn.error || 'Connection failed'}). Check settings.`
      );
      return;
    }

    const doc = editor.document;
    const filePath = vscode.workspace.asRelativePath(doc.uri, false);
    const languageId = doc.languageId;

    // Get surrounding context (up to 10 lines before and after)
    const startLine = Math.max(0, targetRange.start.line - 10);
    const endLine = Math.min(doc.lineCount - 1, targetRange.end.line + 10);
    const surroundingContext = doc.getText(
      new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length)
    );

    const prompt = InlineEditPromptTemplate.buildUserPrompt({
      instruction: instruction.trim(),
      selectedCode: selectedText,
      filePath,
      languageId,
      surroundingContext,
    });

    let accumulatedRaw = '';

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Runtime Terrors: TrueForge is generating edit...',
        cancellable: true,
      },
      async (_progress, token) => {
        token.onCancellationRequested(() => {
          turnStreamer.cancel();
          logger.log('Inline edit turn cancelled by user.');
        });

        try {
          const client = await trueforgeClientAdapter.getSdkClient();
          const sessionId = await sessionManager.getOrCreateSession();

          await turnStreamer.streamTurn(client, sessionId, prompt, {
            onDelta: delta => {
              accumulatedRaw += delta;
            },
            onError: err => {
              logger.error('Inline edit streaming error:', err.message);
              vscode.window.showErrorMessage(`TrueForge edit failed: ${err.message}`);
            },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('Failed inline edit turn:', msg);
          vscode.window.showErrorMessage(`TrueForge edit error: ${msg}`);
          return;
        }
      }
    );

    if (!accumulatedRaw.trim()) {
      return;
    }

    const proposedReplacement = InlineEditPromptTemplate.extractCodeFromResponse(accumulatedRaw);

    this.lastProposedEdit = {
      documentUri: doc.uri,
      range: targetRange,
      originalText: selectedText,
      proposedText: proposedReplacement,
      instruction,
    };

    logger.log(`Received proposed inline edit (${proposedReplacement.length} chars)`);

    // Compute the full proposed document content and register with DiffManager
    const fullOriginal = doc.getText();
    const prefix = doc.getText(new vscode.Range(new vscode.Position(0, 0), targetRange.start));
    const suffix = doc.getText(new vscode.Range(targetRange.end, doc.positionAt(fullOriginal.length)));
    const proposedFullContent = prefix + proposedReplacement + suffix;

    await diffManager.registerProposedDiff({
      fileUri: doc.uri,
      proposedContent: proposedFullContent,
      description: instruction,
    });

    // Prompt user to accept, preview, or reject
    const choice = await vscode.window.showInformationMessage(
      'Runtime Terrors: TrueForge proposed a code modification.',
      'Accept Replacement',
      'Preview Changes',
      'Discard'
    );

    if (choice === 'Accept Replacement') {
      await diffManager.acceptAllHunks(doc.uri.toString());
      vscode.window.showInformationMessage('Runtime Terrors: Applied code replacement with rollback support.');
    } else if (choice === 'Preview Changes') {
      await diffManager.openNativeDiff(doc.uri.toString());
      await vscode.commands.executeCommand('runtime-terrors.chatView.focus');
    } else if (choice === 'Discard') {
      diffManager.rejectAllHunks(doc.uri.toString());
      vscode.window.showInformationMessage('Runtime Terrors: Discarded proposed replacement.');
    }
  }
}

export const inlineEditController = new InlineEditController();
