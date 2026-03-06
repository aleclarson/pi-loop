import { Command } from "@tauri-apps/plugin-shell";
import { open } from "@tauri-apps/plugin-dialog";

export class GitService {
  async selectRepoDirectory(): Promise<string | null> {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    // selected can be string or string[] or null. Since multiple is false, it should be string or null.
    // However, the types might be strict, so I'll cast it.
    if (Array.isArray(selected)) {
      return selected[0] || null;
    }
    return selected as string | null;
  }

  async checkoutBranch(repoPath: string, branchName: string): Promise<void> {
    // 1. Fetch
    const fetchCmd = Command.create("git", ["fetch", "origin"], {
      cwd: repoPath,
    });
    const fetchOutput = await fetchCmd.execute();
    if (fetchOutput.code !== 0) {
      throw new Error(`Git fetch failed: ${fetchOutput.stderr}`);
    }

    // 2. Checkout
    const checkoutCmd = Command.create("git", ["checkout", branchName], {
      cwd: repoPath,
    });
    const checkoutOutput = await checkoutCmd.execute();
    if (checkoutOutput.code !== 0) {
      throw new Error(`Git checkout failed: ${checkoutOutput.stderr}`);
    }
  }
}

export const gitService = new GitService();
