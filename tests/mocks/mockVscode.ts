export class MockSecretStorage {
  private secrets = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.secrets.delete(key);
  }
}

export class MockConfiguration {
  public values = new Map<string, unknown>();

  constructor(defaults: Record<string, unknown> = {}) {
    for (const [k, v] of Object.entries(defaults)) {
      this.values.set(k, v);
    }
  }

  get<T>(section: string): T | undefined {
    return this.values.get(section) as T;
  }

  async update(section: string, value: unknown): Promise<void> {
    this.values.set(section, value);
  }
}

export const activeMockConfiguration = new MockConfiguration({
  trueforgeUrl: 'http://127.0.0.1:8790',
  defaultModel: 'openai/gpt-4o',
});

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

export const SymbolKind = {
  File: 0,
  Module: 1,
  Namespace: 2,
  Package: 3,
  Class: 4,
  Method: 5,
  Property: 6,
  Field: 7,
  Constructor: 8,
  Enum: 9,
  Interface: 10,
  Function: 11,
  Variable: 12,
  Constant: 13,
  String: 14,
  Number: 15,
  Boolean: 16,
  Array: 17,
  Object: 18,
  Key: 19,
  Null: 20,
  EnumMember: 21,
  Struct: 22,
  Event: 23,
  Operator: 24,
  TypeParameter: 25,
};

export class MockPosition {
  constructor(public line: number, public character: number) {}
}

export class MockRange {
  public start: MockPosition;
  public end: MockPosition;
  constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
    this.start = new MockPosition(startLine, startChar);
    this.end = new MockPosition(endLine, endChar);
  }
}

export class MockEventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];
  public event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  public fire(data: T) {
    for (const l of this.listeners) {
      l(data);
    }
  }
}

export class MockWorkspaceEdit {
  public entries: Array<{ uri: any; range?: any; newText: string; type?: string }> = [];
  replace(uri: any, range: any, newText: string) {
    this.entries.push({ uri, range, newText, type: 'replace' });
  }
  createFile(uri: any, _options?: any) {
    this.entries.push({ uri, newText: '', type: 'createFile' });
  }
  insert(uri: any, _pos: any, newText: string) {
    this.entries.push({ uri, newText, type: 'insert' });
  }
}

export const EventEmitter = MockEventEmitter;
export const Position = MockPosition;
export const Range = MockRange;
export const WorkspaceEdit = MockWorkspaceEdit;

export const ViewColumn = {
  Active: -1,
  Beside: -2,
  One: 1,
  Two: 2,
  Three: 3,
};

export const Uri = {
  file: (f: string) => ({
    fsPath: f,
    path: f,
    scheme: 'file',
    toString: () => `file://${f}`,
    with: (change: any) => ({
      fsPath: f,
      path: f,
      scheme: change.scheme || 'file',
      query: change.query || '',
      toString: () => `${change.scheme || 'file'}://${f}?${change.query || ''}`,
    }),
  }),
  parse: (s: string) => {
    const clean = s.replace(/^[a-zA-Z0-9_-]+:\/\//, '').split('?')[0];
    return {
      fsPath: clean,
      path: clean,
      scheme: s.split('://')[0] || 'file',
      toString: () => s,
      with: (change: any) => ({
        fsPath: clean,
        path: clean,
        scheme: change.scheme || 'file',
        query: change.query || '',
        toString: () => `${change.scheme || 'file'}://${clean}?${change.query || ''}`,
      }),
    };
  },
  joinPath: (base: { fsPath: string }, ...parts: string[]) => ({
    fsPath: [base.fsPath, ...parts].join('/'),
    path: [base.fsPath, ...parts].join('/'),
    scheme: 'file',
    toString: () => `file://${[base.fsPath, ...parts].join('/')}`,
  }),
};

export const window = {
  createOutputChannel: (_name: string) => ({
    appendLine: (_msg: string) => {},
    show: () => {},
  }),
  createStatusBarItem: (_alignment?: number, _priority?: number) => ({
    text: '',
    tooltip: '',
    command: '',
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  showInformationMessage: async (_msg: string) => undefined,
  showWarningMessage: async (_msg: string) => undefined,
  showErrorMessage: async (_msg: string) => undefined,
  registerWebviewViewProvider: (_viewType: string, _provider: unknown) => ({
    dispose: () => {},
  }),
};

export const workspace = {
  getConfiguration: (_section?: string) => activeMockConfiguration,
  workspaceFolders: [
    {
      uri: Uri.file('C:/Users/hp/Downloads/RuntimeTerrors/runtime-terrors'),
      name: 'runtime-terrors',
      index: 0,
    },
  ],
  getWorkspaceFolder: (uri: any) => ({
    uri: Uri.file('C:/Users/hp/Downloads/RuntimeTerrors/runtime-terrors'),
    name: 'runtime-terrors',
    index: 0,
  }),
  asRelativePath: (uriOrPath: any) => {
    const p = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath.fsPath || '';
    return p.replace(/^[C|c]:[/\\]Users[/\\]hp[/\\]Downloads[/\\]RuntimeTerrors[/\\]runtime-terrors[/\\]?/, '');
  },
  openTextDocument: async (uriOrPath: any) => {
    const text = '// existing file content\nfunction hello() {\n  return "world";\n}\n';
    return {
      getText: (range?: any) => text,
      lineCount: 4,
      lineAt: (line: number) => ({
        text: text.split('\n')[line] || '',
        range: new MockRange(line, 0, line, (text.split('\n')[line] || '').length),
      }),
      uri: typeof uriOrPath === 'string' ? Uri.file(uriOrPath) : uriOrPath,
      save: async () => true,
    };
  },
  applyEdit: async (_edit: any) => true,
  registerTextDocumentContentProvider: (_scheme: string, _provider: any) => ({
    dispose: () => {},
  }),
  findFiles: async () => [],
};

export const commands = {
  registerCommand: (_command: string, _callback: (...args: unknown[]) => unknown) => ({
    dispose: () => {},
  }),
  executeCommand: async (_command: string, ..._args: unknown[]) => undefined,
};

export default {
  StatusBarAlignment,
  ConfigurationTarget,
  SymbolKind,
  ViewColumn,
  Position,
  Range,
  EventEmitter,
  WorkspaceEdit,
  Uri,
  window,
  workspace,
  commands,
};
