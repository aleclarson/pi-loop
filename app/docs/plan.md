# Tauri Implementation Plan (JS/TS Focused)

## 1. Technology Stack

- **Framework**: Tauri 2.0
- **Frontend logic & UI**: Preact, TypeScript, CSS Modules.
- **ClickUp & Jules APIs**: `@tauri-apps/plugin-http` (provides a drop-in replacement for standard `fetch()` that executes natively to bypass browser CORS restrictions).
- **Local Storage**: `@tauri-apps/plugin-store` (for JS-driven JSON persistence).
- **Git & System Execution**: `@tauri-apps/plugin-shell` (to execute local `git` commands directly from TypeScript).
- **File System / Pickers**: `@tauri-apps/plugin-dialog` (for selecting Git repo folders).
- **Rust Backend**: Treated strictly as a host. **Zero custom Rust code** will be written; we will rely entirely on configuring Tauri capabilities (JSON).

## 2. Architecture Overview

We will use a "Thick Client / Frontend-Heavy" architecture. Preact/TypeScript will orchestrate the entire workflow. Instead of writing custom Rust bindings via Tauri Commands (`invoke`), the frontend will use Tauri's official JS APIs to interact with the OS.

- **Data layer**: Managed via Preact Signals.
- **Service layer**: Plain TypeScript classes/functions utilizing Tauri plugins.

## 3. Phase-by-Phase Implementation

### Phase 1: Project Setup & Tauri Configuration

1.  **Initialize**: Run `create-tauri-app` (Preact + TypeScript).
2.  **Install Tauri Plugins**:
    ```bash
    npm install @tauri-apps/plugin-store @tauri-apps/plugin-http @tauri-apps/plugin-shell @tauri-apps/plugin-dialog
    ```
3.  **Configure Capabilities (`src-tauri/capabilities/default.json`)**:
    - **HTTP**: Allow requests to `https://api.clickup.com/*` and `https://jules.googleapis.com/*`.
    - **Shell**: Expose the `git` executable.
    - **Dialog & Store**: Grant read/write access to the AppData folder for the `.json` store.

### Phase 2: Persistence Setup (TypeScript)

Create `src/services/store.ts`.

1.  Initialize the store using `@tauri-apps/plugin-store`:
    ```typescript
    import { Store } from "@tauri-apps/plugin-store";
    const store = new Store("app_settings.json");
    ```
2.  Create helper functions to `get` and `set` the three main data pillars:
    - `clickup_pat` (string)
    - `jules_api_key` (string)
    - `space_repo_mappings` (Record<string, string>)
    - `active_jules_sessions` (Record<string, SessionState>)

### Phase 3: ClickUp Integration (TypeScript)

Create `src/services/clickup.ts`. Use Tauri's HTTP plugin `fetch` to avoid WebView CORS issues.

1.  **Setup Fetch**:
    ```typescript
    import { fetch } from "@tauri-apps/plugin-http";
    ```
2.  **API Methods**:
    - `getSpaces()`: `fetch('https://api.clickup.com/api/v2/team/...')`
    - `getLists(spaceId)`: Fetch folders/lists.
    - `getTasks(listId)`: Fetch active tasks.
    - `delegateTask(taskId, userId)`:
      - `fetch` (PUT) to update status to "In Progress".
      - `fetch` (PUT/POST) to add `userId` to task assignees.

### Phase 4: Git Integration (TypeScript)

Create `src/services/git.ts`. Use Tauri's Shell plugin to run Git commands directly.

1.  **Select Directory**: Use `@tauri-apps/plugin-dialog` (`open({ directory: true })`) to let the user pick the Git repo path, saving the result to the Tauri Store.
2.  **Execute Git Commands**:

    ```typescript
    import { Command } from "@tauri-apps/plugin-shell";

    export async function checkoutBranch(repoPath: string, branchName: string) {
      // Run: git fetch origin
      const fetchCmd = Command.create("git", ["fetch", "origin"], {
        cwd: repoPath,
      });
      await fetchCmd.execute();

      // Run: git checkout <branchName>
      const checkoutCmd = Command.create("git", ["checkout", branchName], {
        cwd: repoPath,
      });
      await checkoutCmd.execute();
    }
    ```

### Phase 5: Jules Integration Layer (TypeScript)

Create `src/services/jules.ts`.

- **API**: Use the Jules REST API (`https://jules.googleapis.com/v1alpha`).
- **Auth**: Authenticate using the `x-goog-api-key` header with the `jules_api_key` from the Store.

1.  **Methods**:
    - `createSession(prompt, sourceContext)`: POST `/sessions`. Returns a `Session` object.
    - `sendMessage(sessionId, message)`: POST `/sessions/{sessionId}:sendMessage`.
    - `listActivities(sessionId)`: GET `/sessions/{sessionId}/activities` to poll for progress and PR creation.
    - `approvePlan(sessionId)`: POST `/sessions/{sessionId}:approvePlan` (if required).

### Phase 6: Frontend UI Construction

1.  **State Management**: Create a central store using Preact Signals to listen to the Tauri Store and manage application state.
2.  **Views**:
    - **Settings View**: Inputs for `clickup_pat` and `jules_api_key`. Saves to Store.
    - **Spaces View**: Lists spaces. Uses an "add folder" icon to trigger the `open()` dialog and map the returned path to the Space ID in the Store.
    - **Tasks View**:
      - Maps through fetched ClickUp tasks.
      - "Open in ClickUp" uses `@tauri-apps/plugin-shell`'s `open()` to launch the user's default web browser.
      - "Delegate to Jules" opens the Prompt Modal.
3.  **Jules Prompt Modal**: A simple text area. On submit -> triggers `clickup.delegateTask()`, updates the local Store to mark the task as active, and calls `jules.createSession()`.
4.  **Session Controls**: Conditional UI. If `active_jules_sessions[task.id]` exists, hide default buttons and show Pause/Resume/Archive. The "Checkout PR" button remains `disabled` until `jules.listActivities()` indicates a PR has been created.
