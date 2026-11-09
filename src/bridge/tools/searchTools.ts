import * as vscode from 'vscode';
import { logger } from '../../utils/logger';
import { FileSyncGuard } from '../fileSyncGuard';

export interface SearchWorkspaceInput {
  query: string;
  maxResults?: number;
  filePattern?: string;
}

export interface SearchMatch {
  filePath: string;
  line: number;
  lineText: string;
}

export class SearchTools {
  /**
   * Searches the workspace files for text matches or patterns.
   */
  public static async searchWorkspace(input: SearchWorkspaceInput): Promise<{
    query: string;
    totalMatches: number;
    matches: SearchMatch[];
  }> {
    const { query, maxResults = 50, filePattern = '**/*' } = input;
    const matches: SearchMatch[] = [];

    try {
      // Find candidate files matching pattern, excluding noise directories
      const excludePattern = '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**}';
      const fileUris = await vscode.workspace.findFiles(filePattern, excludePattern, 100);

      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      for (const uri of fileUris) {
        if (matches.length >= maxResults) break;

        // Security check
        if (FileSyncGuard.isSensitive(uri.fsPath)) continue;

        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
          const relPath = workspaceFolder
            ? vscode.workspace.asRelativePath(uri, false)
            : uri.fsPath;

          for (let i = 0; i < doc.lineCount; i++) {
            if (matches.length >= maxResults) break;

            const line = doc.lineAt(i);
            if (regex.test(line.text)) {
              matches.push({
                filePath: relPath,
                line: i + 1,
                lineText: line.text.trim(),
              });
            }
          }
        } catch {
          // Skip unreadable files (binary etc.)
          continue;
        }
      }

      logger.log(`Workspace search for "${query}" found ${matches.length} matches`);

      return {
        query,
        totalMatches: matches.length,
        matches,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Error during workspace search:', msg);
      throw err;
    }
  }
}

