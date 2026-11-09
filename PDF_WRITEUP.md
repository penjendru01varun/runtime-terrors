# Runtime Terrors — Hackathon Submission Writeup

---

## Team: Varun Penjendru, [College/Employer], [My GitHub Handle: penjendru01varun]

- **Lead Engineer & Extension Architect**: Varun Penjendru
- **GitHub**: [@penjendru01varun](https://github.com/penjendru01varun)
- **Project Repository**: [Runtime Terrors (VS Code Extension)](https://github.com/penjendru01varun/runtime-terrors)
- **Hackathon Track**: VS Code-Native AI Coding Assistant powered by TrueForge

---

## Starting point: From scratch (VS Code extension) integrating official TrueForge SDK. Flask test repo: pallets/flask, release tag 3.1.3 (commit 22d92470).

Runtime Terrors was conceived, architected, and built **from scratch** specifically for this competition. The codebase is organized into a modular TypeScript architecture with a React 18 / Tailwind CSS webview sidebar, an embedded Model Context Protocol (MCP) server, and the official `@truefoundry/trueforge-sdk`.

The project was rigorously developed and verified against the official benchmark repository:
- **Repository**: [`pallets/flask`](https://github.com/pallets/flask)
- **Release Tag**: `3.1.3`
- **Target Commit**: `22d92470`
- **Official TrueForge Runtime**: External standalone harness (`@truefoundry/trueforge@0.184.2`) running locally at `http://127.0.0.1:8790`. The upstream TrueForge source repository remains 100% untouched and clean.

---

## Architecture on TrueForge

Runtime Terrors strictly upholds the competition mandate: **TrueForge executes the entire agent loop**. The extension contains zero independent LLM orchestration code and makes zero direct HTTP calls to OpenAI, Anthropic, Gemini, or other commercial model APIs.

```mermaid
flowchart LR
    VSCode["VS Code Extension\n(UI + Diff System)"] <==>|Official TrueForge SDK\n(createTurnStream SSE)| TrueForge["TrueForge Agent Harness\n(:8790)"]
    TrueForge <--> Providers["Google Gemini 3.5 Flash\n(or GPT-4o / Claude)"]
    TrueForge -.->|Remote MCP Calls\n(:3182/sse)| MCPServer["Local Workspace MCP Server\n(read_file, propose_file_change)"]
    MCPServer --> DiffReview["Diff Review System\n(Non-Destructive Staging)"]
    DiffReview -->|User Approved WorkspaceEdit| Disk["Local Disk Files"]
```

### 1. Extension-to-TrueForge Communication
- **SDK Client**: Initialized via `new TrueForge({ baseUrl: 'http://127.0.0.1:8790', token })`.
- **Session Lifecycle**: Each conversational thread creates a dedicated TrueForge session with `client.sessions.create({ agent: { spec } })`.
- **Turn Streaming**: Streams turns via `client.sessions.createTurnStream(sessionId, { prompt, context })`. The extension consumes typed Server-Sent Events (SSE):
  - `model.message.delta`: Real-time text and reasoning deltas streamed to the React UI.
  - `model.message`: Finalized turn response with input/output token usage.
  - `turn.done`: Clean state finalization and turn completion.
- **In-Flight Cancellation**: Clicking **"Stop Generation"** triggers an `AbortController` signal and dispatches `client.sessions.cancel(sessionId)` to halt TrueForge immediately.

### 2. Editor Capabilities Exposed as Workspace MCP Tools
To enable TrueForge to inspect and modify local workspaces without requiring local Unix containers, Runtime Terrors runs an embedded HTTP/SSE MCP server on `http://127.0.0.1:3182/sse`. This server is dynamically registered with TrueForge via `client.settings.mcpServers.createOrUpdate(...)` and exposes five capabilities:
- `read_file`: Reads files safely within workspace bounds.
- `list_directory`: Recursively or shallowly inspects workspace file hierarchies.
- `propose_file_change`: Stages surgical file modifications into the Diff Review System without touching disk.
- `search_workspace`: Performs fast workspace-wide text search.
- `get_symbols`: Queries VS Code document and workspace symbol providers for AST identifiers.

### 3. TrueForge Harness Features Used
- **Turn Streaming & Event Pipeline**: High-throughput SSE token delivery with reasoning content isolation.
- **AgentSpec & SubAgents**: Autonomous task execution with model binding, system prompts, and preloaded MCP server specifications.
- **Tool Approval Framework**: TrueForge tool approval events (`tool.approval_required`) integrated with the extension's human-in-the-loop review policy.

---

## How context is selected

Runtime Terrors implements an intelligent Context Engine designed for precision, token efficiency, and security:

1. **`@file` Reference Resolver**:
   - Matches workspace-relative paths (e.g. `@file:src/flask/helpers.py` or `@src/flask/helpers.py`).
   - Supports line range slicing (e.g. `@file:src/flask/helpers.py#L23-L45`) to extract only the pertinent code blocks.
   - Automatically injects file metadata, language identifier, and line numbers into the context payload.

2. **`@symbol` AST Identifier Resolver**:
   - Executes VS Code's `vscode.executeWorkspaceSymbolProvider` to find functions, classes, interfaces, and methods by name.
   - Injects the symbol's declaration signature, container class, and enclosing scope directly into the prompt.

3. **Active Editor Context**:
   - Automatically captures the current file path, active language ID, cursor position, selected text range, and visible viewport lines.

4. **Token Budgeting**:
   - Employs a heuristic token estimator (~4 characters per token).
   - Dynamically budgets prompt size against model context windows, applying sliding window truncation to keep conversational context compact while leaving generous budget for generated code.

5. **Security Fencing (`FileSyncGuard`)**:
   - Prevents accidental leakage of secrets and credential files.
   - Strictly fences against path traversal attacks outside workspace folders (`../`).
   - Glob exclusion fence blocks sensitive files: `.env`, `.env.*`, `*.pem`, `id_rsa`, `id_ed25519`, `credentials.json`, `*.key`, and `.git/` internals. If an agent or user prompt references a fenced file, the request is blocked and logged.

---

## Model setup: Google Gemini 3.5 Flash (Free Tier). Ran locally via TrueForge. Approx cost: $0. Users can switch models in the Settings panel.

- **Primary Model**: `google-gemini/gemini-3-5-flash` running through TrueForge's official model connectors.
- **Operational Cost**: **$0.00** using Google Gemini Free Tier API keys.
- **Key Storage**: The user's API key is stored securely in VS Code's internal `SecretStorage` (`context.secrets`) and configured on the local TrueForge server.
- **Dynamic Model Discovery**: The extension queries `client.models.list()` to discover available models dynamically.
- **Model Switching**: Users can switch models anytime in the extension's **Settings** tab (e.g. to `openai/gpt-4o` or `anthropic/claude-3-7-sonnet`) without restarting the extension or modifying code.

---

## Scorecard

| Judging Criterion | Video Timestamp | One-line Claim |
| :--- | :--- | :--- |
| **Mandatory TrueForge Agent Loop** | | 100% of reasoning, streaming, and tool calls run on TrueForge via official SDK; zero direct LLM API calls in extension. |
| **Task A: Inline Code Edit** | | Surgically modified `get_debug_flag` in `src/flask/helpers.py`, approved via side-by-side diff, verified `FLASK_DEBUG=off` returns `False`. |
| **Task B: Autonomous Multi-File Agent** | | Given a high-level prompt with zero filenames, TrueForge planned and modified 3 files (`cli.py`, `test_cli.py`, `cli.rst`) with secret masking, passing `pytest`. |
| **Task C: Resilience & Zero Corruption** | | Under simulated runtime failure (unreachable port), VS Code remained 100% interactive, surfaced clean errors, and left `git status` 100% uncorrupted. |
| **Diff Review & Safety Boundary** | | Zero silent file overwrites; Myers diff engine generates hunks with line-by-line acceptance, native `vscode.diff`, and atomic undo/rollback stack. |
| **Real-Time Streaming & Cancellation** | | Streams word-by-word via typed SSE (`model.message.delta`), separates reasoning tokens, and cancels in-flight turns instantly with `client.sessions.cancel`. |
| **Context Selection & Security Fencing** | | Resolves `@file` and `@symbol`, budgets tokens, and strictly fences against sensitive files (`.env`, `*.pem`, `credentials.json`). |
| **Test Coverage & Engineering Rigor** | | 58 unit & integration tests passing across 14 Vitest suites with 0 TypeScript compiler errors. |

---

## Tools used

1. **Antigravity by Google DeepMind**: Autonomous AI pair programming assistant utilized for full-stack architecture design, TypeScript extension authoring, Vitest test suite creation, and documentation.
2. **VS Code Extension API**: Extensibility interfaces for Webviews, Workspace edits, Document Providers (`runtime-terrors-diff://`), Native Diff Views, and `SecretStorage`.
3. **Official TrueForge SDK (`@truefoundry/trueforge-sdk` v0.184.2)**: External agent harness, session management, turn streaming, and model connectors.
4. **TypeScript 5.8 & Node.js 22**: Strict type-safe codebase for Extension Host and MCP server.
5. **React 18 & Vite & Tailwind CSS**: Modern developer sidebar UI with Chat, Diff Review, Agent Activity, and Settings panels.
6. **Vitest**: Blazing-fast test runner validating diffing, session lifecycle, cancellation, context resolution, and MCP tool protocols.
7. **esbuild**: Extension Host bundler delivering optimized distribution artifacts.
8. **Git & GitHub**: Version control and submission repository.

---

## Known limitations and what you would do with another month

### Known Limitations
1. **Windows Local Sandbox Boundary**:
   - TrueForge's built-in `LocalSandboxProvider` requires Unix container/process isolation primitives and is explicitly unsupported on Windows (`win32`).
   - *Current Solution*: Runtime Terrors bridges this limitation by running an embedded HTTP/SSE Workspace MCP server with strict `FileSyncGuard` boundaries. While this safely restricts file operations to the active workspace, it does not execute untrusted terminal commands in an isolated Linux kernel container on Windows.
2. **AST-Aware 3-Way Merge**:
   - The current Diff Review System uses a line-based Myers diff algorithm. If local files are edited concurrently while an agent task is streaming, hunk offsets may require manual review.

### What We Would Build with Another Month
1. **WSL2 / Docker Desktop Native Container Sandbox for TrueForge**:
   - Contribute a cross-platform Windows sandbox backend to the upstream TrueForge engine utilizing lightweight WSL2 or Docker containers with virtualized networking and disposable filesystem overlays.
2. **Tree-Sitter Semantic AST Merging**:
   - Integrate Tree-sitter for language-aware semantic diff merging, automatically reconciling non-conflicting concurrent edits (such as sibling function additions) without line conflict rejections.
3. **Ephemeral Git Worktree Branching**:
   - For complex multi-file autonomous tasks, automatically spin up an isolated Git worktree (`git worktree add`), execute changes and run `pytest` in background, and present the final validated branch diff as a pull-request review card in the UI.
4. **Inline Ghost Text Completions**:
   - Implement real-time inline code completions using low-latency TrueForge turn streams rendered directly as ghost text in the active VS Code editor buffer.

