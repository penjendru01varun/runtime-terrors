import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { diffManager } from '../../src/diff/diffManager';
import { FileTools } from '../../src/bridge/tools/fileTools';
import { SearchTools } from '../../src/bridge/tools/searchTools';
import { SymbolTools } from '../../src/bridge/tools/symbolTools';
import { workspaceMcpServer } from '../../src/bridge/workspaceMcpServer';

describe('Workspace MCP Tools', () => {
  describe('FileTools', () => {
    it('reads file contents and reports total lines and byte count', async () => {
      const res = await FileTools.readFile({
        filePath: 'src/extension.ts',
      });

      expect(res.filePath).toBe('src/extension.ts');
      expect(res.content).toContain('function hello()');
      expect(res.totalLines).toBeGreaterThan(0);
      expect(res.byteLength).toBeGreaterThan(0);
    });

    it('reads slice of file when startLine and endLine are specified', async () => {
      const res = await FileTools.readFile({
        filePath: 'src/extension.ts',
        startLine: 1,
        endLine: 2,
      });

      const lines = res.content.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
    });

    it('lists directory entries excluding build artifacts and hidden folders', async () => {
      const res = await FileTools.listDirectory({
        directoryPath: '.',
        recursive: false,
      });

      expect(res.entries).toBeDefined();
      expect(Array.isArray(res.entries)).toBe(true);
      // Ensure node_modules or .git are never listed
      expect(res.entries.some(e => e.name === 'node_modules')).toBe(false);
      expect(res.entries.some(e => e.name === '.git')).toBe(false);
    });

    it('proposes file changes and registers them in DiffManager without modifying disk', async () => {
      diffManager.clearPendingDiffs();

      const proposed = '// modified file\nfunction hello() {\n  return "universe";\n}\n';
      const result = await FileTools.proposeFileChange({
        filePath: 'src/extension.ts',
        proposedContent: proposed,
        description: 'Update greeting to universe',
      });

      expect(result.status).toBe('pending_review');
      expect(result.additions).toBeGreaterThan(0);
      expect(result.hunkCount).toBeGreaterThan(0);

      // Verify diff was registered in DiffManager
      const pendingDiffs = diffManager.getAllPendingDiffs();
      expect(pendingDiffs).toHaveLength(1);
      expect(pendingDiffs[0].relativePath).toContain('extension.ts');
    });
  });

  describe('SearchTools', () => {
    it('executes workspace text search and returns matching items', async () => {
      const res = await SearchTools.searchWorkspace({
        query: 'hello',
        maxResults: 10,
      });

      expect(res.query).toBe('hello');
      expect(res.matches).toBeDefined();
      expect(Array.isArray(res.matches)).toBe(true);
    });
  });

  describe('SymbolTools', () => {
    it('queries workspace symbol provider and formats results', async () => {
      const res = await SymbolTools.getSymbols({
        query: 'hello',
      });

      expect(res.query).toBe('hello');
      expect(res.symbols).toBeDefined();
      expect(Array.isArray(res.symbols)).toBe(true);
    });
  });

  describe('WorkspaceMcpServer HTTP Transport', () => {
    it('starts HTTP/SSE server and stops cleanly', async () => {
      const serverInfo = await workspaceMcpServer.startHttpServer(0);
      expect(serverInfo.port).toBeGreaterThan(0);
      expect(serverInfo.url).toBe(`http://127.0.0.1:${serverInfo.port}/sse`);
      expect(workspaceMcpServer.getHttpPort()).toBe(serverInfo.port);
      expect(workspaceMcpServer.getHttpUrl()).toBe(serverInfo.url);

      await workspaceMcpServer.stopHttpServer();
      expect(workspaceMcpServer.getHttpUrl()).toBeUndefined();
      expect(workspaceMcpServer.getHttpPort()).toBeUndefined();
    });

    it('handles registration attempt with client mock gracefully', async () => {
      const mockClient = {
        settings: {
          mcpServers: {
            createOrUpdate: async (_req: any) => ({
              data: { name: 'runtime-terrors-workspace' },
            }),
          },
        },
      };

      const success = await workspaceMcpServer.registerWithTrueForge(
        mockClient as any,
        'http://127.0.0.1:3182/sse'
      );
      expect(success).toBe(true);
      expect(workspaceMcpServer.isRegisteredWithTrueForge()).toBe(true);
    });
  });
});

