import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import type { WorktreePlugin } from "./types.js"

export const worktrunkPlugin: WorktreePlugin = {
  name: "worktrunk",

  isApplicable(projectDir: string): boolean {
    try {
      const versionResult = spawnSync("wt", ["--version"])
      if (versionResult.status !== 0) {
        return false
      }

      // Check if the current project is a valid worktrunk environment by checking for .config/wt.toml
      return fs.existsSync(path.join(projectDir, ".config", "wt.toml"))
    } catch {
      return false
    }
  },

  setup(projectDir: string, prNumber: number, branchName: string): string | null {
    try {
      const switchResult = spawnSync("wt", ["switch", `pr:${prNumber}`], {
        cwd: projectDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })

      if (switchResult.status === 0) {
        // Find the newly created worktree path using git from within the project dir
        const worktreeListResult = spawnSync("git", ["worktree", "list"], {
          cwd: projectDir,
          encoding: "utf8",
        })

        if (worktreeListResult.status === 0) {
          const lines = worktreeListResult.stdout.split("\n")
          for (const line of lines) {
            if (line.includes(`[${branchName}]`)) {
              const wtPath = line.split(" ")[0]
              if (wtPath) {
                return wtPath
              }
            }
          }
        }
      }

      // Edge case: Worktrunk switch succeeded but we couldn't find the path.
      // Let's try to remove it before falling back so we don't leak it.
      if (switchResult.status === 0) {
        spawnSync("wt", ["remove", branchName], {
          cwd: projectDir,
          encoding: "utf8",
          stdio: "ignore",
        })
      }
    } catch {
      // Setup failed
    }

    return null
  },

  cleanup(worktreeDir: string, branchName: string): boolean {
    try {
      const result = spawnSync("wt", ["remove", branchName], {
        // Execute command from parent dir so we aren't inside the directory we're trying to delete
        cwd: worktreeDir.split("/").slice(0, -1).join("/") || "/",
        encoding: "utf8",
        stdio: "ignore",
      })

      if (result.status === 0 && !result.error) {
        return true
      }
    } catch {
      // Cleanup failed
    }

    return false
  },
}
