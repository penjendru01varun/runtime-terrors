import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { virtualDocumentProvider, VirtualDocumentProvider } from './virtualDocumentProvider';

export class DiffViewer {
  /**
   * Opens VS Code's native side-by-side diff editor.
   * Left: Original file on disk.
   * Right: Virtual proposed document with AI modifications.
   */
  public static async openNativeDiff(params: {
    originalUri: vscode.Uri;
    proposedContent: string;
    title?: string;
  }): Promise<void> {
    const { originalUri, proposedContent, title } = params;

    try {
      // Build virtual URI with custom scheme
      const rightUri = originalUri.with({
        scheme: VirtualDocumentProvider.SCHEME,
        query: 'proposed=' + Date.now(),
      });

      // Populate virtual document provider
      virtualDocumentProvider.setDocumentContent(rightUri, proposedContent);

      const diffTitle = title || `${originalUri.fsPath} (Original ↔ Runtime Terrors Proposed)`;

      logger.log(`Opening native diff editor: ${diffTitle}`);

      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        rightUri,
        diffTitle,
        {
          preview: true,
          viewColumn: vscode.ViewColumn.Active,
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to open native diff editor:', msg);
      throw err;
    }
  }
}

