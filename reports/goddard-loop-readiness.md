# Goddard Loop Readiness Review (Manual Human Testing)

**Date:** 2026-03-03  
**Reviewer:** Pi coding agent  
**Scope:** Assess whether `goddard loop` core functionality is ready for manual human testing.

## Verdict

**Not ready for manual human testing as `goddard loop`.**

The loop runtime exists only in legacy `old-cmd/` (`pi-loop`) code and is not wired into the current `@goddard-ai/cmd` CLI surface described in the active `spec/` graph.

---

## What was reviewed

### Spec intent
- `spec/cli/loop.md`
- `spec/runtime-loop.md`
- `spec/configuration.md`
- `spec/rate-limiting.md`

### Current implementation
- `cmd/src/index.ts` (current `goddard` CLI)
- `old-cmd/src/index.ts` (loop runtime)
- `old-cmd/src/cli.ts` (legacy loop CLI)
- `old-cmd/src/rate-limiter.ts`
- `old-cmd/src/types.ts`
- Workspace/package wiring (`package.json`, `pnpm-workspace.yaml`, `old-cmd/package.json`)

---

## Key findings

## 1) `goddard loop` commands are missing from the active CLI

Active CLI (`cmd/src/index.ts`) exposes:
- `login`, `logout`, `whoami`, `pr`, `stream`, `spec`, `propose`, `agents`

It does **not** expose:
- `goddard loop init`
- `goddard loop run`
- `goddard loop generate-systemd`

This is a direct gap against `spec/cli/loop.md`.

---

## 2) Loop implementation is isolated in `old-cmd/` and not part of workspace execution

The loop runtime (`createLoop`, rate limiter, CLI) exists under `old-cmd/` and is branded as `pi-loop`, not `goddard loop`.

- `old-cmd/package.json` name: `pi-loop`
- Root workspace excludes `old-cmd`
- Root lint/test/check do not validate loop code

Observed command:
- `pnpm --dir=old-cmd build` fails in current repo state because dependencies are not installed there (`tsup: command not found`).

This means there is no integrated, continuously validated path for manual testers using current project workflows.

---

## 3) Significant naming and contract drift vs current spec

Spec expects:
- config file: `goddard.config.ts`
- command namespace: `goddard loop ...`
- systemd unit output: `goddard.service`

Legacy implementation uses:
- config file: `pi-loop.config.ts`
- command namespace: `pi-loop ...`
- systemd output: `pi-loop.service`
- global config dir: `~/.pi-loop/`

This drift will create confusion and invalid test scripts if manual testing starts now.

---

## 4) Core loop logic quality is promising but unproven in this repo lifecycle

`old-cmd/src/index.ts` includes meaningful runtime behavior aligned with spec goals:
- persistent session reuse
- rate limiting + retries + jitter
- per-cycle token cap check
- DONE signal termination handling

However, because it is not integrated into the active CLI/workspace/test paths, this remains **implementation potential**, not test-ready product behavior.

---

## 5) Automated test coverage for loop path is absent

There are no loop tests under `old-cmd/`, and no `goddard loop` tests under `cmd/`.

Without baseline smoke tests for init/run/systemd generation and config discovery, manual testing will be high-friction and difficult to trust.

---

## Readiness decision

`goddard loop` is currently in a **pre-integration state**.

Manual human testing should be deferred until the loop path is surfaced and validated in the active `cmd/` package.

---

## Minimum actions required before manual testing

1. **Integrate loop into active CLI**
   - Add `loop` subcommands to `cmd/src/index.ts` using current command framework.

2. **Align naming/contracts with spec**
   - `goddard loop ...`
   - `goddard.config.ts`
   - `systemd/goddard.service`
   - `~/.goddard/config.ts` global behavior

3. **Move or port loop runtime out of `old-cmd/` into active package path**
   - Ensure it is part of workspace lint/test/check.

4. **Add smoke tests**
   - `loop init` file creation + collision behavior
   - config discovery local/global precedence
   - `loop generate-systemd` output correctness
   - run-path guards and failure messages

5. **Publish a manual QA playbook**
   - one deterministic script for local and one for systemd path.

---

## Final assessment

**Current status: NOT READY for manual human testing of `goddard loop`.**

The core runtime concept is present in legacy code, but the product surface described by the active spec is not yet wired into the current CLI and delivery pipeline.
