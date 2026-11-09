import * as path from 'node:path';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export class FileSyncGuard {
  private static readonly SENSITIVE_PATTERNS = [
    /^\.env(\..+)?$/i,
    /^id_[a-z0-9_-]+$/i,
    /\.(pem|key|pfx|p12|pkcs12)$/i,
    /credentials\.json$/i,
    /service-account.*\.json$/i,
    /\.npmrc$/i,
    /\.dockercfg$/i,
    /\.aws(\/|\\)credentials/i,
  ];

  /**
   * Validates that the requested target path resolves strictly inside one of the
   * current workspace folders, preventing path traversal attacks and sensitive access.
   */
  public static validatePath(inputPath: string | vscode.Uri): vscode.Uri {
    const rawPath = typeof inputPath === 'string' ? inputPath : inputPath.fsPath;
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('Security Error: No workspace folder is open in VS Code.');
    }

    // Resolve absolute path
    let resolvedPath = path.isAbsolute(rawPath)
      ? path.normalize(rawPath)
      : path.normalize(path.join(workspaceFolders[0]!.uri.fsPath, rawPath));

    // Ensure path resolves within at least one workspace folder
    const matchingFolder = workspaceFolders.find(wf => {
      const folderPath = path.normalize(wf.uri.fsPath);
      // Case-insensitive check on Windows
      const normResolved = process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
      const normFolder = process.platform === 'win32' ? folderPath.toLowerCase() : folderPath;
      return normResolved === normFolder || normResolved.startsWith(normFolder + path.sep);
    });

    if (!matchingFolder) {
      logger.warn(`Security blocked path outside workspace: ${rawPath}`);
      throw new Error(
        `Security Error: Access to path "${rawPath}" is denied because it is outside the workspace boundaries.`
      );
    }

    // Check for sensitive files
    const basename = path.basename(resolvedPath);
    if (this.isSensitive(basename, resolvedPath)) {
      logger.warn(`Security blocked access to sensitive file: ${resolvedPath}`);
      throw new Error(`Security Error: Access to sensitive file "${basename}" is prohibited.`);
    }

    return vscode.Uri.file(resolvedPath);
  }

  /**
   * Checks whether a file path or filename is considered sensitive.
   */
  public static isSensitive(basename: string, fullPath?: string): boolean {
    for (const pattern of this.SENSITIVE_PATTERNS) {
      if (pattern.test(basename)) {
        return true;
      }
      if (fullPath && pattern.test(fullPath)) {
        return true;
      }
    }
    return false;
  }
}

