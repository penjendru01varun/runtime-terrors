import * as vscode from 'vscode';

export interface ResolvedSymbolContext {
  symbolName: string;
  kind?: string;
  containerName?: string;
  filePath?: string;
  line?: number;
  snippet?: string;
}

export class SymbolResolver {
  /**
   * Extracts `@symbol:name` from user prompt.
   */
  public static extractSymbolReferences(text: string): string[] {
    const refs = new Set<string>();
    const explicitRegex = /@symbol:([a-zA-Z0-9_$]+)/g;
    let match: RegExpExecArray | null;

    while ((match = explicitRegex.exec(text)) !== null) {
      if (match[1]) refs.add(match[1]);
    }

    return Array.from(refs);
  }

  public static async resolveSymbol(symbolName: string): Promise<ResolvedSymbolContext[]> {
    try {
      const symbols = (await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        symbolName
      )) || [];

      const results: ResolvedSymbolContext[] = [];

      for (const sym of symbols.slice(0, 5)) {
        let snippet: string | undefined;

        if (sym.location && sym.location.uri) {
          try {
            const doc = await vscode.workspace.openTextDocument(sym.location.uri);
            const range = sym.location.range;
            // Get a few lines around the symbol definition
            const startLine = Math.max(0, range.start.line - 1);
            const endLine = Math.min(doc.lineCount - 1, range.end.line + 8);
            snippet = doc.getText(
              new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length)
            );
          } catch {
            // Cannot open document, continue
          }
        }

        results.push({
          symbolName: sym.name,
          containerName: sym.containerName || undefined,
          filePath: sym.location?.uri?.fsPath,
          line: sym.location ? sym.location.range.start.line + 1 : undefined,
          snippet,
        });
      }

      return results;
    } catch {
      return [];
    }
  }
}

