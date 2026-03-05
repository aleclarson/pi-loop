#!/usr/bin/env tsx
/**
 * sync-docs.ts
 *
 * Fetch third-party documentation into docs/third_party/<repo-name>/.
 * Only *.md files (plus the .git/ bookkeeping folder) are kept after the clone.
 *
 * Usage:
 *   pnpm sync-docs                          # sync all repos listed in synced_docs.json
 *   pnpm sync-docs <git-url> [subfolder]    # sync a single repo ad-hoc
 *
 * Examples:
 *   pnpm sync-docs
 *   pnpm sync-docs https://github.com/drizzle-team/drizzle-orm
 *   pnpm sync-docs https://github.com/cloudflare/workers-sdk docs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncedDocsEntry {
  url: string;
  subfolder?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd: string, cwd?: string): string {
  return execSync(cmd, {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  }).trim();
}

function log(msg: string) {
  console.log(`[sync-docs] ${msg}`);
}

/** Derive a safe directory name from a git remote URL. */
function repoNameFromUrl(url: string): string {
  return url.replace(/\.git$/, "").split("/").filter(Boolean).at(-1)!;
}

/**
 * Recursively delete every file that is NOT a *.md file.
 * Directories are pruned if they become empty after the sweep.
 * The .git/ directory at the root is always preserved untouched.
 */
function declutter(dir: string, isRoot = true): boolean {
  let hasKeeper = false;

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      // Never touch the top-level .git folder.
      if (isRoot && entry === ".git") {
        hasKeeper = true;
        continue;
      }

      const subtreeHasKeeper = declutter(full, false);
      if (subtreeHasKeeper) {
        hasKeeper = true;
      } else {
        fs.rmSync(full, { recursive: true, force: true });
      }
    } else {
      if (entry.endsWith(".md")) {
        hasKeeper = true;
      } else {
        fs.rmSync(full, { force: true });
      }
    }
  }

  return hasKeeper;
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

function syncRepo(gitUrl: string, subfolder?: string): void {
  const repoName = repoNameFromUrl(gitUrl);
  const targetBase = path.resolve("docs/third_party");
  const targetDir = path.join(targetBase, repoName);

  fs.mkdirSync(targetBase, { recursive: true });

  if (!fs.existsSync(path.join(targetDir, ".git"))) {
    log(`Cloning ${gitUrl} → ${targetDir}`);

    if (subfolder) {
      // Sparse checkout — only materialise the requested subfolder.
      run(
        `git clone --filter=blob:none --no-checkout --depth 1 "${gitUrl}" "${targetDir}"`
      );
      run(`git sparse-checkout init --cone`, targetDir);
      run(`git sparse-checkout set "${subfolder}"`, targetDir);
      run(`git checkout`, targetDir);
    } else {
      run(`git clone --depth 1 "${gitUrl}" "${targetDir}"`);
    }
  } else {
    log(`Repo already cloned at ${targetDir} — resetting to origin`);

    // Make sure the remote is still correct (handles URL changes).
    run(`git remote set-url origin "${gitUrl}"`, targetDir);

    const branch = run(`git rev-parse --abbrev-ref HEAD`, targetDir);
    log(`Current branch: ${branch}`);

    run(`git fetch origin`, targetDir);
    run(`git reset --hard "origin/${branch}"`, targetDir);

    // Re-apply sparse checkout if a subfolder was requested.
    if (subfolder) {
      run(`git sparse-checkout init --cone`, targetDir);
      run(`git sparse-checkout set "${subfolder}"`, targetDir);
    }
  }

  log(`Removing non-markdown files from ${targetDir}`);
  declutter(targetDir);

  log(`Done. Markdown files are available in docs/third_party/${repoName}/`);
}

// ---------------------------------------------------------------------------
// Main — single ad-hoc repo or batch from synced_docs.json
// ---------------------------------------------------------------------------

const [, , gitUrl, subfolder] = process.argv;

if (gitUrl) {
  syncRepo(gitUrl, subfolder);
} else {
  const manifestPath = path.resolve("synced_docs.json");

  if (!fs.existsSync(manifestPath)) {
    console.error(
      `[sync-docs] No arguments provided and no synced_docs.json found at ${manifestPath}`
    );
    process.exit(1);
  }

  const entries: SyncedDocsEntry[] = JSON.parse(
    fs.readFileSync(manifestPath, "utf8")
  );

  if (!Array.isArray(entries) || entries.length === 0) {
    log("synced_docs.json is empty — nothing to sync.");
    process.exit(0);
  }

  log(`Syncing ${entries.length} repo(s) from synced_docs.json…`);

  for (const entry of entries) {
    if (!entry.url) {
      console.warn(`[sync-docs] Skipping entry with missing "url": ${JSON.stringify(entry)}`);
      continue;
    }
    log(`\n— ${entry.url}${entry.subfolder ? ` (${entry.subfolder})` : ""}`);
    syncRepo(entry.url, entry.subfolder);
  }

  log("\nAll repos synced.");
}
