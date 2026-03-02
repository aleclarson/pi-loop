# goddard

TypeScript-only monorepo for:

- `@goddard-ai/sdk`
- `@goddard-ai/backend`
- `@goddard-ai/github-app`
- `@goddard-ai/cmd`

## Workspace

- `backend`
- `cmd`
- `github-app`
- `sdk`

## Quick start (local)

```bash
pnpm install
pnpm run check
```

### 1) Start the backend

```bash
pnpm --filter @goddard-ai/backend start
```

Backend runs at `http://127.0.0.1:8787`.

### 2) Use the CLI

```bash
pnpm --filter @goddard-ai/cmd exec tsx bin/goddard.ts login --username <github-user>
pnpm --filter @goddard-ai/cmd exec tsx bin/goddard.ts whoami
pnpm --filter @goddard-ai/cmd exec tsx bin/goddard.ts pr create --repo owner/repo --title "Test PR" --head feature/demo --base main
pnpm --filter @goddard-ai/cmd exec tsx bin/goddard.ts actions trigger --repo owner/repo --workflow ci --ref main
pnpm --filter @goddard-ai/cmd exec tsx bin/goddard.ts stream --repo owner/repo
```

### 3) Simulate a GitHub webhook

Use `@goddard-ai/github-app` to forward webhook events to backend:

```bash
pnpm --filter @goddard-ai/github-app exec tsx --eval "import { createGitHubApp } from './src/index.ts'; (async () => { const app = createGitHubApp({ backendBaseUrl: 'http://127.0.0.1:8787' }); await app.handleWebhook({ type: 'issue_comment', owner: 'owner', repo: 'repo', prNumber: 1, author: 'teammate', body: 'Looks good' }); console.log('webhook sent'); })();"
```

## CI

- `.github/workflows/ci.yml` runs typecheck + tests on PRs and on `main` pushes.
- `.github/workflows/sync-subrepos.yml` pushes each subrepo via `git-subrepo` on `main`.

## Required secret for subrepo sync

- `SYNC_PAT`: token with write access to this repository and each external subrepo.
