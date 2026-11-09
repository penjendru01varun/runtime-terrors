import * as vscode from 'vscode';
import { logger } from '../../utils/logger';

export interface GetSymbolsInput {
  query: string;
  maxResults?: number;
}

export interface WorkspaceSymbolInfo {
  name: string;
  kind: string;
  containerName?: string;
  filePath: string;
  line: number;
}

export class SymbolTools {
  private static readonly SYMBOL_KIND_MAP: Record<number, string> = {
    [vscode.SymbolKind.File]: 'File',
    [vscode.SymbolKind.Module]: 'Module',
    [vscode.SymbolKind.Namespace]: 'Namespace',
    [vscode.SymbolKind.Package]: 'Package',
    [vscode.SymbolKind.Class]: 'Class',
    [vscode.SymbolKind.Method]: 'Method',
    [vscode.SymbolKind.Property]: 'Property',
    [vscode.SymbolKind.Field]: 'Field',
    [vscode.SymbolKind.Constructor]: 'Constructor',
    [vscode.SymbolKind.Enum]: 'Enum',
    [vscode.SymbolKind.Interface]: 'Interface',
    [vscode.SymbolKind.Function]: 'Function',
    [vscode.SymbolKind.Variable]: 'Variable',
    [vscode.SymbolKind.Constant]: 'Constant',
    [vscode.SymbolKind.String]: 'String',
    [vscode.SymbolKind.Number]: 'Number',
    [vscode.SymbolKind.Boolean]: 'Boolean',
    [vscode.SymbolKind.Array]: 'Array',
    [vscode.SymbolKind.Object]: 'Object',
    [vscode.SymbolKind.Key]: 'Key',
    [vscode.SymbolKind.Null]: 'Null',
    [vscode.SymbolKind.EnumMember]: 'EnumMember',
    [vscode.SymbolKind.Struct]: 'Struct',
    [vscode.SymbolKind.Event]: 'Event',
    [vscode.SymbolKind.Operator]: 'Operator',
    [vscode.SymbolKind.TypeParameter]: 'TypeParameter',
  };

  /**
   * Retrieves workspace symbols using VS Code's language symbol providers.
   */
  public static async getSymbols(input: GetSymbolsInput): Promise<{
    query: string;
    totalSymbols: number;
    symbols: WorkspaceSymbolInfo[];
  }> {
    const { query, maxResults = 30 } = input;

    try {
      const rawSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        query
      );

      if (!rawSymbols || !Array.isArray(rawSymbols)) {
        return { query, totalSymbols: 0, symbols: [] };
      }

      const symbols: WorkspaceSymbolInfo[] = rawSymbols
        .slice(0, maxResults)
        .map(sym => {
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(sym.location.uri);
          const relPath = workspaceFolder
            ? vscode.workspace.asRelativePath(sym.location.uri, false)
            : sym.location.uri.fsPath;

          const kindName = SymbolTools.SYMBOL_KIND_MAP[sym.kind] || 'Symbol';

          return {
            name: sym.name,
            kind: kindName,
            containerName: sym.containerName || undefined,
            filePath: relPath,
            line: sym.location.range.start.line + 1,
          };
        });

      logger.log(`Workspace symbol lookup for "${query}" returned ${symbols.length} symbols`);

      return {
        query,
        totalSymbols: symbols.length,
        symbols,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Error during symbol query:', msg);
      return { query, totalSymbols: 0, symbols: [] };
    }
  }
}

