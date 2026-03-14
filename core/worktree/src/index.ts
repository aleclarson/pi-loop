import { spawnSync } from "node:child_process"

export async function setupWorktree(
  projectDir: string,
  prNumber: number,
): Promise<{ worktreeDir: string; branchName: string }> {
  const branchName = `pr-${prNumber}`
  const agentsDir = `${projectDir}/.goddard-agents`
  const worktreeDir = `${agentsDir}/${branchName}-${Date.now()}`

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

  return { worktreeDir, branchName }
}
