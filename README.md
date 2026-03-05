# Goddard Spec Root

## Mission

Goddard bridges local terminal workflows with GitHub operations and extends that bridge to autonomous AI execution.

> Goddard provides a framework-agnostic TypeScript SDK, a Cloudflare-powered real-time backend, and an orchestration runtime so developers and agents can create PRs, observe repository events, and act without leaving the terminal.

## The Problem

Developer execution is fragmented across GitHub UI, CI dashboards, and chat tools. AI agents also lack a principled runtime for safe, long-running or feedback-triggered operation.

Goddard addresses:
1. **Interactive gap:** terminal-native GitHub operations with minimal context switching.
2. **Autonomous gap:** explicit runtimes for repeated cycles and one-shot PR-feedback reactions.

## Product Pillars

| # | Pillar | Meaning |
|---|--------|---------|
| 1 | SDK-first | Capabilities live in `@goddard-ai/sdk`; consumers stay thin. |
| 2 | Real-time | Repository events stream to terminals with low latency. |
| 3 | Delegated identity | `goddard[bot]` acts on behalf of authenticated developers. |
| 4 | Autonomous control | Built-in orchestration runs `pi-coding-agent` with safety limits. |
| 5 | Type safety | APIs and configuration are TypeScript-first with runtime validation. |
| 6 | Operability | CLI and `systemd` outputs support practical deployment. |
| 7 | Edge-native | Backend runs on Workers + Durable Objects for global fan-out. |

## Usage Modes

### 1) Interactive Developer CLI
A human developer uses terminal commands to authenticate, create PRs, trigger workflows, and launch focused `pi` sessions.

### 2) Desktop Workspace
A human developer uses a unified, IDE-like desktop surface to monitor sessions, review pull requests, browse specs, and manage roadmap context without hopping across multiple tools.

### 3) Autonomous Agent Runtimes
An operator runs unattended execution modes:
- Loop mode for recurring `pi-coding-agent` cycles.
- Daemon mode for webhook-derived PR-feedback one-shot sessions.
- Configurable limits for cadence, operations, and tokens.

All modes consume the same SDK and backend authority model.

## Encapsulated Sub-Specs

* `spec/core.md`: Core system runtime and configuration.
* `spec/cli.md`: CLI commands and interactions.
* `spec/daemon.md`: Background services and daemon functionality.
* `spec/app.md`: Desktop application UX and features.
* `spec/adr/`: Architecture decision records.
