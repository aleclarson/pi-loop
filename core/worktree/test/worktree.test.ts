import { describe, it, expect, vi, beforeEach } from "vitest"
import { setupWorktree } from "../src/index.ts"
import * as childProcess from "node:child_process"

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0 })),
}))

describe("setupWorktree", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should create a worktree directory and branch name", async () => {
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
    vi.mocked(childProcess.spawnSync).mockImplementation((cmd) => {
      if (cmd === "git") return { status: 1 } as any
      return { status: 0 } as any
    })

    const projectDir = "/test/dir"
    const prNumber = 123

    // Should not throw
    await expect(setupWorktree(projectDir, prNumber)).resolves.toBeDefined()
  })
})
