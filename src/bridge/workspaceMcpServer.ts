import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TrueForge } from '@truefoundry/trueforge-sdk';
import { logger } from '../utils/logger';
import { FileTools } from './tools/fileTools';
import { SearchTools } from './tools/searchTools';
import { SymbolTools } from './tools/symbolTools';

export class WorkspaceMcpServer {
  private server: Server;
  private httpServer?: http.Server;
  private httpPort?: number;
  private httpUrl?: string;
  private isRegistered = false;
  private activeTransports = new Map<string, SSEServerTransport>();

  constructor() {
    this.server = new Server(
      {
        name: 'runtime-terrors-workspace',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerHandlers();
  }

  public getServer(): Server {
    return this.server;
  }

  public getHttpUrl(): string | undefined {
    return this.httpUrl;
  }

  public getHttpPort(): number | undefined {
    return this.httpPort;
  }

  public isRegisteredWithTrueForge(): boolean {
    return this.isRegistered;
  }

  public setRegisteredWithTrueForge(registered: boolean): void {
    this.isRegistered = registered;
  }

  private registerHandlers(): void {
    // 1. List Available Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.log('MCP Server: Listing available workspace tools');
      return {
        tools: [
          {
            name: 'read_file',
            description:
              'Read contents of a file within the workspace boundary with optional startLine and endLine.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Relative path to the workspace file to read.',
                },
                startLine: {
                  type: 'number',
                  description: 'Optional 1-based start line number.',
                },
                endLine: {
                  type: 'number',
                  description: 'Optional 1-based end line number.',
                },
              },
              required: ['filePath'],
            },
          },
          {
            name: 'list_directory',
            description:
              'List files and subdirectories in a workspace directory, ignoring node_modules and .git.',
            inputSchema: {
              type: 'object',
              properties: {
                directoryPath: {
                  type: 'string',
                  description: 'Relative directory path to list (defaults to root ".").',
                },
                recursive: {
                  type: 'boolean',
                  description: 'Whether to recursively traverse subdirectories.',
                },
                maxDepth: {
                  type: 'number',
                  description: 'Maximum depth when traversing recursively (default 3).',
                },
              },
            },
          },
          {
            name: 'propose_file_change',
            description:
              'Propose an atomic code change to a file. Generates a hunk-by-hunk diff in the Runtime Terrors Diff Review system. Does not overwrite disk without developer approval.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Relative path of the file to modify.',
                },
                proposedContent: {
                  type: 'string',
                  description: 'The complete proposed replacement text for the file.',
                },
                description: {
                  type: 'string',
                  description: 'Summary of what this modification accomplishes.',
                },
              },
              required: ['filePath', 'proposedContent'],
            },
          },
          {
            name: 'search_workspace',
            description: 'Search for text matches across workspace files.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The text or pattern to search for.',
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of matches to return (default 50).',
                },
                filePattern: {
                  type: 'string',
                  description: 'Glob filter pattern for files (e.g. "**/*.ts").',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_symbols',
            description:
              'Look up functions, classes, interfaces, or variables across the workspace.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The symbol name or prefix to search for.',
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of symbols to return (default 30).',
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });

    // 2. Call Tool Execution
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args = {} } = request.params;
      logger.log(`MCP Server: Invoking tool "${name}"`);

      try {
        let result: unknown;

        switch (name) {
          case 'read_file': {
            result = await FileTools.readFile({
              filePath: String(args.filePath || ''),
              startLine: typeof args.startLine === 'number' ? args.startLine : undefined,
              endLine: typeof args.endLine === 'number' ? args.endLine : undefined,
            });
            break;
          }

          case 'list_directory': {
            result = await FileTools.listDirectory({
              directoryPath: args.directoryPath ? String(args.directoryPath) : undefined,
              recursive: Boolean(args.recursive),
              maxDepth: typeof args.maxDepth === 'number' ? args.maxDepth : undefined,
            });
            break;
          }

          case 'propose_file_change': {
            result = await FileTools.proposeFileChange({
              filePath: String(args.filePath || ''),
              proposedContent: String(args.proposedContent || ''),
              description: args.description ? String(args.description) : undefined,
            });
            break;
          }

          case 'search_workspace': {
            result = await SearchTools.searchWorkspace({
              query: String(args.query || ''),
              maxResults: typeof args.maxResults === 'number' ? args.maxResults : undefined,
              filePattern: args.filePattern ? String(args.filePattern) : undefined,
            });
            break;
          }

          case 'get_symbols': {
            result = await SymbolTools.getSymbols({
              query: String(args.query || ''),
              maxResults: typeof args.maxResults === 'number' ? args.maxResults : undefined,
            });
            break;
          }

          default:
            throw new Error(`Unknown MCP tool: "${name}"`);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`MCP Server Tool "${name}" failed:`, errorMsg);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Tool Execution Error: ${errorMsg}`,
            },
          ],
        };
      }
    });
  }

  /**
   * Starts a local HTTP server with SSE support for the Model Context Protocol.
   */
  public async startHttpServer(preferredPort = 3182): Promise<{ port: number; url: string }> {
    if (this.httpServer && this.httpUrl && this.httpPort) {
      return { port: this.httpPort, url: this.httpUrl };
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname;

        if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'ok',
              name: 'runtime-terrors-workspace',
              activeSessions: this.activeTransports.size,
            })
          );
          return;
        }

        if (req.method === 'GET' && pathname === '/sse') {
          try {
            const transport = new SSEServerTransport('/messages', res);
            const sessionId = transport.sessionId;
            this.activeTransports.set(sessionId, transport);
            logger.log(`Workspace MCP: Client connected to SSE (sessionId: ${sessionId})`);

            transport.onclose = () => {
              logger.log(`Workspace MCP: Client closed SSE (sessionId: ${sessionId})`);
              this.activeTransports.delete(sessionId);
            };

            await this.server.connect(transport);
            await transport.start();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error('Workspace MCP SSE connection error:', msg);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: msg }));
            }
          }
          return;
        }

        if (req.method === 'POST' && pathname === '/messages') {
          try {
            const sessionId = parsedUrl.searchParams.get('sessionId');
            const transport = sessionId
              ? this.activeTransports.get(sessionId)
              : Array.from(this.activeTransports.values())[0];

            if (!transport) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: 'No active MCP session found. Connect to /sse first.',
                })
              );
              return;
            }

            await transport.handlePostMessage(req, res);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error('Workspace MCP POST /messages error:', msg);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: msg }));
            }
          }
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      const onListening = () => {
        const addr = server.address() as AddressInfo;
        const port = addr.port;
        const url = `http://127.0.0.1:${port}/sse`;
        this.httpServer = server;
        this.httpPort = port;
        this.httpUrl = url;
        logger.log(`Workspace MCP HTTP/SSE server listening at ${url}`);
        resolve({ port, url });
      };

      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && preferredPort !== 0) {
          logger.warn(`Port ${preferredPort} in use, retrying with ephemeral port...`);
          server.listen(0, '127.0.0.1', onListening);
        } else {
          logger.error('Failed to start Workspace MCP HTTP server:', err.message);
          reject(err);
        }
      });

      server.listen(preferredPort, '127.0.0.1', onListening);
    });
  }

  public async stopHttpServer(): Promise<void> {
    if (this.httpServer) {
      return new Promise<void>((resolve, reject) => {
        this.httpServer?.close(err => {
          this.httpServer = undefined;
          this.httpPort = undefined;
          this.httpUrl = undefined;
          this.activeTransports.clear();
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  /**
   * Registers the local workspace MCP server with the TrueForge runtime via SDK.
   */
  public async registerWithTrueForge(
    client: TrueForge,
    customUrl?: string
  ): Promise<boolean> {
    const serverUrl = customUrl || this.httpUrl;
    if (!serverUrl) {
      logger.warn('Cannot register MCP server: HTTP/SSE server is not running');
      return false;
    }

    try {
      logger.log(`Registering workspace MCP server with TrueForge at ${serverUrl}`);
      await client.settings.mcpServers.createOrUpdate({
        manifest: {
          name: 'runtime-terrors-workspace',
          description:
            'Runtime Terrors local workspace tools (read_file, list_directory, propose_file_change, search_workspace, get_symbols)',
          type: 'remote',
          url: serverUrl,
        },
      });
      this.isRegistered = true;
      logger.log('Successfully registered workspace MCP server with TrueForge.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `Notice: Could not register MCP server with TrueForge (standalone mode fallback active): ${msg}`
      );
      this.isRegistered = false;
      return false;
    }
  }

  /**
   * Direct dispatcher for client-side tool loops when TrueForge requests workspace actions.
   */
  public async executeToolDirectly(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const res = await (this.server as any)._requestHandlers.get('tools/call')({
      params: { name: toolName, arguments: args },
    });
    return res?.content?.[0]?.text || '';
  }
}

export const workspaceMcpServer = new WorkspaceMcpServer();

