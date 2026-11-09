import { describe, it, expect } from 'vitest';
import { InlineEditPromptTemplate } from '../../src/inlineEdit/promptTemplate';

describe('InlineEditPromptTemplate', () => {
  it('builds structured prompt with file path, language, code, and instruction', () => {
    const prompt = InlineEditPromptTemplate.buildUserPrompt({
      instruction: 'Add error handling',
      selectedCode: 'const x = 1;',
      filePath: 'src/main.ts',
      languageId: 'typescript',
      surroundingContext: '// top of file\nconst x = 1;\n// bottom of file',
    });

    expect(prompt).toContain('File: src/main.ts (typescript)');
    expect(prompt).toContain('Add error handling');
    expect(prompt).toContain('const x = 1;');
    expect(prompt).toContain('Surrounding Context:');
  });

  it('extracts code cleanly from fenced markdown response', () => {
    const aiResponse = '```typescript\nfunction hello(): string {\n  return "world";\n}\n```';
    const extracted = InlineEditPromptTemplate.extractCodeFromResponse(aiResponse);
    expect(extracted).toBe('function hello(): string {\n  return "world";\n}\n');
  });

  it('falls back to raw trimmed string when no code fence is present', () => {
    const raw = 'const a = 10;';
    const extracted = InlineEditPromptTemplate.extractCodeFromResponse(raw);
    expect(extracted).toBe('const a = 10;');
  });
});

