# Runtime Terrors - VS Code AI Coding Agent

[![VS Code](https://img.shields.io/badge/VS%20Code-1.90%2B-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![TrueForge Runtime](https://img.shields.io/badge/TrueForge-0.184.2-FF5722?logo=fastapi&logoColor=white)](https://trueforge.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Vitest-58%20Passed-4CAF50?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Runtime Terrors** is a professional VS Code-native AI coding assistant built for the TrueForge Hackathon. It is powered exclusively by the official TrueForge agent execution runtime and enforces strict human-in-the-loop diff review safety boundaries.

---

## TrueForge Requirement

TrueForge is the **mandatory agent execution runtime** for Runtime Terrors. The extension contains **no independent LLM orchestration loop** and makes **zero direct calls** to commercial model provider APIs. All model selection, prompt assembly, reasoning extraction, streaming, subagent orchestration, and tool execution are delegated directly to TrueForge via the official `@truefoundry/trueforge-sdk`.

START HERE: the TrueForge GitHub repository https://github.com/truefoundry/trueforge. Every submission must run its agent loop on TrueForge. Star the repository, read the README, and run npx @truefoundry/trueforge@latest on your laptop before you write a line of extension code. Documentation: [trueforge.dev](https://trueforge.dev/) · Quickstart: [trueforge.dev/quickstart](https://trueforge.dev/quickstart)

---

## Fork Point & Attribution

Fork Point: Built from scratch for this competition, integrating the official TrueForge SDK. Upstream LICENSE preserved.

- **Lead Developer**: Varun Penjendru ([@penjendru01varun](https://github.com/penjendru01varun))
- **Target Evaluation Benchmark**: [`pallets/flask`](https://github.com/pallets/flask) release tag **`3.1.3`** (commit `22d92470`)
- **Official Runtime Engine**: [`@truefoundry/trueforge-sdk`](https://www.npmjs.com/package/@truefoundry/trueforge-sdk) (v0.184.2)
- **Official Upstream Repository**: [TrueForge Engine](https://github.com/truefoundry/trueforge) (Apache 2.0 License preserved)

---

## Setup Instructions (Clean Clone)

Follow these steps to set up, build, and run Runtime Terrors from a clean clone:

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher (`v22+` recommended)
- **npm**: `v9.0.0` or higher
- **VS Code**: `v1.90.0` or higher
- **Python**: `3.10+` with `pip` (for running the `pallets/flask` benchmark tests)

### 2. Clone the Repository
```powershell
git clone https://github.com/penjendru01varun/runtime-terrors.git
cd runtime-terrors
```

### 3. Install Dependencies
```powershell
npm.cmd install
```

### 4. Start the TrueForge Standalone Server
Open a dedicated terminal and start the local TrueForge agent harness:
```powershell
npx.cmd --yes @truefoundry/trueforge@0.184.2
```
TrueForge will initialize its SQLite database and start listening at:
```text
http://127.0.0.1:8790
```
Open `http://127.0.0.1:8790` in your browser to configure your free Google Gemini API key (or OpenAI/Anthropic credentials).

### 5. Build Extension Host and React Webview
```powershell
npm.cmd run build
```
This builds both targets:
- `dist/extension.js`: Bundled Extension Host via `esbuild`
- `dist/webview/`: Production React 18 + Tailwind CSS Webview UI via `vite`

### 6. Verify with the Test Suite
Run the comprehensive Vitest test suite (14 test suites, 58 unit and integration tests):
```powershell
npm.cmd test
```

### 7. Launch the Extension Development Host
1. Open the `runtime-terrors` workspace in VS Code.
2. Press **`F5`** (or select **Run > Start Debugging**).
3. A new **[Extension Development Host]** VS Code window will appear.
4. In the new window, open your workspace folder (e.g. `pallets/flask` v3.1.3).
5. Look at the VS Code status bar at bottom right:
   - **`✓ TrueForge (Xms)`** indicates active, live connectivity.
   - Click the status bar item anytime to test or reconfigure connection settings.

---

## Model Configuration

Runtime Terrors connects directly to your local TrueForge server. Model provider credentials are **never hardcoded** and are **never written to plain text configuration files**.

- **API Key Security**: In the extension Settings panel, API tokens are securely saved to VS Code's internal **`SecretStorage`** (`context.secrets`).
- **Free Tier Ready**: Tested with **Google Gemini 3.5 Flash** (`google-gemini/gemini-3-5-flash`) at **$0.00** API cost.
- **Provider Agnostic**: TrueForge seamlessly bridges to OpenAI (`openai/gpt-4o`), Anthropic (`anthropic/claude-3-7-sonnet`), or local Ollama models without modifying extension code.

### Example Model Configuration JSON
Below is an example of the model configuration payload exchanged with TrueForge's session management API:

```json
{
  "trueforge": {
    "baseUrl": "http://127.0.0.1:8790",
    "token": "${secret:runtimeTerrors.trueforgeToken}",
    "defaultModel": "google-gemini/gemini-3-5-flash",
    "availableModels": [
      "google-gemini/gemini-3-5-flash",
      "google-gemini/gemini-2.5-pro",
      "openai/gpt-4o",
      "anthropic/claude-3-7-sonnet"
    ]
  },
  "mcp": {
    "serverPort": 3182,
    "transport": "sse",
    "endpoint": "http://127.0.0.1:3182/sse",
    "requireApproval": ["propose_file_change"]
  },
  "agentSpec": {
    "model": "google-gemini/gemini-3-5-flash",
    "instructions": "You are Runtime Terrors, a VS Code AI coding assistant. Plan carefully, use workspace MCP tools to inspect code, and propose surgical changes via propose_file_change.",
    "mcp_servers": [
      {
        "name": "runtime-terrors-workspace",
        "preload": true,
        "require_approval_for_tools": ["propose_file_change"]
      }
    ]
  }
}
```

---

## Overall Architecture

Runtime Terrors is architected around a strict separation of concerns: the **VS Code Extension** manages developer interaction, editor context, and visual safety approval; **TrueForge** manages the AI execution loop; and the embedded **Workspace MCP Server** provides safe workspace inspection tools.

```mermaid
flowchart TD
    subgraph VSCode["VS Code Extension Development Host"]
        UI["React Webview UI\n(ChatPanel, DiffReviewPanel, AgentActivity, Settings)"]
        Bridge["useVscodeBridge & MessageProtocol\n(Typed Bidirectional Webview RPC)"]
        ExtHost["Extension Host Coordinator\n(SessionManager, TurnStreamer, ContextEngine)"]
        DiffSys["Diff Review & Safety System\n(Myers DiffEngine, VirtualDocProvider, ChangeApplier)"]
        MCPServer["Workspace MCP Server (:3182/sse)\n(FileSyncGuard, FileTools, SearchTools)"]
        Disk["Local Workspace Files\n(pallets/flask, helpers.py, cli.py)"]
    end

    subgraph TrueForgeServer["TrueForge Agent Harness (http://127.0.0.1:8790)"]
        Engine["Agent Execution Runtime\n(Turn Orchestrator, AgentSpec, SubAgents)"]
        Catalog["Model Catalog & Connectors"]
    end

    subgraph Providers["Model Providers"]
        Gemini["Google Gemini (gemini-3-5-flash)"]
        OpenAI["OpenAI (gpt-4o)"]
        Anthropic["Anthropic (claude-3-7-sonnet)"]
    end

    UI <-->|Webview IPC| Bridge
    Bridge <-->|RPC Messages| ExtHost
    ExtHost <--> DiffSys
    ExtHost <--> MCPServer
    DiffSys -->|Atomic WorkspaceEdit on Approval| Disk
    MCPServer -->|Safe Read Only & Staging| Disk

    ExtHost <==>|Official TrueForge SDK (createTurnStream)| Engine
    Engine <--> Catalog
    Catalog <--> Providers
    Engine -.->|Remote MCP Tool Invocations| MCPServer
```

![Architecture](resources/architecture.png)

### Architectural Components

1. **TrueForge Agent Execution Loop**:
   - The extension initializes `new TrueForge({ baseUrl, token })`.
   - Each conversational session creates an agent specification via `client.sessions.create({ agent: { spec } })`.
   - Streaming is initiated via `client.sessions.createTurnStream(sessionId, { prompt, context })`.
   - Incoming Server-Sent Events (`model.message.delta`, `model.message`, `turn.done`) are parsed and streamed real-time into the UI.
   - When the developer clicks **"Stop"**, the extension immediately cancels in-flight requests using `AbortController` and invokes `client.sessions.cancel(sessionId)`.

2. **Workspace Model Context Protocol (MCP) Server**:
   - Runs an embedded HTTP/SSE MCP server on `http://127.0.0.1:3182/sse`.
   - Exposes tools to TrueForge: `read_file`, `list_directory`, `propose_file_change`, `search_workspace`, and `get_symbols`.
   - Registered dynamically with TrueForge via `client.settings.mcpServers.createOrUpdate(...)`.
   - Guarded by `FileSyncGuard` to prevent path traversal outside workspace folders.

3. **Diff Review & Safety System (Zero Silent Overwrites)**:
   - When TrueForge or an inline edit proposes a code modification via `propose_file_change`, it is **never** applied directly to disk.
   - The Myers-based `DiffEngine` computes granular additions (`+`) and deletions (`-`) organized into individual hunks.
   - The virtual document provider `runtime-terrors-diff://` renders native VS Code side-by-side diff editors (`vscode.diff`).
   - The developer can selectively **Accept** or **Reject** hunks or entire files.
   - Applied changes are executed through `vscode.WorkspaceEdit` and logged to an atomic rollback undo stack.

---

## The 3 Competition Tasks Walkthrough

Runtime Terrors was built and validated against the official hackathon benchmark: **`pallets/flask` (tag 3.1.3, commit `22d92470`)**.

For a minute-by-minute judge evaluation and video recording script, see **[DEMO_GUIDE.md](file:///c:/Users/hp/Downloads/RuntimeTerrors/runtime-terrors/DEMO_GUIDE.md)**.

---

### Task A: Inline Code Edit (`src/flask/helpers.py`)

Perform a surgical inline code edit on `get_debug_flag` to treat `'off'` and `'n'` as false case-insensitively, and approve the change via the Diff Review System.

1. **Open File**: Open `src/flask/helpers.py` in VS Code.
2. **Select Code**: Highlight the `get_debug_flag()` function (approx lines 23–45):
   ```python
   def get_debug_flag() -> bool:
       """Get whether debug mode should be enabled. By default it will look
       for the :envvar:`FLASK_DEBUG` environment variable. If it is not set,
       ...
   ```
3. **Trigger Shortcut**: Press **`Ctrl+Alt+I`** (macOS: `Cmd+Alt+I`) or right-click and choose **"Runtime Terrors: Inline Code Edit"**.
4. **Enter Exact Prompt**:
   ```text
   Treat the values 'off' and 'n' as false as well, case-insensitively, and update the docstring to list every value that is treated as false.
   ```
5. **Observe Diff Review**:
   - TrueForge streams the replacement.
   - Click **"Preview Changes"** to open the side-by-side native diff editor (`runtime-terrors-diff://`).
   - The Diff Review Panel displays additions and deletions with hunk-by-hunk decision cards.
6. **Accept**: Click **"Accept All"** (or click **"Accept"** on the hunk).
7. **Verification Command**:
   ```powershell
   $env:FLASK_DEBUG="off"; python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"
   ```
   **Expected Output**: `False`
   ```powershell
   $env:FLASK_DEBUG="n"; python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"
   ```
   **Expected Output**: `False`

![Diff Review](resources/diff-review.png)

---

### Task B: Multi-File Autonomous Agent Mode

Instruct TrueForge to implement a new `flask config` CLI command that outputs JSON with sensitive keys masked, covering code, tests, and docs — **without specifying any filenames**.

1. **Switch Mode**: In the Runtime Terrors sidebar panel, toggle the mode from **Chat** to **Agent**.
2. **Enter Exact Prompt** *(zero filenames specified)*:
   ```text
   Add a new built-in CLI command flask config that prints the loaded application's configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as "***". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands.
   ```
3. **Observe Autonomous Execution Timeline**:
   - TrueForge plans the task and queries workspace context through the embedded Workspace MCP Server (`list_directory`, `search_workspace`, `read_file`).
   - Proposes surgical modifications across at least **3 files**:
     1. `src/flask/cli.py` (registers Click `@cli.command("config")` with secret masking)
     2. `tests/test_cli.py` (adds unit test coverage verifying masked JSON)
     3. `docs/cli.rst` (documents `flask config` in the CLI manual)
4. **Approve via Diff Review**:
   - Switch to the **Diff Review** tab showing all 3 pending files.
   - Inspect the hunks verifying that `SECRET`, `PASSWORD`, `TOKEN`, `KEY` are masked with `"***"`.
   - Click **"Accept All"**.
5. **Verification Commands**:
   ```powershell
   # Run pytest on the CLI test suite
   pytest tests/test_cli.py -q
   ```
   **Expected Output**: All tests pass.
   ```powershell
   # Verify help registration
   flask --help
   ```
   **Expected Output**: `config` is listed under Commands.
   ```powershell
   # Verify sensitive key masking
   python -c "import flask; app = flask.Flask('demo'); app.config.update(SECRET_KEY='secret123', API_TOKEN='tok456', DEBUG=True); print('App ready')"
   flask --app "flask.Flask('demo')" config
   ```
   **Expected Output**: JSON configuration where `SECRET_KEY` and `API_TOKEN` values are `"***"`.

![Agent Mode](resources/agent-mode.png)

---

### Task C: Resilience & Non-Destructive Failure Handling

Demonstrate that when TrueForge is unreachable or an API failure occurs, the editor remains completely responsive, clear diagnostics are surfaced, and no files are corrupted.

1. **Simulate Runtime Failure**:
   - In the Runtime Terrors sidebar, click the **Settings** tab.
   - Change the **TrueForge URL** to an unreachable port: `http://127.0.0.1:9999`.
   - Click **"Save Settings"**.
   - Notice the status bar indicator immediately transitions to **`⚠ TrueForge Offline`**.
2. **Attempt Code Modification Under Failure**:
   - Open `src/flask/helpers.py`, highlight `get_debug_flag`, press **`Ctrl+Alt+I`**.
   - Enter: `"Refactor this function to use a dictionary lookup."`
   - Press Enter.
3. **Observe Resilience**:
   - **Zero Editor Freeze**: The VS Code editor remains 100% interactive. Typing, cursor movement, and navigation have zero lag.
   - **Clear Non-Blocking Notification**: A descriptive toast and chat message appear: `Runtime Terrors: TrueForge is offline (Could not reach TrueForge server at http://127.0.0.1:9999). Check settings.`
   - **Zero Workspace Corruption**: No broken files, garbage characters, or partial edits are written.
4. **Verification Command**:
   ```powershell
   git status
   ```
   **Expected Output**:
   Only developer-approved modifications exist; zero corrupted or untracked files:
   ```text
   On branch 3.1.3
   Changes not staged for commit:
     modified:   src/flask/helpers.py
     modified:   src/flask/cli.py
     modified:   tests/test_cli.py
     modified:   docs/cli.rst
   no untracked files present
   ```
5. **One-Click Rollback Demonstration**:
   - Click **"Undo Last Change"** in the Diff Review panel (or press `F1` -> `Runtime Terrors: Undo Last Applied Change`).
   - The last applied file modification is atomically reverted to its exact original state.

---

## TrueForge SDK Integration Reference

Runtime Terrors interfaces strictly with the official TrueForge SDK:

```typescript
import { TrueForge } from '@truefoundry/trueforge-sdk';

// 1. Initialise client
const client = new TrueForge({
  baseUrl: 'http://127.0.0.1:8790',
  token: trueforgeToken
});

// 2. Discover models dynamically
const models = await client.models.list();

// 3. Register Workspace MCP Server
await client.settings.mcpServers.createOrUpdate('runtime-terrors-workspace', {
  name: 'runtime-terrors-workspace',
  transport: { type: 'sse', url: 'http://127.0.0.1:3182/sse' }
});

// 4. Create conversational session with AgentSpec
const session = await client.sessions.create({
  agent: {
    spec: {
      model: 'google-gemini/gemini-3-5-flash',
      instructions: 'You are Runtime Terrors, a VS Code AI assistant...',
      mcp_servers: [{ name: 'runtime-terrors-workspace', preload: true, require_approval_for_tools: ['propose_file_change'] }]
    }
  }
});

// 5. Stream turns via Server-Sent Events
const stream = await client.sessions.createTurnStream(
  session.id,
  { prompt: userMessage, context: assembledContext },
  { signal: abortController.signal }
);

for await (const event of stream) {
  if (event.type === 'model.message.delta') {
    // Stream tokens real-time into the webview
  } else if (event.type === 'turn.done') {
    // Finalize turn and record metrics
  }
}

// 6. Instant cancellation
await client.sessions.cancel(session.id);
```

---

## Project Documentation Index

- **Demo Video & Judge Guide**: [`DEMO_GUIDE.md`](DEMO_GUIDE.md)
- **PDF Submission Writeup**: [`PDF_WRITEUP.md`](PDF_WRITEUP.md)
- **Full System Architecture**: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Project Structure & Module Map**: [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md)
- **Phase Implementation Plan**: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)

---

## License

MIT License. Built from scratch for the TrueForge AI Coding Assistant Hackathon.
Upstream TrueForge engine licenses preserved.
