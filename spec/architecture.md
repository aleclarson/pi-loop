# Architecture

## Technology Stack

| Layer | Technology |
|-------|-----------|
| API / Webhooks / WebSockets | Cloudflare Workers |
| Real-time broadcast | Cloudflare Durable Objects |
| Database | Turso (SQLite at the Edge) + Drizzle ORM |
| Authentication | GitHub OAuth Device Flow |
| Package management | `pnpm` Workspaces |
| Distribution | `git-subrepo` → standalone repositories |

---

## Repository Layout

```text
goddard/                     # Monorepo Root
├── backend/                 # Cloudflare Worker, Durable Objects, Drizzle schema
│   └── .gitrepo             → github.com/goddard-ai/goddard-backend
├── cmd/                     # Thin CLI wrapper (interactive mode)
│   └── .gitrepo             → github.com/goddard-ai/goddard-cli
├── github-app/              # App manifest, webhook handlers, Octokit logic
│   └── .gitrepo             → github.com/goddard-ai/goddard-github-app
├── sdk/                     # Framework-agnostic TypeScript client library
│   └── .gitrepo             → github.com/goddard-ai/goddard-sdk
└── pnpm-workspace.yaml      # Cross-package dependency management
```

Each subdirectory is also publishable as a standalone repository via automated `git-subrepo` sync (`.github/workflows/sync-subrepos.yml`).

---

## Component Deep Dives

### Backend (`backend/` + `github-app/`)

Hosted on Cloudflare Workers; acts as the control plane.

**Database schema (Turso / Drizzle):**
- `users` — maps GitHub IDs to usernames.
- `cli_sessions` — stores Device Flow verification state.
- `installations` — maps `owner/repo` to GitHub App Installation IDs.

**Authentication flow:**
1. CLI requests a device code from the Worker.
2. User authorizes via browser.
3. Worker issues a session token stored in `cli_sessions`.

**Webhook handling:**
- Receives `pull_request`, `issue_comment`, and `pull_request_review` events from GitHub.
- Uses Octokit to apply automated reactions (e.g., 👀 on new comments).

**Real-time streaming:**
- Each repository is represented by a Cloudflare Durable Object.
- Webhook events are routed to the matching Durable Object.
- The Durable Object broadcasts events over open WebSocket connections to authenticated CLI clients.

#### Schema management with `drizzle-kit`

`backend/src/schema.ts` is the **single source of truth** for table structure.

```bash
# After editing schema.ts, generate a versioned migration:
pnpm --dir=backend db:generate   # drizzle-kit generate

# Apply pending migrations:
pnpm --dir=backend db:migrate    # drizzle-kit migrate
```

Never write migration SQL by hand. `drizzle-kit` snapshots the previous schema, diffs it, and emits only the necessary `ALTER TABLE` statements into a timestamped file under `backend/migrations/`.

---

### Core SDK (`sdk/`)

Package name: `@goddard-ai/sdk`. Zero runtime environment assumptions (browser, Node, Cloudflare).

**Dependency injection:** Accepts a `TokenStorage` interface for flexible session token persistence (in-memory, file system, `localStorage`, etc.).

**Public API surface:**
- `sdk.pr.create(options)` — sends PR-creation intent to the backend.
- `sdk.stream.subscribeToRepo(repo)` — manages WebSocket lifecycle; normalizes frames into typed `EventEmitter` events (`comment`, `review`, `error`).

---

### Interactive CLI (`cmd/`)

Package name: `@goddard-ai/cmd`.

- **Context inference:** Parses `.git/config` to resolve `owner/repo` automatically.
- **Storage:** Implements `TokenStorage` using the local file system (`~/.goddard/config.json`).
- **UX:** Terminal spinners, colored output, formatted real-time event stream.

**Commands:**
```bash
goddard login --username <github-user>
goddard whoami
goddard pr create --repo owner/repo --title "..." --head feature/x --base main
goddard actions trigger --repo owner/repo --workflow ci --ref main
goddard stream --repo owner/repo
```

---

## End-to-End Data Flow (PR Creation)

```
1. Dev: goddard pr create -m "Fix memory leak"
2. CLI → SDK: format request
3. SDK → Worker: POST /pr  (with session token)
4. Worker → Turso: validate session, fetch GitHub identity
5. Worker → GitHub API: create PR as goddard[bot], append "Authored by @username"
6. Reviewer: comments on PR at github.com
7. GitHub → Worker: POST webhook (issue_comment event)
8. Worker → Octokit: add 👀 reaction
9. Worker → Durable Object: route event payload
10. Durable Object → WebSocket: broadcast to all subscribed CLI clients
11. SDK: parse frame, emit `comment` event
12. CLI: print comment natively in terminal
```

---

## Current Build Status

**Implemented:**
- SDK-first architecture consumed by `cmd/` and `github-app/`.
- Local backend control plane: auth flow, PR creation, webhook ingest, WebSocket repo streams.
- GitHub App shim forwarding webhook events to backend.
- Monorepo CI (`typecheck` + `test`) and subrepo sync workflow scaffolding.
- Auth/session expiration checks, request body size limits, invalid JSON handling.
- SDK stream payload guards (malformed frames emit `error` rather than crashing listeners).
- Tests for session expiry, invalid JSON, and malformed stream payloads.

---

## Path to Production

### A. Persistence & Infrastructure

| Task | Detail |
|------|--------|
| Database migration | Replace `InMemoryBackendControlPlane` with Turso + Drizzle. Define `users`, `auth_sessions`, `pull_requests` in `backend/src/schema.ts`. |
| Cloudflare Workers deploy | Add `wrangler.toml`; replace in-memory WebSocket state with Durable Objects. |
| Production secrets | `TURSO_DB_URL`, `TURSO_DB_AUTH_TOKEN`, `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`. |

### B. Distribution (`git-subrepo`)

| Task | Detail |
|------|--------|
| External repos | Create `goddard-sdk`, `goddard-cli`, `goddard-backend`, `goddard-github-app`. |
| Subrepo init | `git subrepo init` for each subdirectory, pointing to HTTPS URLs. |
| CI secret | Add `SYNC_PAT` (PAT with write access to all five repos) to monorepo secrets. |

### C. Developer Experience

- Local SQLite/Drizzle mode for persistence testing without Turso.
- Pre-flight env-var validation in CLI and backend startup.

> **Status:** Local MVP is fully functional and tested. Production persistence and subrepo publishing require the infrastructure and credential setup described above (see `todo.md`).
