import * as vscode from 'vscode';
import { FileSyncGuard } from '../bridge/fileSyncGuard';
import { logger } from '../utils/logger';
import { changeApplier, type RollbackRecord } from './changeApplier';
import { DiffEngine, type FileDiff, type HunkStatus } from './diffEngine';
import { DiffViewer } from './diffViewer';

export class DiffManager {
  private static instance: DiffManager;
  private pendingDiffs = new Map<string, FileDiff>();

  private _onDidChangePendingDiffs = new vscode.EventEmitter<FileDiff[]>();
  public readonly onDidChangePendingDiffs = this._onDidChangePendingDiffs.event;

  public static getInstance(): DiffManager {
    if (!DiffManager.instance) {
      DiffManager.instance = new DiffManager();
    }
    return DiffManager.instance;
  }

  public getAllPendingDiffs(): FileDiff[] {
    return Array.from(this.pendingDiffs.values());
  }

  public getPendingDiff(fileUriString: string): FileDiff | undefined {
    return this.pendingDiffs.get(fileUriString);
  }

  /**
   * Registers a proposed modification to a file, computing hunk-level diffs.
   */
  public async registerProposedDiff(params: {
    fileUri: vscode.Uri;
    proposedContent: string;
    description?: string;
  }): Promise<FileDiff> {
    const { fileUri, proposedContent } = params;

    // Validate path safety
    const safeUri = FileSyncGuard.validatePath(fileUri);

    let originalContent = '';
    try {
      const doc = await vscode.workspace.openTextDocument(safeUri);
      originalContent = doc.getText();
    } catch {
      // New file proposal
      originalContent = '';
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(safeUri);
    const relativePath = workspaceFolder
      ? vscode.workspace.asRelativePath(safeUri, false)
      : safeUri.fsPath;

    const fileDiff = DiffEngine.computeFileDiff({
      fileUri: safeUri.toString(),
      relativePath,
      originalContent,
      proposedContent,
    });

    this.pendingDiffs.set(safeUri.toString(), fileDiff);
    logger.log(
      `Registered proposed diff for ${relativePath} (+${fileDiff.additions}, -${fileDiff.deletions}, ${fileDiff.hunks.length} hunks)`
    );

    this._onDidChangePendingDiffs.fire(this.getAllPendingDiffs());
    return fileDiff;
  }

  /**
   * Updates the decision status of a single hunk (pending, accepted, rejected).
   */
  public setHunkStatus(
    fileUriString: string,
    hunkId: string,
    status: HunkStatus
  ): FileDiff | undefined {
    const diff = this.pendingDiffs.get(fileUriString);
    if (!diff) return undefined;

    const hunk = diff.hunks.find(h => h.id === hunkId);
    if (hunk) {
      hunk.status = status;
      logger.log(`Updated hunk ${hunkId} in ${diff.relativePath} to ${status}`);
      this._onDidChangePendingDiffs.fire(this.getAllPendingDiffs());
    }

    return diff;
  }

  /**
   * Accepts all hunks and applies the change to disk atomically.
   */
  public async acceptAllHunks(fileUriString: string): Promise<boolean> {
    const diff = this.pendingDiffs.get(fileUriString);
    if (!diff) return false;

    for (const h of diff.hunks) {
      h.status = 'accepted';
    }

    return await this.applyDecidedHunks(fileUriString);
  }

  /**
   * Rejects all hunks and discards the proposed change.
   */
  public rejectAllHunks(fileUriString: string): boolean {
    const diff = this.pendingDiffs.get(fileUriString);
    if (!diff) return false;

    this.pendingDiffs.delete(fileUriString);
    logger.log(`Rejected all proposed changes for ${diff.relativePath}`);
    this._onDidChangePendingDiffs.fire(this.getAllPendingDiffs());
    return true;
  }

  /**
   * Reconstructs the target content applying all accepted hunks and skipping rejected ones,
   * then writes the file using WorkspaceEdit with rollback logging.
   */
  public async applyDecidedHunks(fileUriString: string): Promise<boolean> {
    const diff = this.pendingDiffs.get(fileUriString);
    if (!diff) return false;

    const targetUri = vscode.Uri.parse(diff.fileUri);
    const safeUri = FileSyncGuard.validatePath(targetUri);

    const finalContent = DiffEngine.reconstructContentWithHunkDecisions(
      diff.originalContent,
      diff.hunks
    );

    const acceptedCount = diff.hunks.filter(h => h.status === 'accepted').length;
    const description = `Applied ${acceptedCount}/${diff.hunks.length} hunks to ${diff.relativePath}`;

    const applied = await changeApplier.applyFileChanges(safeUri, finalContent, description);

    if (applied) {
      this.pendingDiffs.delete(fileUriString);
      logger.log(`Successfully applied decided changes to ${diff.relativePath}`);
      this._onDidChangePendingDiffs.fire(this.getAllPendingDiffs());
      return true;
    }

    return false;
  }

  /**
   * Reverts the last applied file change using the rollback stack.
   */
  public async undoLastChange(): Promise<RollbackRecord | null> {
    return await changeApplier.undoLastChange();
  }

  /**
   * Opens the native side-by-side diff editor for a pending diff.
   */
  public async openNativeDiff(fileUriString: string): Promise<void> {
    const diff = this.pendingDiffs.get(fileUriString);
    if (!diff) return;

    const uri = vscode.Uri.parse(diff.fileUri);
    await DiffViewer.openNativeDiff({
      originalUri: uri,
      proposedContent: diff.proposedContent,
      title: `${diff.relativePath} (Review Changes)`,
    });
  }

  public clearPendingDiffs(): void {
    this.pendingDiffs.clear();
    this._onDidChangePendingDiffs.fire([]);
  }
}

export const diffManager = DiffManager.getInstance();

