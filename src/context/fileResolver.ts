import * as path from 'node:path';
import * as vscode from 'vscode';
import { FileSyncGuard } from '../bridge/fileSyncGuard';

export interface ResolvedFileContext {
  reference: string;
  relativePath: string;
  fullPath: string;
  content: string;
  isTruncated: boolean;
  totalLines: number;
}

export class FileResolver {
  private static readonly MAX_FILE_SIZE_BYTES = 50 * 1024; // 50 KB ceiling per file
  private static readonly MAX_LINES = 600; // max 600 lines per file

  /**
   * Extracts `@file:path`, `@file path`, `@file "path with spaces"`, or `@path/to/file.ext` patterns from user text.
   */
  public static extractFileReferences(text: string): string[] {
    const refs = new Set<string>();

    // 1. Matches @file:"path with spaces" or @file "path with spaces"
    const quotedRegex = /@file[:\s]+"([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = quotedRegex.exec(text)) !== null) {
      if (m[1]) refs.add(m[1].trim());
    }

    // 2. Matches @file:path/to/file or @file path/to/file
    const explicitRegex = /@file[:\s]+([^\s"']+)/gi;
    while ((m = explicitRegex.exec(text)) !== null) {
      if (m[1]) refs.add(m[1].trim());
    }

    // 3. Matches @path/to/file.ext
    const implicitRegex = /@([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_]+)/g;
    while ((m = implicitRegex.exec(text)) !== null) {
      if (m[1] && !m[1].toLowerCase().startsWith('file:') && !m[1].toLowerCase().startsWith('file ')) {
        refs.add(m[1].trim());
      }
    }

    return Array.from(refs);
  }

  public static isSensitiveFile(filePath: string): boolean {
    const baseName = path.basename(filePath);
    return FileSyncGuard.isSensitive(baseName, filePath);
  }

  public static async resolveFileReference(
    ref: string,
    workspaceFolders?: readonly vscode.WorkspaceFolder[]
  ): Promise<ResolvedFileContext | null> {
    const folders = workspaceFolders ?? vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }

    // Clean reference
    const cleanRef = ref.replace(/^file:?\s*/i, '').trim();

    if (this.isSensitiveFile(cleanRef)) {
      return {
        reference: ref,
        relativePath: cleanRef,
        fullPath: '',
        content: `[SECURITY: File "${cleanRef}" is excluded as a sensitive configuration/secret file.]`,
        isTruncated: false,
        totalLines: 0,
      };
    }

    for (const folder of folders) {
      const rootPath = path.normalize(folder.uri.fsPath);
      const targetPath = path.normalize(path.resolve(rootPath, cleanRef));

      // Path traversal check with cross-platform normalization
      const normTarget = process.platform === 'win32' ? targetPath.toLowerCase() : targetPath;
      const normRoot = process.platform === 'win32' ? rootPath.toLowerCase() : rootPath;

      if (!normTarget.startsWith(normRoot)) {
        return null;
      }

      try {
        const uri = vscode.Uri.file(targetPath);
        const stat = await vscode.workspace.fs.stat(uri);

        if (stat.type !== vscode.FileType.File) {
          continue;
        }

        const bytes = await vscode.workspace.fs.readFile(uri);
        const rawContent = Buffer.from(bytes).toString('utf-8');
        const lines = rawContent.split(/\r?\n/);
        const totalLines = lines.length;

        let content = rawContent;
        let isTruncated = false;

        if (bytes.length > this.MAX_FILE_SIZE_BYTES || totalLines > this.MAX_LINES) {
          content =
            lines.slice(0, this.MAX_LINES).join('\n') +
            `\n\n... [TRUNCATED: File exceeds ${this.MAX_LINES} lines limit. Read ${this.MAX_LINES} of ${totalLines} lines.]`;
          isTruncated = true;
        }

        const relativePath = path.relative(rootPath, targetPath).replace(/\\/g, '/');

        return {
          reference: ref,
          relativePath,
          fullPath: targetPath,
          content,
          isTruncated,
          totalLines,
        };
      } catch {
        // File does not exist in this folder, try next
        continue;
      }
    }

    return null;
  }
}
