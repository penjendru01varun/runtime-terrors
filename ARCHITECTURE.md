# Runtime Terrors — System Architecture

## 1. Overview & Vision

**Runtime Terrors** is a professional, VS Code-native AI coding assistant that uses **TrueForge** as its mandatory agent execution runtime.

Instead of constructing a redundant LLM orchestration loop or directly querying model APIs (OpenAI, Anthropic, Gemini, etc.) from the extension, Runtime Terrors delegates all agent execution, model reasoning, dynamic subagents, context compaction, and tool scheduling to the TrueForge harness.

Runtime Terrors focuses on providing:
1. **A First-Class VS Code Developer Experience**: Native diff editors, editor-anchored inline editing, symbol and file context resolvers, and a polished dark developer interface.
2. **Safe Workspace Synchronization**: A bidirectional bridge connecting TrueForge's execution loop to the developer's local workspace without ever overwriting code without explicit user consent.
3. **Autonomous Agent Capabilities**: TrueForge-driven multi-step planning, code search, dependency tracing, and multi-file change proposals.

---

## 2. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           VS Code Extension Host Environment                     │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                        React Webview Interface                           │   │
│   │  - AI Chat Stream & Message History                                      │   │
│   │  - Agent Execution Timeline & Tool Reasoning Logs                        │   │
│   │  - Context Tray (@file / @symbol chips & token meter)                    │   │
│   │  - Diff Review Center (Hunk-by-hunk acceptance, discard, undo)           │   │
│   │  - Connection & Model Selector (Live TrueForge status indicator)         │   │
│   └─────────────────────────────────────┬────────────────────────────────────┘   │
│                                         │ RPC Message Bus                        │
│                                         ▼                                        │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                     Runtime Terrors Extension Core                       │   │
│   │                                                                          │   │
│   │  ┌───────────────────────┐  ┌──────────────────────┐  ┌───────────────┐  │   │
│   │  │    Context Engine     │  │     Diff Engine      │  │  Inline Edit  │  │   │
│   │  │  - @file resolver     │  │  - Hunk parser       │  │  - Quick diff │  │   │
│   │  │  - @symbol resolver   │  │  - Patch applicator  │  │  - Selection  │  │   │
│   │  │  - Token budgeting    │  │  - Rollback manager  │  │  - Accept/deny │  │   │
│   │  └───────────┬───────────┘  └──────────┬───────────┘  └───────┬───────┘  │   │
│   │              │                         │                      │          │   │
│   │  ┌───────────▼─────────────────────────▼──────────────────────▼───────┐  │   │
│   │  │                  TrueForge Bridge Coordinator                      │  │   │
│   │  │  - Manages Sessions & Turns                                        │  │   │
│   │  │  - Dispatches Turn Input (User messages, approvals, tool responses)│  │   │
│   │  │  - Consumes Server-Sent Events (SSE) Stream                        │  │   │
│   │  └───────────────────────────────────┬────────────────────────────────┘  │   │
│   │                                      │                                   │   │
│   │  ┌───────────────────────────────────▼────────────────────────────────┐  │   │
│   │  │          Local Workspace Bridge (Dual-Mode MCP / Client Tool)      │  │   │
│   │  │  - Mode 1: HTTP/SSE MCP Endpoint (for Local / Colocated TrueForge) │  │   │
│   │  │  - Mode 2: Client-Side Tool Loop (for Remote / Hosted TrueForge)   │  │   │
│   │  │  - Tools: read_file, list_files, search_code, get_symbols, diff    │  │   │
│   │  │  - Enforces workspace boundary security and file guards            │  │   │
│   │  └───────────────────────────────────┬────────────────────────────────┘  │   │
│   └──────────────────────────────────────┼───────────────────────────────────┘   │
└──────────────────────────────────────────┼───────────────────────────────────────┘
                                           │
                         HTTP & SSE / REST │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   TrueForge Agent Harness Server (Local or Remote)               │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                        Hono REST & SSE API Layer                         │   │
│   │  - /api/v1/sessions: Session persistence & turn execution stream         │   │
│   │  - /api/v1/models: Model provider catalog                                │   │
│   │  - /api/v1/settings/mcp-servers: Remote MCP connector registration       │   │
│   └───────────────────────────────────┬──────────────────────────────────────┘   │
│                                       ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                      TrueForge Core Execution Loop                       │   │
│   │  - AgentThreadOrchestrator & TurnHandle                                  │   │
│   │  - Vercel AI SDK integration (OpenAI, Anthropic, Gemini, Ollama)         │   │
│   │  - Context Compaction & Large Tool Result Offloading                     │   │
│   │  - Remote MCP Tool Dispatch & Human-in-the-Loop Approvals                │   │
│   │  - Dynamic Subagents & Execution Threads                                 │   │
│   └──────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Extension-to-TrueForge Communication

Runtime Terrors interacts with TrueForge through its documented HTTP REST API and Server-Sent Events (SSE) stream:

### A. Client Configuration & Health Check
- Base URL configured in VS Code settings: `runtimeTerrors.trueforgeUrl` (default `http://127.0.0.1:8790`).
- Auth token stored securely in VS Code `SecretStorage`: `Authorization: Bearer <token>` (omitted in standalone mode).
- Extension periodically verifies server connectivity via `GET /api/v1/models` and reflects live latency and status in the status bar and sidebar.

### B. Session Management
- Sessions are created using `POST /api/v1/sessions` with an `AgentSpec` containing:
  - Selected model (e.g. `openai/gpt-4o`, `anthropic/claude-3-7-sonnet`).
  - System instructions defining the coding assistant role and guidelines.
  - Attached MCP connectors and runtime configuration (e.g., dynamic subagents enabled, context compaction enabled).
- Active conversation state survives extension reloads and network reconnects because session state is held durably in TrueForge.

### C. Turn Streaming Protocol
1. Turn execution starts via `POST /api/v1/sessions/:session_id/turns` with `stream: true`.
2. The response is parsed as a typed SSE event stream:
   - `model.message.delta`: Text chunks (`delta.content`) and chain-of-thought tokens (`delta.reasoningContent`) streamed live into the chat panel.
   - `model.message`: Final assistant message payload with token usage metrics.
   - `tool.call.started`: Displays real-time progress cards for tool executions.
   - `tool.approval_required`: Triggered for sensitive tools (e.g., proposing file changes). Pauses execution until the user responds.
   - `tool.response_required`: Triggered when TrueForge requests a client-side tool output.
   - `thread.created` / `thread.done`: Displays dynamic subagent progress trees.
   - `turn.done`: Concludes turn execution.
3. Mid-turn approvals and tool responses are sent via `POST /api/v1/sessions/:session_id/turns/:turn_id/events`:
   - `user.tool_approval`: `{ approval: { decision: "allow_once" | "allow_always" | "deny" } }`.
   - `user.tool_response`: `{ content: "<tool-result-json>" }`.
4. Turn cancellation is executed via `POST /api/v1/sessions/:session_id/cancel`.

---

## 4. MCP Workspace Integration & Network Reachability

### The Network Reachability Challenge
A key architectural consideration is: **How can TrueForge connect to workspace tools?**
- **Local / Standalone TrueForge**: TrueForge runs on the developer's machine (`localhost` or Docker on `host.docker.internal`). In this setup, TrueForge can connect directly to an HTTP/SSE MCP server hosted on loopback (`http://127.0.0.1:PORT/sse`).
- **Remote / Hosted TrueForge**: When TrueForge is deployed on a remote Kubernetes cluster or cloud environment, it **cannot** initiate outbound TCP connections into the developer's private `127.0.0.1` network without reverse tunnels.

### Dual-Mode Architecture Solution

Runtime Terrors implements a **Dual-Mode Workspace Bridge** to ensure seamless operation regardless of where TrueForge is hosted:

```
                  ┌────────────────────────────────────────┐
                  │ Runtime Terrors Deployment Strategy    │
                  └───────────────────┬────────────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
     [Local TrueForge Runtime]                     [Remote TrueForge Runtime]
  - Standalone SQLite / Local Docker            - Kubernetes / Cloud TrueForge
  - Embedded HTTP/SSE MCP Server on loopback   - Client-Side Tool Loop & Turn Events
  - Registered via settings.mcpServers          - Inbound tool.response_required & approval
  - Direct HTTP tool dispatch                   - Pre-injected Context Engine slices
```

1. **Mode 1: Embedded Loopback MCP Server (Local TrueForge)**:
   - For local development, Runtime Terrors spins up an in-process MCP server (`@modelcontextprotocol/sdk`) over HTTP/SSE on `127.0.0.1:<random-port>`.
   - It registers with TrueForge via `PUT /api/v1/settings/mcp-servers/runtime-terrors-workspace`.
   - TrueForge directly queries the local MCP server when calling tools.

2. **Mode 2: Client-Side Tool Loop & Context Pre-Injection (Remote TrueForge)**:
   - For remote TrueForge deployments where loopback is unreachable, the extension leverages:
     - **Context Engine Pre-injection**: Surgical file snippets and symbols are injected into `user.message` so the remote model has immediate access to relevant code without needing to call remote read tools.
     - **TrueForge Client-Side Tools (`tool.response_required`)**: TrueForge flags client-side tools and emits a `tool.response_required` event instead of attempting an unreachable server-side HTTP request.
     - **Turn Event Resume**: The extension executes the tool locally in VS Code and responds via `client.sessions.createTurnEvent(sessionId, turnId, { events: [{ type: "user.tool_response", content: result }] })`.

---

## 5. Diff Review & Safe Workspace Synchronization

A paramount principle of Runtime Terrors is: **Never overwrite source files without explicit developer consent.**

### A. The Change Proposal Pipeline
1. TrueForge generates a proposed file change (via `propose_file_change` tool or structured diff block).
2. The proposal is intercepted before touching the disk.
3. The Diff Engine runs Myers diff (`diff` library) to partition the changes into distinct **hunks** with line numbers, additions, and deletions.

### B. Hunk-by-Hunk Review
- Developers inspect proposed changes either in the Webview Diff Review Panel or in VS Code's native diff editor (`vscode.diff`) using a virtual document provider (`runtime-terrors-diff://`).
- Developers can:
  - **Accept Hunk**: Applies only that specific hunk; subsequent hunk line offsets are dynamically recalibrated.
  - **Reject Hunk**: Discards the hunk and preserves existing developer code.
  - **Accept All / Reject All**: Batch operations for rapid workflows.
  - **Undo**: Reverses previously applied hunks from an in-memory rollback stack.

### C. Workspace Boundary & Concurrency Protection
- **Path Traversal Guard**: Rejects any file path containing directory traversal (`..`) or resolving outside the current workspace roots.
- **Disk Synchronization Check**: Before applying an approved hunk, the engine verifies that the underlying file hasn't been modified on disk by the user in the interim, preventing silent race conditions.

---

## 6. Context Engine

The Context Engine keeps prompt payloads lean and highly relevant:
- **`@file` Resolution**: Parses file references from user queries and pulls relative workspace file contents.
- **`@symbol` Resolution**: Uses `vscode.executeWorkspaceSymbolProvider` to find function, class, and method definitions across languages.
- **Editor Context**: Captures the active file name, language ID, cursor position, and selected text block.
- **Token Budgeting**: Monitors estimated token counts, truncating oversized dependencies and providing summary hints rather than sending raw multi-megabyte files.

---

## 7. Security & Failure Handling

- **Zero Hardcoded Secrets**: All tokens are read from configuration or `vscode.SecretStorage`.
- **Credential Redaction**: Log output automatically masks authorization headers and tokens.
- **Resilient Reconnection**: If the TrueForge server becomes temporarily unavailable, the UI switches to a clear "Disconnected" status with an immediate "Retry Connection" action.
- **Model Failure Isolation**: A model error or turn timeout never crashes the extension or corrupts workspace files.
