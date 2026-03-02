# goddard

TypeScript-only monorepo scaffold for `backend`, `cmd`, `github-app`, and `sdk` using `pnpm` workspaces with `git-subrepo` synchronization.

## Workspace

- `backend`
- `cmd`
- `github-app`
- `sdk`

## CI Sync

A GitHub Action is configured at `.github/workflows/sync-subrepos.yml`.

It runs on pushes to `main` when one of the subrepo paths changes and executes:

- `git subrepo push backend`
- `git subrepo push cmd`
- `git subrepo push github-app`
- `git subrepo push sdk`

## Required secret

Configure repository secret:

- `SYNC_PAT`: token with write access to this repository and each external subrepo.

## Local validation

```bash
pnpm run check
```

This runs:
- root TypeScript typecheck
- package tests

## CI

A CI workflow is configured at `.github/workflows/ci.yml` and runs `pnpm run check` on pull requests and pushes to `main`.
