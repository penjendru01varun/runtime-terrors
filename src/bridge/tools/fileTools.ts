import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { diffManager } from '../../diff/diffManager';
import { logger } from '../../utils/logger';
import { FileSyncGuard } from '../fileSyncGuard';

export interface ReadFileInput {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export interface ListDirectoryInput {
  directoryPath?: string;
  recursive?: boolean;
  maxDepth?: number;
}

export interface ProposeFileChangeInput {
  filePath: string;
  proposedContent: string;
  description?: string;
}

export class FileTools {
  /**
   * Safely reads file contents within the workspace boundary.
   */
  public static async readFile(input: ReadFileInput): Promise<{
    filePath: string;
    content: string;
    totalLines: number;
    byteLength: number;
  }> {
    const safeUri = FileSyncGuard.validatePath(input.filePath);
    const doc = await vscode.workspace.openTextDocument(safeUri);
    const fullText = doc.getText();
    const lines = fullText.split(/\r?\n/);

    let content = fullText;
    if (input.startLine !== undefined || input.endLine !== undefined) {
      const start = Math.max(0, (input.startLine ?? 1) - 1);
      const end = Math.min(lines.length, input.endLine ?? lines.length);
      content = lines.slice(start, end).join('\n');
    }

    return {
      filePath: input.filePath,
      content,
      totalLines: lines.length,
      byteLength: Buffer.byteLength(content, 'utf8'),
    };
  }

  /**
   * Lists files and folders within a directory safely inside the workspace.
   */
  public static async listDirectory(input: ListDirectoryInput): Promise<{
    directoryPath: string;
    entries: Array<{ name: string; type: 'file' | 'directory'; relativePath: string }>;
  }> {
    const rawDir = input.directoryPath || '.';
    const safeUri = FileSyncGuard.validatePath(rawDir);
    const dirPath = safeUri.fsPath;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const rootPath = workspaceFolders?.[0]?.uri.fsPath || dirPath;

    const maxDepth = input.maxDepth ?? 3;
    const recursive = input.recursive ?? false;

    const entries: Array<{ name: string; type: 'file' | 'directory'; relativePath: string }> = [];

    const walk = async (currentDir: string, currentDepth: number) => {
      if (currentDepth > maxDepth) return;

      const dirents = await fs.readdir(currentDir, { withFileTypes: true });

      for (const dirent of dirents) {
        const name = dirent.name;
        // Ignore noise directories
        if (
          name === 'node_modules' ||
          name === '.git' ||
          name === 'dist' ||
          name === 'build' ||
          name === '.vscode' ||
          name.startsWith('.')
        ) {
          continue;
        }

        const fullPath = path.join(currentDir, name);
        const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

        if (dirent.isDirectory()) {
          entries.push({ name, type: 'directory', relativePath: relPath });
          if (recursive) {
            await walk(fullPath, currentDepth + 1);
          }
        } else if (dirent.isFile()) {
          entries.push({ name, type: 'file', relativePath: relPath });
        }
      }
    };

    await walk(dirPath, 1);

    return {
      directoryPath: rawDir,
      entries,
    };
  }

  /**
   * Proposes a change to a workspace file and registers it in DiffManager for review.
   * NEVER overwrites files automatically.
   */
  public static async proposeFileChange(input: ProposeFileChangeInput): Promise<{
    filePath: string;
    additions: number;
    deletions: number;
    hunkCount: number;
    status: 'pending_review';
    message: string;
  }> {
    const safeUri = FileSyncGuard.validatePath(input.filePath);

    logger.log(`Proposing change for ${input.filePath}: "${input.description || 'AI Edit'}"`);

    const fileDiff = await diffManager.registerProposedDiff({
      fileUri: safeUri,
      proposedContent: input.proposedContent,
      description: input.description,
    });

    return {
      filePath: input.filePath,
      additions: fileDiff.additions,
      deletions: fileDiff.deletions,
      hunkCount: fileDiff.hunks.length,
      status: 'pending_review',
      message: `Change proposed for ${fileDiff.relativePath} (+${fileDiff.additions}, -${fileDiff.deletions}). Awaiting developer review in Runtime Terrors Diff Reviewer.`,
    };
  }
}

