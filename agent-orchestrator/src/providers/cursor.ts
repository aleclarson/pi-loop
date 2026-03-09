import { ChildProcess, spawn } from "child_process";
import { randomUUID } from "crypto";
import { AgentJob, AgentJobRequest, AgentJobResult, AgentProvider } from "../types";

export class CursorProvider implements AgentProvider {
  readonly id = "cursor-cloud";

  // Store jobs in memory since this runs locally.
  private jobs: Map<string, { process: ChildProcess, status: "running" | "completed" | "failed", output: string, error: string }> = new Map();

  async startJob(request: AgentJobRequest): Promise<AgentJob> {
    const jobId = randomUUID();
    let cwd = process.cwd();
    if (request.repo.type === "local") {
        cwd = request.repo.path;
    }

    // Spawn the cursor agent in print and json mode
    const cp = spawn("agent", ["--print", "--output-format", "json", request.prompt], { cwd });

    const jobData = {
        process: cp,
        status: "running" as const,
        output: "",
        error: ""
    };

    this.jobs.set(jobId, jobData);

    cp.stdout.on("data", (data) => {
        jobData.output += data.toString();
    });

    cp.stderr.on("data", (data) => {
        jobData.error += data.toString();
    });

    cp.on("close", (code) => {
        jobData.status = code === 0 ? "completed" : "failed";
    });

    return {
      id: jobId,
      provider: this.id,
      status: "running"
    };
  }

  async getJob(jobId: string): Promise<AgentJob> {
    const jobData = this.jobs.get(jobId);
    if (!jobData) {
        throw new Error(`Job ${jobId} not found`);
    }

    return {
      id: jobId,
      provider: this.id,
      status: jobData.status
    };
  }

  async getResult(jobId: string): Promise<AgentJobResult> {
    const jobData = this.jobs.get(jobId);
    if (!jobData) {
        throw new Error(`Job ${jobId} not found`);
    }

    if (jobData.status === "failed") {
        return {
            success: false,
            error: jobData.error || "Agent failed with unknown error"
        };
    }

    // Try parsing the json output
    let patch = jobData.output;
    let summary = "Completed cursor agent task";
    try {
        const parsed = JSON.parse(jobData.output);
        // Depending on Cursor JSON structure, adjust this:
        if (parsed.patch) patch = parsed.patch;
        if (parsed.summary) summary = parsed.summary;
    } catch (e) {
        // Fallback to raw output if json parse fails
    }

    return {
        success: true,
        summary,
        patch
    };
  }
}
