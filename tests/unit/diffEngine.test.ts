import { describe, expect, it } from 'vitest';
import { DiffEngine } from '../../src/diff/diffEngine';

describe('DiffEngine', () => {
  it('returns empty hunks and zero changes for identical content', () => {
    const text = 'const a = 1;\nconst b = 2;\n';
    const diff = DiffEngine.computeFileDiff({
      fileUri: 'file:///workspace/test.ts',
      relativePath: 'test.ts',
      originalContent: text,
      proposedContent: text,
    });

    expect(diff.additions).toBe(0);
    expect(diff.deletions).toBe(0);
    expect(diff.hunks).toHaveLength(0);
    expect(diff.relativePath).toBe('test.ts');
  });

  it('correctly calculates additions, deletions, and hunks for single replacement', () => {
    const original = 'line 1\nline 2\nline 3\n';
    const proposed = 'line 1\nline 2 modified\nline 3\n';

    const diff = DiffEngine.computeFileDiff({
      fileUri: 'file:///workspace/test.ts',
      relativePath: 'test.ts',
      originalContent: original,
      proposedContent: proposed,
    });

    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(1);
    expect(diff.hunks.length).toBeGreaterThanOrEqual(1);

    const hunk = diff.hunks[0];
    expect(hunk.status).toBe('pending');
    expect(hunk.lines.some(l => l.type === 'del' && l.content === 'line 2')).toBe(true);
    expect(hunk.lines.some(l => l.type === 'add' && l.content === 'line 2 modified')).toBe(true);
  });

  it('handles brand new file creation (all additions)', () => {
    const original = '';
    const proposed = 'export const greeting = "hello";\nexport const version = 1;\n';

    const diff = DiffEngine.computeFileDiff({
      fileUri: 'file:///workspace/new.ts',
      relativePath: 'new.ts',
      originalContent: original,
      proposedContent: proposed,
    });

    expect(diff.deletions).toBe(0);
    expect(diff.additions).toBe(2);
    expect(diff.hunks.length).toBe(1);
    expect(diff.hunks[0].lines.every(l => l.type === 'add')).toBe(true);
  });

  it('handles complete file deletion (all deletions)', () => {
    const original = 'line 1\nline 2\n';
    const proposed = '';

    const diff = DiffEngine.computeFileDiff({
      fileUri: 'file:///workspace/old.ts',
      relativePath: 'old.ts',
      originalContent: original,
      proposedContent: proposed,
    });

    expect(diff.deletions).toBe(2);
    expect(diff.additions).toBe(0);
    expect(diff.hunks.length).toBe(1);
    expect(diff.hunks[0].lines.every(l => l.type === 'del')).toBe(true);
  });

  describe('reconstructContentWithHunkDecisions', () => {
    const original = [
      '// header',
      'function alpha() {',
      '  return 1;',
      '}',
      '// middle',
      'function beta() {',
      '  return 2;',
      '}',
      '// footer',
    ].join('\n');

    const proposed = [
      '// header',
      'function alpha() {',
      '  return 100;', // change 1
      '}',
      '// middle',
      'function beta() {',
      '  return 200;', // change 2
      '}',
      '// footer',
    ].join('\n');

    it('returns exact proposed content when all hunks are accepted', () => {
      const diff = DiffEngine.computeFileDiff({
        fileUri: 'file:///workspace/multi.ts',
        relativePath: 'multi.ts',
        originalContent: original,
        proposedContent: proposed,
      });

      for (const h of diff.hunks) {
        h.status = 'accepted';
      }

      const result = DiffEngine.reconstructContentWithHunkDecisions(original, diff.hunks);
      expect(result.trim()).toBe(proposed.trim());
    });

    it('preserves original content when all hunks are rejected', () => {
      const diff = DiffEngine.computeFileDiff({
        fileUri: 'file:///workspace/multi.ts',
        relativePath: 'multi.ts',
        originalContent: original,
        proposedContent: proposed,
      });

      for (const h of diff.hunks) {
        h.status = 'rejected';
      }

      const result = DiffEngine.reconstructContentWithHunkDecisions(original, diff.hunks);
      expect(result.trim()).toBe(original.trim());
    });

    it('selectively applies only accepted hunks while discarding rejected hunks', () => {
      const diff = DiffEngine.computeFileDiff({
        fileUri: 'file:///workspace/multi.ts',
        relativePath: 'multi.ts',
        originalContent: original,
        proposedContent: proposed,
      });

      expect(diff.hunks.length).toBeGreaterThanOrEqual(1);

      if (diff.hunks.length >= 2) {
        // Accept hunk 0 (alpha change) and reject hunk 1 (beta change)
        diff.hunks[0].status = 'accepted';
        diff.hunks[1].status = 'rejected';

        const result = DiffEngine.reconstructContentWithHunkDecisions(original, diff.hunks);
        expect(result).toContain('return 100;');
        expect(result).toContain('return 2;');
        expect(result).not.toContain('return 200;');
      } else {
        // Single hunk scenario
        diff.hunks[0].status = 'accepted';
        const result = DiffEngine.reconstructContentWithHunkDecisions(original, diff.hunks);
        expect(result.trim()).toBe(proposed.trim());
      }
    });
  });
});

