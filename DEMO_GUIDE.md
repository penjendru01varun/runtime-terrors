# Runtime Terrors — Hackathon Demo Video Script & Walkthrough Guide

> **4-Minute Video Recording & Judge Evaluation Guide**  
> Target Benchmark Repository: **`pallets/flask` (version 3.1.3)**  
> Mandatory Runtime Engine: **TrueForge Agent Harness (`http://127.0.0.1:8790`)**

---

## Pre-Demo Checklist (1-Minute Setup)

### 1. Start the TrueForge Server
Ensure the standalone TrueForge server is running in a background terminal:
```powershell
npx.cmd --yes @truefoundry/trueforge@0.184.2
```
Verify the server starts at `http://127.0.0.1:8790` and your model (e.g., Gemini `google-gemini/gemini-3-5-flash` or OpenAI `openai/gpt-4o`) is configured with a valid API key in TrueForge.

### 2. Prepare the `pallets/flask` Workspace
Clone or open the official `pallets/flask` v3.1.3 repository:
```powershell
git clone https://github.com/pallets/flask.git
cd flask
git checkout 3.1.3
pip install -e .
pip install pytest
```

### 3. Launch Runtime Terrors
In the `runtime-terrors` project directory, launch the extension in the Extension Development Host:
1. Press `F5` in VS Code (or run `npm.cmd run build` then open the debug host).
2. Open the `pallets/flask` folder inside the Extension Development Host window.
3. Check the bottom-right status bar: **`✓ TrueForge (Xms)`** confirms live connectivity.
4. Click the **Runtime Terrors** icon in the Activity Bar to open the assistant sidebar.

---

## Video Scene 1: Task A — Inline Edit (`src/flask/helpers.py`)
*Target Time: 0:00 – 1:15 (75 seconds)*

### Goal:
Perform surgical inline modification of `get_debug_flag` using TrueForge and approve changes via the Diff Review System.

### Step-by-Step Actions:
1. **Open the File**:
   In VS Code, open `src/flask/helpers.py`.
2. **Select Code**:
   Highlight the entire `get_debug_flag` function (approx lines 23–45):
   ```python
   def get_debug_flag() -> bool:
       """Get whether debug mode should be enabled. By default it will look
       for the :envvar:`FLASK_DEBUG` environment variable. If it is not set,
       ...
   ```
3. **Trigger Inline Edit**:
   - Press **`Ctrl+Alt+I`** (macOS: `Cmd+Alt+I`), or right-click the selection and choose **"Runtime Terrors: Inline Code Edit"**.
4. **Enter Exact Prompt**:
   In the prompt input box, enter:
   ```text
   Treat the values 'off' and 'n' as false as well, case-insensitively, and update the docstring to list every value that is treated as false.
   ```
5. **Observe Generation**:
   - TrueForge streams the surgical replacement in real-time.
   - An action notification appears: **"Accept Replacement"**, **"Preview Changes"**, or **"Discard"**.
6. **Preview & Diff Review**:
   - Click **"Preview Changes"**.
   - Notice VS Code immediately opens the **Side-by-Side Diff Editor** (`runtime-terrors-diff://`) showing exact additions (green) and deletions (red).
   - In the Runtime Terrors sidebar, switch to the **Diff Review** tab showing:
     - `src/flask/helpers.py (+N, -N)`
     - Hunk-by-hunk decision cards with line numbers.
7. **Accept the Modification**:
   - Click **"Accept All"** (or click the green **"Accept"** button on the hunk).
   - Show that the modification is atomically saved to disk with rollback logging.
8. **Verification Command**:
   Open the integrated terminal and run:
   ```powershell
   $env:FLASK_DEBUG="off"; python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"
   ```
   **Expected Output**: `False`
   
   Test the other new false value:
   ```powershell
   $env:FLASK_DEBUG="n"; python -c "from flask.helpers import get_debug_flag; print(get_debug_flag())"
   ```
   **Expected Output**: `False`

---

## Video Scene 2: Task B — Multi-File Autonomous Agent Mode
*Target Time: 1:15 – 3:00 (105 seconds)*

### Goal:
Execute an autonomous multi-file task that creates a new CLI command (`flask config`), tests it, and documents it — with zero filenames specified in the prompt.

### Step-by-Step Actions:
1. **Switch to Agent Mode**:
   - In the Runtime Terrors sidebar panel, toggle the mode from **Chat** to **Agent**.
2. **Enter Exact Judge Prompt** *(Note: Do NOT mention any files)*:
   ```text
   Add a new built-in CLI command flask config that prints the loaded application's configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as "***". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands.
   ```
3. **Observe Autonomous Execution Timeline**:
   - The **Agent Activity** timeline updates in real-time (`AgentActivity.tsx`).
   - TrueForge plans the task and queries workspace context via the local **Workspace MCP Server**:
     - `list_directory`: Discovers project layout (`src/flask/cli.py`, `tests/test_cli.py`, `docs/cli.rst`).
     - `search_workspace`: Inspects existing CLI commands and test conventions.
     - `read_file`: Reads `src/flask/cli.py` to match the Click group syntax.
4. **Human-in-the-Loop Review**:
   - TrueForge stages the proposed modifications across at least **3 files**:
     1. `src/flask/cli.py` (adds `@cli.command("config")` with secret key masking)
     2. `tests/test_cli.py` (adds unit tests for `flask config` and masked output)
     3. `docs/cli.rst` (adds documentation for `flask config`)
5. **Diff Review & Multi-File Approval**:
   - Switch to the **Diff Review** tab.
   - Point out the badge showing **3 pending files**.
   - Expand each file to show the hunks:
     - Check masking logic for `SECRET`, `PASSWORD`, `TOKEN`, `KEY` -> `***`.
   - Click **"Accept All"** to apply changes to disk.
6. **Show TrueForge Session**:
   - Open browser at `http://127.0.0.1:8790` and show the active session with model calls, tool scheduling, and metrics.
7. **Verification Commands**:
   - **Run the CLI test suite**:
     ```powershell
     pytest tests/test_cli.py -q
     ```
     **Expected Output**: All tests pass (`... passed`).
   - **Verify `--help` registration**:
     ```powershell
     flask --help
     ```
     **Expected Output**: `config` appears in the Commands list with its description.
   - **Verify JSON masking output**:
     Create a quick test app or run against sample config:
     ```powershell
     python -c "import flask, json; app = flask.Flask('demo'); app.config.update(SECRET_KEY='supersecret', DB_PASSWORD='mypassword', API_TOKEN='abc123', DEBUG=True); print('App configured')"
     flask --app "flask.Flask('demo')" config
     ```
     **Expected Output**: Clean JSON where sensitive keys display `"***"`.

---

## Video Scene 3: Task C — Resilience & Non-Destructive Failure Handling
*Target Time: 3:00 – 4:00 (60 seconds)*

### Goal:
Demonstrate that when TrueForge is unreachable or a model error occurs, the editor remains 100% responsive, diagnostic messages are clear, and no files are corrupted.

### Step-by-Step Actions:
1. **Simulate Runtime Failure**:
   - In the Runtime Terrors sidebar, click the **Settings** tab.
   - Change the **TrueForge URL** to an invalid or unreachable port, e.g.:
     `http://127.0.0.1:9999` (or temporarily enter an invalid token).
   - Click **"Save Settings"**.
   - Notice the status bar indicator immediately transitions to: **`⚠ TrueForge Offline`**.
2. **Attempt Code Modification Under Failure**:
   - Return to `src/flask/helpers.py`.
   - Select `get_debug_flag` and press **`Ctrl+Alt+I`**.
   - Enter:
     ```text
     Refactor this function to use a dictionary lookup.
     ```
   - Press Enter.
3. **Observe Resilience**:
   - **Zero Editor Freeze**: The VS Code editor stays completely responsive. You can continue typing and navigating without lag.
   - **Clear Diagnostic Notification**: A non-blocking toast and chat message appear:
     `Runtime Terrors: TrueForge is offline (Could not reach TrueForge server at http://127.0.0.1:9999). Check settings.`
   - **Zero Corruption**: The file is completely untouched. No garbage tokens or partial edits were written.
4. **Verification Command**:
   In the integrated terminal, run:
   ```powershell
   git status
   ```
   **Expected Output**:
   Show that only the previously accepted changes are present and no corrupted or temporary files exist:
   ```text
   On branch 3.1.3
   Changes not staged for commit:
     modified:   src/flask/helpers.py
     modified:   src/flask/cli.py
     modified:   tests/test_cli.py
     modified:   docs/cli.rst
   no untracked files present
   ```
5. **One-Click Rollback Demo (Bonus Polish)**:
   - Click the **"Undo Last Change"** button in the Diff Review panel (or press `F1` -> `Runtime Terrors: Undo Last Applied Change`).
   - Show `src/flask/helpers.py` immediately reverting back to original.

---

## Video Submission Summary Checklist

| Criterion | Proof Demonstrated |
| :--- | :--- |
| **Task A (Inline Edit)** | Selected `get_debug_flag`, prompt executed, diff reviewed, accepted, `FLASK_DEBUG=off` printed `False`. |
| **Task B (Agent Mode)** | Prompt executed with no files mentioned, 3 files modified, TrueForge session shown, `pytest tests/test_cli.py` passed, masked JSON output verified. |
| **Task C (Resilience)** | Endpoint made unreachable, editor remained responsive, clear error displayed, `git status` verified zero corruption. |
| **TrueForge Engine Rule** | Zero direct LLM provider calls in extension; 100% routed through official `@truefoundry/trueforge-sdk`. |
| **Safety Rule** | All changes gated through Diff Review System; zero silent overwrites. |

