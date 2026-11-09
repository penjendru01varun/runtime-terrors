import { EditorContextResolver, type EditorContextData } from './editorContext';
import { FileResolver, type ResolvedFileContext } from './fileResolver';
import { SymbolResolver, type ResolvedSymbolContext } from './symbolResolver';

export interface EnrichedPromptResult {
  fullPrompt: string;
  userPrompt: string;
  hasContext: boolean;
  activeEditor?: EditorContextData;
  files: ResolvedFileContext[];
  symbols: ResolvedSymbolContext[];
  estimatedContextTokens: number;
}

export class ContextEngine {
  private static readonly MAX_CONTEXT_CHARS = 16000; // ~4000 tokens

  /**
   * Builds an enriched prompt incorporating editor selection, active file,
   * `@file`, and `@symbol` references.
   */
  public static async assembleContext(userPrompt: string): Promise<EnrichedPromptResult> {
    const activeEditor = EditorContextResolver.getActiveEditorContext();
    const fileRefs = FileResolver.extractFileReferences(userPrompt);
    const symbolRefs = SymbolResolver.extractSymbolReferences(userPrompt);

    const resolvedFiles: ResolvedFileContext[] = [];
    for (const ref of fileRefs) {
      const resolved = await FileResolver.resolveFileReference(ref);
      if (resolved) {
        resolvedFiles.push(resolved);
      }
    }

    const resolvedSymbols: ResolvedSymbolContext[] = [];
    for (const sym of symbolRefs) {
      const results = await SymbolResolver.resolveSymbol(sym);
      resolvedSymbols.push(...results);
    }

    const contextBlocks: string[] = [];
    let currentChars = 0;

    // 1. Active selection or editor excerpt
    if (activeEditor.hasActiveEditor && activeEditor.relativePath) {
      if (activeEditor.selectedText) {
        const block =
          `### Active Selection in \`${activeEditor.relativePath}\` (Around Line ${activeEditor.cursorLine}):\n` +
          '```' + (activeEditor.languageId || '') + '\n' +
          activeEditor.selectedText + '\n' +
          '```';
        contextBlocks.push(block);
        currentChars += block.length;
      } else if (activeEditor.visibleText) {
        const block =
          `### Current Visible File \`${activeEditor.relativePath}\` (Total Lines: ${activeEditor.totalLines}):\n` +
          '```' + (activeEditor.languageId || '') + '\n' +
          activeEditor.visibleText + '\n' +
          '```';
        contextBlocks.push(block);
        currentChars += block.length;
      }
    }

    // 2. Resolved Files
    for (const f of resolvedFiles) {
      if (currentChars >= this.MAX_CONTEXT_CHARS) break;
      const block =
        `### Referenced File \`${f.relativePath}\` (${f.totalLines} lines):\n` +
        '```\n' +
        f.content + '\n' +
        '```';
      contextBlocks.push(block);
      currentChars += block.length;
    }

    // 3. Resolved Symbols
    for (const s of resolvedSymbols) {
      if (currentChars >= this.MAX_CONTEXT_CHARS) break;
      const block =
        `### Symbol Definition \`${s.symbolName}\` in \`${s.filePath || 'workspace'}\` (Line ${s.line || '?'})\n` +
        (s.snippet ? '```\n' + s.snippet + '\n```' : '');
      contextBlocks.push(block);
      currentChars += block.length;
    }

    const hasContext = contextBlocks.length > 0;
    let fullPrompt = userPrompt;

    if (hasContext) {
      fullPrompt =
        '<workspace_context>\n' +
        contextBlocks.join('\n\n') + '\n' +
        '</workspace_context>\n\n' +
        'User Query / Task:\n' +
        userPrompt;
    }

    const estimatedTokens = Math.ceil(currentChars / 4);

    return {
      fullPrompt,
      userPrompt,
      hasContext,
      activeEditor,
      files: resolvedFiles,
      symbols: resolvedSymbols,
      estimatedContextTokens: estimatedTokens,
    };
  }
}

