# Runtime Terrors — Phased Implementation Plan

## Overview
This document tracks the phased engineering execution of **Runtime Terrors**.

---

## Phase 2: Architecture & Design
- [x] Create `ARCHITECTURE.md` (System design, TrueForge communication, MCP workspace bridge, diff system).
- [x] Create `IMPLEMENTATION_PLAN.md` (This document).
- [x] Create `PROJECT_STRUCTURE.md` (Complete file map and module roles).

---

## Phase 3: Project Foundation Setup
- [x] Scaffold `runtime-terrors/package.json` with commands, view containers, views, configuration schemas, and dependencies.
- [x] Set up `tsconfig.json` for extension host and webview React app.
- [x] Set up `esbuild.mjs` build script for extension host and `vite.config.ts` for webview.
- [x] Set up `vitest.config.ts` with in-memory VS Code mock aliasing.
- [x] Set up Tailwind CSS and PostCSS configuration for dark developer styling.
- [x] Implement bidirectional RPC message protocol between VS Code host and Webview.
- [x] Implement `src/extension.ts` with activation lifecycle, status bar item, and view registration.
- [x] Implement settings storage with VS Code `SecretStorage`.

---

## Phase 4: Core AI Development (Completed)
- [x] **Task 4.1 – Real TrueForge Chat Integration**:
  - `SessionManager` creating and tracking sessions via `client.sessions.create({ agent: { spec } })`.
  - Dynamic model discovery via `client.models.list()`.
  - Comprehensive connection diagnostics for offline/unreachable servers.
- [x] **Task 4.2 – Streaming Responses**:
  - `TurnStreamer` consuming SSE events via `client.sessions.createTurnStream()`.
  - Incremental token streaming (`model.message.delta`).
  - Collapsible Chain-of-Thought thinking accordion (`reasoningContent`).
  - Turn completion and token metric aggregation (`model.message` + `turn.done`).
- [x] **Task 4.3 – Cancellation**:
  - Immediate local abort via `AbortController`.
  - Server-side cancellation dispatch via `client.sessions.cancel(sessionId)`.
  - Responsive "Stop Generation" button in webview.
- [x] **Task 4.4 – Context Engine Foundation**:
  - Active editor selection, visible range, and language ID extraction (`editorContext.ts`).
  - `@file` reference parser and workspace boundary checker (`fileResolver.ts`).
  - Strict security exclusions for `.env`, `id_rsa`, `.key`, `.pem`, and secret files.
  - `@symbol` lookup via `vscode.executeWorkspaceSymbolProvider` (`symbolResolver.ts`).
  - Token-budgeted context assembly (`contextEngine.ts`).
- [x] **Task 4.5 – Inline Edit Foundation**:
  - Selection capture with line-range fallback.
  - Quick input prompt for developer instructions.
  - Surgical code modification system prompt (`InlineEditPromptTemplate`).
  - Streaming replacement with user prompt for Accept, Preview, or Discard.
- [x] **Task 4.6 – Agent Mode Foundation**:
  - Autonomous task planner with step progression tracking (`taskPlanner.ts`).
  - Autonomous agent coordinator executing multi-step tasks through TrueForge (`autonomousAgent.ts`).
  - Explicit documentation and handling of Windows sandbox limitations (`LocalSandboxProvider win32`).
- [x] **Validation & Testing**:
  - 27 automated tests passing across 9 test suites in Vitest.
  - Clean TypeScript typecheck (`tsc --noEmit`) with zero errors.
  - Production build verified (`dist/extension.js` and `dist/webview/`).

---

## Phase 5: Diff Review & Workspace Integration (Completed)
- [x] **Diff Engine & Myers Algorithm**:
  - Full Myers diff calculation and hunk generation (`src/diff/diffEngine.ts`).
  - Hunk filtering to safely handle metadata lines (`\ No newline at end of file`).
  - Selective reconstruction (`reconstructContentWithHunkDecisions`) allowing developers to accept or reject individual hunks.
- [x] **Virtual Document Provider & Side-by-Side Diffing**:
  - Custom scheme `runtime-terrors-diff://` registered with VS Code TextDocumentContentProvider (`virtualDocumentProvider.ts`).
  - Native side-by-side diff editor invocation via `vscode.diff` (`diffViewer.ts`).
- [x] **Change Applier & Rollback Stack**:
  - Atomic file application using VS Code `WorkspaceEdit` (`changeApplier.ts`).
  - Comprehensive rollback stack for one-click and command-based undo (`diffManager.undoLastChange()`).
- [x] **Diff Review UI & Webview Integration**:
  - Dedicated "Diff Review" tab in Webview UI with live pending file counter (`DiffReviewPanel.tsx`).
  - Line-by-line diff rendering with green additions, red deletions, and line numbers.
  - Hunk-by-hunk decision buttons ("Accept", "Reject", status badges).
  - File-level actions ("Side-by-Side Diff", "Accept All", "Reject All").
  - Global "Undo Last Applied Change" button.
- [x] **Workspace MCP Bridge & Safety Guard**:
  - `FileSyncGuard` with path traversal protection and sensitive file blocking (`.env`, `*.pem`, `id_rsa`, `credentials.json`).
  - Workspace tool implementations: `read_file`, `list_directory`, `propose_file_change`, `search_workspace`, `get_symbols`.
  - Non-destructive change proposals: all agent edits route through `diffManager` for developer approval.
- [x] **Inline Edit Direct Diff Integration**:
  - `InlineEditController` automatically computes full file proposals and registers them with `diffManager`.
  - Developer can choose "Accept Replacement" (with rollback logging), "Preview Changes" (opens native diff and Diff Review panel), or "Discard".
- [x] **Full Verification**:
  - 56 automated tests passing across 14 test files in Vitest.
  - Zero TypeScript typecheck errors across both extension host and webview UI.
  - Verified production build (`dist/extension.js` and `dist/webview/`).
