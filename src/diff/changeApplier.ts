import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export interface RollbackRecord {
  id: string;
  fileUri: vscode.Uri;
  previousContent: string;
  appliedContent: string;
  timestamp: string;
  description: string;
}

export class ChangeApplier {
  private static instance: ChangeApplier;
  private rollbackStack: RollbackRecord[] = [];

  public static getInstance(): ChangeApplier {
    if (!ChangeApplier.instance) {
      ChangeApplier.instance = new ChangeApplier();
    }
    return ChangeApplier.instance;
  }

  public getRollbackStack(): readonly RollbackRecord[] {
    return [...this.rollbackStack];
  }

  public canUndo(): boolean {
    return this.rollbackStack.length > 0;
  }

  /**
   * Atomically writes newContent to fileUri using VS Code's WorkspaceEdit API,
   * saving a reverse snapshot in the rollback stack.
   */
  public async applyFileChanges(
    fileUri: vscode.Uri,
    newContent: string,
    description: string
  ): Promise<boolean> {
    try {
      let previousContent = '';
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        previousContent = doc.getText();
      } catch {
        // File may be new
        previousContent = '';
      }

      const edit = new vscode.WorkspaceEdit();

      if (previousContent) {
        // Replace full document
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const fullRange = new vscode.Range(
          0,
          0,
          doc.lineCount,
          doc.lineAt(Math.max(0, doc.lineCount - 1)).text.length
        );
        edit.replace(fileUri, fullRange, newContent);
      } else {
        // Create file
        edit.createFile(fileUri, { ignoreIfExists: true, overwrite: true });
        edit.insert(fileUri, new vscode.Position(0, 0), newContent);
      }

      const applied = await vscode.workspace.applyEdit(edit);

      if (applied) {
        const record: RollbackRecord = {
          id: 'rb-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          fileUri,
          previousContent,
          appliedContent: newContent,
          timestamp: new Date().toISOString(),
          description,
        };
        this.rollbackStack.push(record);
        logger.log(`Successfully applied changes to ${fileUri.fsPath}. Rollback record saved.`);

        // Save document to persist
        const savedDoc = await vscode.workspace.openTextDocument(fileUri);
        await savedDoc.save();
        return true;
      } else {
        logger.warn(`Failed to apply WorkspaceEdit to ${fileUri.fsPath}`);
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error applying file changes to ${fileUri.fsPath}:`, msg);
      throw err;
    }
  }

  /**
   * Reverts the most recently applied change.
   */
  public async undoLastChange(): Promise<RollbackRecord | null> {
    const record = this.rollbackStack.pop();
    if (!record) {
      logger.log('Undo requested but rollback stack is empty.');
      return null;
    }

    try {
      const edit = new vscode.WorkspaceEdit();
      const doc = await vscode.workspace.openTextDocument(record.fileUri);
      const fullRange = new vscode.Range(
        0,
        0,
        doc.lineCount,
        doc.lineAt(Math.max(0, doc.lineCount - 1)).text.length
      );

      edit.replace(record.fileUri, fullRange, record.previousContent);
      const applied = await vscode.workspace.applyEdit(edit);

      if (applied) {
        await doc.save();
        logger.log(`Reverted changes for ${record.fileUri.fsPath} (Undo: ${record.description})`);
        return record;
      } else {
        // Push record back on failure
        this.rollbackStack.push(record);
        throw new Error(`Failed to apply undo WorkspaceEdit to ${record.fileUri.fsPath}`);
      }
    } catch (err: unknown) {
      this.rollbackStack.push(record);
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to undo change:', msg);
      throw err;
    }
  }

  public clearHistory(): void {
    this.rollbackStack = [];
  }
}

export const changeApplier = ChangeApplier.getInstance();

