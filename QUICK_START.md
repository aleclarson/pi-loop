# QUICK START

This guide explains how to set up Goddard in two ways: **Local Development** and **Production Deployment**.

---

## 1. Local Development (MVP Test)

This is the fastest way to see the full end-to-end flow (CLI -> SDK -> Backend -> Webhook) in your terminal.

### Prerequisites
- Node.js 22+
- `pnpm`

### Step 1: Install & Check
```bash
pnpm install
pnpm run check
```

### Step 2: Start the Backend (Terminal A)
```bash
pnpm --dir=backend start
# Backend starts on http://127.0.0.1:8787
```

### Step 3: Use the CLI (Terminal B)
```bash
# Login (simulated)
pnpm --dir=cmd goddard login --username developer

# Create a PR (in-memory)
pnpm --dir=cmd goddard pr create --repo owner/repo --title "Local Test"

# Start the event stream
pnpm --dir=cmd goddard stream --repo owner/repo
```

### Step 4: Simulate a Webhook (Terminal C)
```bash
pnpm --dir=github-app exec tsx --eval "import { createGitHubApp } from './src/index.ts'; (async () => { const app = createGitHubApp({ backendBaseUrl: 'http://127.0.0.1:8787' }); await app.handleWebhook({ type: 'issue_comment', owner: 'owner', repo: 'repo', prNumber: 1, author: 'teammate', body: 'Looks good' }); })();"
```

---

## 2. Production Deployment

Goddard is designed to be deployed as a globally distributed control plane.

### Infrastructure Requirements
- **Cloudflare Workers**: Host the API and Durable Objects for WebSockets.
- **Turso**: Edge SQLite database for persistence.
- **GitHub App**: For official PR creation and webhook ingestion.

### Deployment Steps

1.  **Database Setup**:
    - Provision a Turso database.
    - Set `TURSO_DB_URL` and `TURSO_DB_AUTH_TOKEN`.
2.  **GitHub App Setup**:
    - Register a new GitHub App.
    - Set `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY`.
3.  **Backend Deployment**:
    - Run `wrangler deploy` in the `backend/` directory.
4.  **CLI Distribution**:
    - The `cmd/` package is distributed to users via npm as `@goddard-ai/cmd`.

For a deep dive into the architecture, see [build.md](./build.md).
For CLI-specific usage, see [cmd/QUICK_START.md](./cmd/QUICK_START.md).
