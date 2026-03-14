import { spawnSync } from "node:child_process"

function hasWorktrunk(): boolean {
  try {
    const result = spawnSync("wt", ["--version"])
    return result.status === 0
  } catch {
    return false
  }
}

export async function setupWorktree(
  projectDir: string,
  prNumber: number,
): Promise<{ worktreeDir: string; branchName: string; isWorktrunk: boolean }> {
  const branchName = `pr-${prNumber}`
  let worktreeDir = ""
  let isWorktrunk = false

  if (hasWorktrunk()) {
    console.log(`\n[INFO] Worktrunk detected. Attempting to use it for PR workspace setup...`)
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
                worktreeDir = wtPath
                isWorktrunk = true
                console.log(`[INFO] Successfully created and switched to Worktrunk workspace at ${wtPath}`)
                break
              }
            }
          }
        }
      }

      if (!isWorktrunk && switchResult.status === 0) {
        // Edge case: Worktrunk switch succeeded but we couldn't find the path.
        // Let's try to remove it before falling back so we don't leak it.
        console.log(`[WARN] Worktrunk switch succeeded but failed to locate worktree path. Attempting to clean it up.`)
        spawnSync("wt", ["remove", branchName], {
          cwd: projectDir,
          encoding: "utf8",
          stdio: "ignore",
        })
      }
    } catch {
      // Fallback
    }
  }

  if (!isWorktrunk) {
    console.log(`[INFO] Falling back to legacy copy-on-write workspace setup...`)
    const agentsDir = `${projectDir}/.goddard-agents`
    worktreeDir = `${agentsDir}/${branchName}-${Date.now()}`

    // Ensure agents dir exists
    spawnSync("mkdir", ["-p", agentsDir])

    // Use copy-on-write clone to create the workspace instantly based on OS
    try {
      let cpArgs = ["-R", projectDir + "/", worktreeDir]
      if (process.platform === "darwin") {
        cpArgs = ["-cR", projectDir + "/", worktreeDir]
      } else if (process.platform === "linux") {
        cpArgs = ["--reflink=auto", "-R", projectDir + "/", worktreeDir]
      }

      let cloneResult = spawnSync("cp", cpArgs, { encoding: "utf8" })
      let fallbackAttempted = false

      if (cloneResult.status !== 0 && process.platform === "darwin") {
        // Fallback to regular copy if APFS clone fails on macOS
        fallbackAttempted = true
        cpArgs = ["-R", projectDir + "/", worktreeDir]
        cloneResult = spawnSync("cp", cpArgs, { encoding: "utf8" })
      }

      if (cloneResult.status !== 0) {
        console.error(`\n[ERROR] Failed to create agent workspace at ${worktreeDir}`)
        if (fallbackAttempted) {
          console.error("Attempted APFS clone (cp -cR) and fallback copy (cp -R). Both failed.")
        }
        console.error(`Last attempted command: cp ${cpArgs.join(" ")}`)
        if (cloneResult.stderr) console.error(`Error output: ${cloneResult.stderr.trim()}`)
        if (cloneResult.error) console.error(`System error: ${cloneResult.error.message}`)
        throw new Error(`Cannot proceed with one-shot pi session. Aborting.\n`)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Cannot proceed")) {
        throw err
      }
      console.error(`\n[ERROR] Exception thrown while creating agent workspace at ${worktreeDir}:`)
      throw new Error("Failed to create workspace")
    }
  }

  if (!isWorktrunk) {
    // Fetch and checkout the branch in the new workspace
    try {
      spawnSync("git", ["fetch", "origin", `pull/${prNumber}/head:${branchName}`], {
        cwd: worktreeDir,
        stdio: "ignore",
      })
      spawnSync("git", ["checkout", branchName], {
        cwd: worktreeDir,
        stdio: "ignore",
      })
    } catch {
      // Ignore error
    }
  }

  return { worktreeDir, branchName, isWorktrunk }
}

export async function cleanupWorktree(
  worktreeDir: string,
  branchName: string,
  isWorktrunk: boolean,
): Promise<void> {
  if (isWorktrunk && hasWorktrunk()) {
    try {
      const result = spawnSync("wt", ["remove", branchName], {
        // Execute command from parent dir so we aren't inside the directory we're trying to delete
        cwd: worktreeDir.split("/").slice(0, -1).join("/") || "/",
        encoding: "utf8",
        stdio: "ignore",
      })

      if (result.status === 0 && !result.error) {
        console.log(`[INFO] Successfully cleaned up Worktrunk workspace.`)
        return
      }
      console.log(`[WARN] Worktrunk removal failed. Falling back to standard cleanup.`)
    } catch {
      console.log(`[WARN] Worktrunk removal exception. Falling back to standard cleanup.`)
    }
  }

  // Standard cleanup: delete the directory
  try {
    spawnSync("rm", ["-rf", worktreeDir], {
      encoding: "utf8",
      stdio: "ignore",
    })
  } catch {
    // Ignore error
  }
}
