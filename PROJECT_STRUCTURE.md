# Runtime Terrors — Project Structure

This document details the file and folder layout of the **Runtime Terrors** VS Code Extension and React Webview.

```
runtime-terrors/
├── .vscode/
│   ├── launch.json                   # VS Code debugging configurations (Launch Extension, Tests)
│   └── tasks.json                    # VS Code build and watch tasks
├── src/
│   ├── extension.ts                  # Extension entry point (activate/deactivate, command hooks)
│   ├── config/
│   │   └── settings.ts               # Extension settings accessor & VS Code SecretStorage bridge
│   ├── trueforge/
│   │   ├── client.ts                 # TrueForge REST & SSE client (health, sessions, turns, models)
│   │   ├── sessionManager.ts         # Session persistence, thread history, active session tracking
│   │   ├── turnStreamer.ts           # Resilient SSE reader, delta accumulator, cancellation handler
│   │   └── types.ts                  # TypeScript types for TrueForge events, specs, and responses
│   ├── bridge/
│   │   ├── workspaceMcpServer.ts     # Embedded HTTP/SSE MCP server for TrueForge tool integration
│   │   ├── tools/
│   │   │   ├── fileTools.ts          # read_file, list_directory implementation
│   │   │   ├── searchTools.ts        # search_workspace (ripgrep/search API)
│   │   │   └── symbolTools.ts        # get_symbols, find_definition
│   │   └── fileSyncGuard.ts          # Security: path traversal guard & workspace boundary validation
│   ├── context/
│   │   ├── contextEngine.ts          # Orchestrator for token-budgeted prompt context assembly
│   │   ├── symbolResolver.ts         # @symbol reference extraction and resolution via VS Code APIs
│   │   ├── fileResolver.ts           # @file reference extraction and workspace file resolution
│   │   └── editorContext.ts          # Active text editor context, cursor position, selection range
│   ├── diff/
│   │   ├── diffEngine.ts             # Myers diff calculation, hunk splitting, patch generation
│   │   ├── diffViewer.ts             # VS Code native diff integration (vscode.diff & virtual documents)
│   │   ├── virtualDocumentProvider.ts# 'runtime-terrors-diff://' TextDocumentContentProvider
│   │   └── changeApplier.ts          # Hunk-by-hunk acceptance, rejection, and undo/rollback stack
│   ├── inlineEdit/
│   │   ├── inlineEditController.ts   # Inline edit action, input UI, streaming preview, diff review
│   │   └── promptTemplate.ts         # System prompts and templates tailored for surgical code editing
│   ├── agent/
│   │   ├── autonomousAgent.ts        # Multi-file autonomous planning and execution coordinator
│   │   └── taskPlanner.ts            # Step-by-step task breakdown and status reporting
│   ├── webview/
│   │   ├── WebviewProvider.ts        # WebviewViewProvider for the primary sidebar chat & tools
│   │   └── messageProtocol.ts        # Strongly-typed bidirectional RPC message protocol
│   └── utils/
│       ├── logger.ts                 # Sanitized logging to VS Code OutputChannel (no leaked keys)
│       └── errorHandler.ts           # Human-readable error translation for network/model/sandbox errors
├── webview-ui/                       # React Webview Application
│   ├── src/
│   │   ├── index.tsx                 # Webview mounting and root render
│   │   ├── App.tsx                   # Main container with tab navigation and state management
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx         # Chat interface: streaming bubbles, reasoning accordion, token counts
│   │   │   ├── AgentActivity.tsx     # Autonomous agent execution timeline, subagent threads, tool logs
│   │   │   ├── ContextPanel.tsx      # Active context inspector with @file/@symbol chips
│   │   │   ├── DiffReviewPanel.tsx   # Multi-file diff viewer with hunk-by-hunk Accept/Reject buttons
│   │   │   ├── SettingsPanel.tsx     # Configuration UI: TrueForge endpoint, API token, Model selector
│   │   │   ├── CodeBlock.tsx         # Syntax highlighted code block with Copy and Insert at Cursor
│   │   │   └── StatusBar.tsx         # Live TrueForge server connection and latency status badge
│   │   ├── hooks/
│   │   │   └── useVscodeBridge.ts    # React hook for message exchange with the Extension Host
│   │   └── styles/
│   │       └── index.css             # Tailwind CSS with Dark theme tokens (slate-950, violet accents)
│   ├── index.html                    # HTML shell for the webview
│   ├── vite.config.ts                # Vite bundler for the React webview (compiles to dist/webview)
│   ├── tailwind.config.js            # Tailwind color schemes and dark developer utilities
│   └── postcss.config.js             # PostCSS plugins
├── tests/
│   ├── unit/
│   │   ├── contextEngine.test.ts     # Tests for @file, @symbol, and token budgeting
│   │   ├── diffEngine.test.ts        # Tests for hunk splitting, hunk acceptance/rejection, and undo
│   │   ├── turnStreamer.test.ts      # Tests for SSE parsing, token streaming, and cancellation
│   │   └── workspaceMcpServer.test.ts# Tests for workspace tools and path security fences
│   ├── integration/
│   │   └── trueforgeClient.test.ts   # Integration tests against TrueForge endpoints
│   └── mocks/
│       ├── mockTrueForgeServer.ts    # Mock HTTP/SSE server for reliable offline testing
│       └── mockVscode.ts             # In-memory mock of the VS Code Extension API
├── esbuild.js                        # Bundler configuration for the extension host (compiles to dist/extension.js)
├── package.json                      # Extension manifest (commands, views, configuration, dependencies)
├── tsconfig.json                     # TypeScript compiler configuration for Extension Host
├── vitest.config.ts                  # Vitest runner configuration
├── ARCHITECTURE.md                   # Full system architecture documentation
├── IMPLEMENTATION_PLAN.md            # Phased implementation plan
├── PROJECT_STRUCTURE.md              # This document
└── README.md                         # Project documentation, setup guide, and user manual
```

