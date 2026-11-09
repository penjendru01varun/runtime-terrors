import * as vscode from 'vscode';

export interface EditorContextData {
  hasActiveEditor: boolean;
  filePath?: string;
  relativePath?: string;
  languageId?: string;
  selectedText?: string;
  cursorLine?: number;
  totalLines?: number;
  visibleText?: string;
}

export class EditorContextResolver {
  public static getActiveEditorContext(): EditorContextData {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return { hasActiveEditor: false };
    }

    const doc = editor.document;
    const selection = editor.selection;
    const selectedText = doc.getText(selection);

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    const relativePath = workspaceFolder
      ? vscode.workspace.asRelativePath(doc.uri, false)
      : doc.fileName;

    const visibleRanges = editor.visibleRanges;
    let visibleText: string | undefined;
    if (visibleRanges.length > 0) {
      visibleText = visibleRanges
        .map(range => doc.getText(range))
        .join('\n...\n');
    }

    return {
      hasActiveEditor: true,
      filePath: doc.fileName,
      relativePath,
      languageId: doc.languageId,
      selectedText: selectedText || undefined,
      cursorLine: selection.active.line + 1,
      totalLines: doc.lineCount,
      visibleText,
    };
  }
}

