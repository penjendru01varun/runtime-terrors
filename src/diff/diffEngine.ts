import { structuredPatch } from 'diff';

export type HunkStatus = 'pending' | 'accepted' | 'rejected';

export interface DiffLine {
  type: 'add' | 'del' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  status: HunkStatus;
  rawText: string;
}

export interface FileDiff {
  fileUri: string;
  relativePath: string;
  originalContent: string;
  proposedContent: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export class DiffEngine {
  /**
   * Computes a structured file diff with individual hunks and line-level changes.
   */
  public static computeFileDiff(params: {
    fileUri: string;
    relativePath: string;
    originalContent: string;
    proposedContent: string;
  }): FileDiff {
    const { fileUri, relativePath, originalContent, proposedContent } = params;

    const patch = structuredPatch(
      relativePath,
      relativePath,
      originalContent,
      proposedContent,
      'Original',
      'Proposed',
      { context: 3 }
    );

    let additions = 0;
    let deletions = 0;

    const hunks: DiffHunk[] = patch.hunks.map((h, hunkIdx) => {
      let curOldLine = h.oldStart;
      let curNewLine = h.newStart;

      const lines: DiffLine[] = [];
      for (const lineStr of h.lines) {
        // Skip jsdiff metadata lines (e.g. "\ No newline at end of file")
        if (lineStr.startsWith('\\')) {
          continue;
        }

        const prefix = lineStr[0];
        const content = lineStr.slice(1);

        if (prefix === '+') {
          additions++;
          lines.push({
            type: 'add',
            content,
            newLineNumber: curNewLine++,
          });
        } else if (prefix === '-') {
          deletions++;
          lines.push({
            type: 'del',
            content,
            oldLineNumber: curOldLine++,
          });
        } else {
          lines.push({
            type: 'context',
            content,
            oldLineNumber: curOldLine++,
            newLineNumber: curNewLine++,
          });
        }
      }

      return {
        id: `hunk-${hunkIdx}-${h.oldStart}-${h.newStart}`,
        oldStart: h.oldStart,
        oldLines: h.oldLines,
        newStart: h.newStart,
        newLines: h.newLines,
        lines,
        status: 'pending' as HunkStatus,
        rawText: h.lines.join('\n'),
      };
    });

    return {
      fileUri,
      relativePath,
      originalContent,
      proposedContent,
      hunks,
      additions,
      deletions,
    };
  }

  /**
   * Applies only the accepted hunks to the original content, skipping rejected hunks.
   */
  public static reconstructContentWithHunkDecisions(
    originalContent: string,
    hunks: DiffHunk[]
  ): string {
    const originalLines = originalContent.split(/\r?\n/);
    const resultLines: string[] = [];
    let curOriginalIndex = 0; // 0-based index into originalLines

    for (const hunk of hunks) {
      const hunkStartIdx = Math.max(0, hunk.oldStart - 1);

      // Copy original lines up to the start of this hunk
      while (curOriginalIndex < hunkStartIdx && curOriginalIndex < originalLines.length) {
        resultLines.push(originalLines[curOriginalIndex]!);
        curOriginalIndex++;
      }

      if (hunk.status === 'accepted') {
        // Apply hunk: write context and added lines, skip deleted lines
        for (const dl of hunk.lines) {
          if (dl.type === 'add') {
            resultLines.push(dl.content);
          } else if (dl.type === 'context') {
            resultLines.push(dl.content);
            curOriginalIndex++;
          } else if (dl.type === 'del') {
            curOriginalIndex++;
          }
        }
      } else {
        // Rejected or Pending: keep original lines unmodified
        const hunkEndIdx = Math.min(originalLines.length, hunkStartIdx + hunk.oldLines);
        while (curOriginalIndex < hunkEndIdx) {
          resultLines.push(originalLines[curOriginalIndex]!);
          curOriginalIndex++;
        }
      }
    }

    // Copy any remaining lines after the last hunk
    while (curOriginalIndex < originalLines.length) {
      resultLines.push(originalLines[curOriginalIndex]!);
      curOriginalIndex++;
    }

    return resultLines.join('\n');
  }
}

