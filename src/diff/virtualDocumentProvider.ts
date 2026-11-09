import * as vscode from 'vscode';

export class VirtualDocumentProvider implements vscode.TextDocumentContentProvider {
  public static readonly SCHEME = 'runtime-terrors-diff';
  private static instance: VirtualDocumentProvider;

  private documents = new Map<string, string>();
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  public static getInstance(): VirtualDocumentProvider {
    if (!VirtualDocumentProvider.instance) {
      VirtualDocumentProvider.instance = new VirtualDocumentProvider();
    }
    return VirtualDocumentProvider.instance;
  }

  public setDocumentContent(uri: vscode.Uri, content: string): void {
    this.documents.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  public deleteDocument(uri: vscode.Uri): void {
    this.documents.delete(uri.toString());
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.documents.get(uri.toString()) || '';
  }
}

export const virtualDocumentProvider = VirtualDocumentProvider.getInstance();

