import { describe, it, expect, vi } from 'vitest';
import { FileResolver } from '../../src/context/fileResolver';
import { SymbolResolver } from '../../src/context/symbolResolver';
import { ContextEngine } from '../../src/context/contextEngine';

describe('Context Engine & Security Filters', () => {
  it('extracts explicit @file: and implicit @path references', () => {
    const text = 'Check @file:src/index.ts and compare with @src/utils.ts for errors.';
    const refs = FileResolver.extractFileReferences(text);
    expect(refs).toContain('src/index.ts');
    expect(refs).toContain('src/utils.ts');
  });

  it('extracts @file with space and quoted file paths', () => {
    const text = 'Inspect @file src/extension.ts and also @file "src/components/My Component.tsx" please.';
    const refs = FileResolver.extractFileReferences(text);
    expect(refs).toContain('src/extension.ts');
    expect(refs).toContain('src/components/My Component.tsx');
  });

  it('identifies and blocks sensitive configuration and key files', () => {
    expect(FileResolver.isSensitiveFile('.env')).toBe(true);
    expect(FileResolver.isSensitiveFile('.env.production')).toBe(true);
    expect(FileResolver.isSensitiveFile('id_rsa')).toBe(true);
    expect(FileResolver.isSensitiveFile('server.key')).toBe(true);
    expect(FileResolver.isSensitiveFile('credentials.json')).toBe(true);
    expect(FileResolver.isSensitiveFile('main.ts')).toBe(false);
  });

  it('returns a security exclusion notice when a sensitive file is requested', async () => {
    const mockFolder = {
      uri: { fsPath: 'C:/fake/workspace' },
      name: 'workspace',
      index: 0,
    };

    const res = await FileResolver.resolveFileReference('.env', [mockFolder as any]);
    expect(res).not.toBeNull();
    expect(res?.content).toContain('[SECURITY: File ".env" is excluded');
  });

  it('extracts @symbol references accurately', () => {
    const text = 'What does @symbol:calculateMetrics and @symbol:executeTurn do?';
    const syms = SymbolResolver.extractSymbolReferences(text);
    expect(syms).toContain('calculateMetrics');
    expect(syms).toContain('executeTurn');
  });

  it('assembles enriched prompt and calculates estimated tokens', async () => {
    const prompt = 'Please refactor this method.';
    const result = await ContextEngine.assembleContext(prompt);
    expect(result.userPrompt).toBe(prompt);
    expect(result.estimatedContextTokens).toBeGreaterThanOrEqual(0);
    expect(result.fullPrompt).toContain(prompt);
  });
});

