import { execFile } from "child_process";
import { promisify } from "util";
import { AgentJob, AgentJobRequest, AgentJobResult, AgentProvider } from "../types";

const execFileAsync = promisify(execFile);

export class JulesProvider implements AgentProvider {
  readonly id = "google-jules";

  private getRepoString(request: AgentJobRequest): string {
    if (request.repo.type === "github") {
      return `${request.repo.owner}/${request.repo.repo}`;
    }
    // Local fallback/approximation
    return ".";
  }

  async startJob(request: AgentJobRequest): Promise<AgentJob> {
    const repoStr = this.getRepoString(request);

    // Create a new session for the repository securely using execFile
    const { stdout } = await execFileAsync("jules", [
        "remote",
        "new",
        "--repo",
        repoStr,
        "--session",
        request.prompt
    ]);

    // Assuming the output contains the session ID.
    // The exact format is not fully known, but we'll try to extract the ID.
    // E.g. "Session 123456 created" -> 123456
    const match = stdout.match(/(?:Session|ID)[:\s]*([a-zA-Z0-9_-]+)/i) || stdout.match(/([a-zA-Z0-9_-]+)/);
    const id = match ? match[1] : "unknown-id";

    return {
      id,
      provider: this.id,
      status: "running"
    };
  }

  async getJob(jobId: string): Promise<AgentJob> {
    try {
      const { stdout } = await execFileAsync("jules", ["remote", "list", "--session"]);

      // If the session is listed and indicates completion
      // We'll use a rudimentary check: if it says "completed" or "done" near the ID
      const lines = stdout.split('\n');
      const sessionLine = lines.find(line => line.includes(jobId));

      let status: "running" | "completed" | "failed" = "running";

      if (sessionLine) {
         if (sessionLine.toLowerCase().includes("complete") || sessionLine.toLowerCase().includes("done")) {
             status = "completed";
         } else if (sessionLine.toLowerCase().includes("fail") || sessionLine.toLowerCase().includes("error")) {
             status = "failed";
         }
      }

      return {
        id: jobId,
        provider: this.id,
        status
      };
    } catch (err) {
      // In case the list command fails
      return {
        id: jobId,
        provider: this.id,
        status: "running"
      };
    }
  }

  async getResult(jobId: string): Promise<AgentJobResult> {
    try {
      const { stdout } = await execFileAsync("jules", ["remote", "pull", "--session", jobId]);

      return {
          success: true,
          summary: "Pulled Jules session successfully",
          patch: stdout
      };
    } catch (err: any) {
      return {
          success: false,
          error: err.message
      };
    }
  }
}
