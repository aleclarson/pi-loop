# Goddard Platform: Autonomous Agent Loop Support Report

## Executive Summary

This document provides a comprehensive analysis of the system prompt defined in `core/loop/prompts/loop.md`. It outlines the necessary feature additions and architectural changes required across the Goddard platform (SDK, Daemon, Backend, and CLI) to fully support the Staff-level autonomous coding agent described in the prompt.

The prompt outlines an agent that operates with high autonomy but strict safety boundaries, relying heavily on asynchronous human intervention for blockers, test-driven development (TDD), and strict adherence to project specifications (`spec/`).

---

## 1. Async Reporting & Suspension Protocol (The "Halt and Report" Flow)

The core mechanic of the prompt is the **Inaction Mandate**: the agent must halt, report blockers (spec drift, exogenous failures, architectural violations), and suspend its task until a human resolves it in an external UI.

### Required Platform Changes:

*   **SDK (`@goddard-ai/sdk`):**
    *   **Reporting Tool:** Implement a structured tool (e.g., `report_blocker`) exposed to the LLM. It must accept parameters like `blocker_type` (`spec_drift`, `arch_violation`, `exogenous_failure`), `description`, and `files_involved`.
    *   **Suspension Support:** The agent execution loop must support yielding/suspending execution upon calling the reporting tool, stopping further LLM token generation and API calls.
*   **Daemon (`@goddard-ai/daemon`):**
    *   **Session State:** Add states to track `pi_sessions` that are `SUSPENDED` or `BLOCKED_AWAITING_HUMAN`.
    *   **Resumption Listener:** Listen for Server-Sent Events (SSE) from the backend (e.g., `BLOCKER_RESOLVED`). Upon receipt, inject the human's resolution text/flags into the agent's context and resume the session.
*   **Backend / Schema (`@goddard-ai/backend`, `@goddard-ai/schema`):**
    *   **Database Schema:** Introduce `drizzle` tables for `agent_reports` linked to specific `pi_sessions`.
    *   **API Routes:** Add routes for clients to list active blockers and submit human resolutions (including specific override flags like `AGILITY_OVERRIDE`).
*   **CLI / UI (`@goddard-ai/cmd`):**
    *   **Commands:** Implement CLI commands such as `goddard report list` to view blockers and `goddard report resolve <id> --override=agility --message="Proceed with debt"` to unblock the agent asynchronously.

---

## 2. Goal Derivation & Proactive Execution

The agent is expected to proactively cross-reference `spec/` against `src/` to derive its own backlog, meaning it doesn't just react to user prompts.

### Required Platform Changes:

*   **Daemon:**
    *   **Triggers:** Implement a scheduled (Cron) or event-driven (e.g., post-merge to `main`) trigger that spawns a "Goal Generation" session.
*   **SDK:**
    *   **Spec Traversal:** Provide tools optimized for repository-wide specification parsing (e.g., a tool to read `spec/README.md` and recursively traverse referenced documents).
    *   **Goal Proposal:** A structured tool allowing the agent to formalize and persist a derived goal into the system before beginning execution.

---

## 3. Architecture & Technical Debt Management (ADRs)

The prompt requires the agent to generate Architecture Decision Records (ADRs) in `spec/adr/` when it is granted an "Agility Override" to bypass architectural constraints.

### Required Platform Changes:

*   **Backend / Schema:**
    *   Ensure the human resolution payload can explicitly pass an `AGILITY_OVERRIDE` flag.
*   **SDK:**
    *   **Context Injection:** When the agent is resumed with an `AGILITY_OVERRIDE`, the prompt injected upon resumption must explicitly command the agent to fulfill the ADR requirement.
    *   **ADR Tooling (Optional but recommended):** A dedicated tool (e.g., `create_adr`) that templates standard ADR formats to ensure consistency in `spec/adr/`.

---

## 4. PR Delivery & Blast Radius Templating

When a goal is completed, the agent must submit a Pull Request containing specific structured information: "The Why", "The Blast Radius", and links to new ADRs.

### Required Platform Changes:

*   **SDK / GitHub App (`@goddard-ai/sdk`, `@goddard-ai/github-app`):**
    *   **PR Creation Tool:** Enhance the `create_pull_request` tool to require these specific fields. Alternatively, provide a PR template specifically for autonomous loop agents.
    *   **Validation:** The SDK could validate that if the agent created files in `spec/adr/` during the session, those files are referenced in the PR body.

---

## 5. Execution Physics (TDD & Atomic Commits)

The agent must write failing tests, implement the code, ensure zero regressions, and commit them atomically. It is also forbidden from manually editing toolchain artifacts.

### Required Platform Changes:

*   **SDK:**
    *   **Sandboxed Execution:** Provide robust, persistent bash execution tools (`run_in_bash_session`) tailored for running test suites (`vitest`, `jest`, etc.).
    *   **Git Tools:** Provide explicit tools for atomic commits (e.g., `commit_changes`) so the agent doesn't have to string together complex git bash commands manually.
    *   **Guardrails:** Implement pre-commit hooks or SDK-level validation to prevent the agent from directly writing to files like `pnpm-lock.yaml`, forcing it to use bash commands like `pnpm install` instead.

---

## 6. Project Configuration & Overrides (`AGENTS.md`)

The prompt states: "If a project contains an `AGENTS.md` file, its directives supersede this document."

### Required Platform Changes:

*   **SDK / Daemon:**
    *   **Context Pre-loading:** Before initializing the LLM context, the system must automatically check for the existence of `AGENTS.md` in the repository.
    *   **Prompt Assembly:** If found, the contents of `AGENTS.md` must be dynamically injected into the system prompt with highest priority, ensuring the agent adheres to the repository-specific overrides.
