import { describe, it, expect, vi, beforeEach } from "vitest"
import { setupWorktree, cleanupWorktree } from "../src/index.ts"
import * as childProcess from "node:child_process"

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0, stdout: "" })),
}))

describe("setupWorktree", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should create a worktree directory and branch name via copy fallback when worktrunk is missing", async () => {
    vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
      if (cmd === "wt" && args?.[0] === "--version") return { status: 1, stdout: "", error: undefined } as any
      return { status: 0, stdout: "", error: undefined } as any
    })

    const projectDir = "/test/dir"
    const prNumber = 123
    const result = await setupWorktree(projectDir, prNumber)

    expect(result.branchName).toBe("pr-123")
    expect(result.worktreeDir).toMatch(/^\/test\/dir\/.goddard-agents\/pr-123-\d+$/)

    // Check that mkdir and cp were called
    expect(childProcess.spawnSync).toHaveBeenCalledWith("mkdir", ["-p", "/test/dir/.goddard-agents"])
    expect(childProcess.spawnSync).toHaveBeenCalledWith(
      "cp",
      expect.any(Array),
      expect.objectContaining({ encoding: "utf8" })
    )
  })

  it("should handle git fetch and checkout errors gracefully", async () => {
    // Mock git commands to fail, but cp and mkdir to succeed
    vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
      if (cmd === "wt" && args?.[0] === "--version") return { status: 1, stdout: "", error: undefined } as any
      if (cmd === "git") return { status: 1, stdout: "", error: undefined } as any
      return { status: 0, stdout: "", error: undefined } as any
    })

    const projectDir = "/test/dir"
    const prNumber = 123

    // Should not throw
    await expect(setupWorktree(projectDir, prNumber)).resolves.toBeDefined()
  })

  it("should use worktrunk if available", async () => {
    vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
      if (cmd === "wt" && args?.[0] === "--version") return { status: 0, stdout: "1.0.0", error: undefined } as any
      if (cmd === "wt" && args?.[0] === "switch") return { status: 0, stdout: "", error: undefined } as any
      if (cmd === "git" && args?.[0] === "worktree" && args?.[1] === "list") {
        return { status: 0, stdout: "/test/dir/.wt/pr-123 e1234 [pr-123]\n/test/dir main [main]", error: undefined } as any
      }
      return { status: 0, stdout: "", error: undefined } as any
    })

    const projectDir = "/test/dir"
    const prNumber = 123
    const result = await setupWorktree(projectDir, prNumber)

    expect(result.isWorktrunk).toBe(true)
    expect(result.branchName).toBe("pr-123")
    expect(result.worktreeDir).toBe("/test/dir/.wt/pr-123")

    expect(childProcess.spawnSync).toHaveBeenCalledWith("wt", ["switch", "pr:123"], expect.any(Object))

    // Ensure it does NOT check out PR code manually since worktrunk handles it natively
    expect(childProcess.spawnSync).not.toHaveBeenCalledWith("git", ["fetch", "origin", "pull/123/head:pr-123"], expect.any(Object))
    expect(childProcess.spawnSync).not.toHaveBeenCalledWith("git", ["checkout", "pr-123"], expect.any(Object))
  })
})

describe("cleanupWorktree", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should use rm -rf for non-worktrunk directories", async () => {
    vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
      if (cmd === "wt" && args?.[0] === "--version") return { status: 1, stdout: "", error: undefined } as any
      return { status: 0, stdout: "", error: undefined } as any
    })
    await cleanupWorktree("/test/dir/.goddard-agents/pr-123-1234", "pr-123", false)
    expect(childProcess.spawnSync).toHaveBeenCalledWith("rm", ["-rf", "/test/dir/.goddard-agents/pr-123-1234"], expect.any(Object))
  })

  it("should use wt remove if isWorktrunk is true", async () => {
    vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
      if (cmd === "wt" && args?.[0] === "--version") return { status: 0, stdout: "1.0.0", error: undefined } as any
      if (cmd === "wt" && args?.[0] === "remove") return { status: 0, stdout: "", error: undefined } as any
      return { status: 0, stdout: "", error: undefined } as any
    })

    await cleanupWorktree("/test/dir/.wt/pr-123", "pr-123", true)
    expect(childProcess.spawnSync).toHaveBeenCalledWith("wt", ["remove", "pr-123"], expect.any(Object))
    expect(childProcess.spawnSync).not.toHaveBeenCalledWith("rm", ["-rf", "/test/dir/.wt/pr-123"], expect.any(Object))
  })

  it("should fallback to rm -rf if wt remove fails", async () => {
    vi.mocked(childProcess.spawnSync).mockImplementation((cmd, args) => {
      if (cmd === "wt" && args?.[0] === "--version") return { status: 0, stdout: "1.0.0", error: undefined } as any
      if (cmd === "wt" && args?.[0] === "remove") return { status: 1, stdout: "", error: undefined } as any
      return { status: 0, stdout: "", error: undefined } as any
    })

    await cleanupWorktree("/test/dir/.wt/pr-123", "pr-123", true)
    expect(childProcess.spawnSync).toHaveBeenCalledWith("wt", ["remove", "pr-123"], expect.any(Object))
    expect(childProcess.spawnSync).toHaveBeenCalledWith("rm", ["-rf", "/test/dir/.wt/pr-123"], expect.any(Object))
  })
})
