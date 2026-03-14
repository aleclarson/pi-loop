import { createSdk, type RepoEvent } from "@goddard-ai/sdk"
import { FileTokenStorage } from "@goddard-ai/storage"
import { buildPrompt, isFeedbackEvent } from "./feedback.ts"
import { runOneShot } from "./one-shot.ts"
import { splitRepo } from "./utils.ts"

export type RunDaemonInput = {
  repo: string
  projectDir: string
  baseUrl: string
}

export async function runDaemon(input: RunDaemonInput): Promise<number> {
  const baseUrl = input.baseUrl || process.env.GODDARD_BASE_URL || "http://127.0.0.1:8787"
  const sdk = createSdk({ baseUrl, tokenStorage: new FileTokenStorage() })

  try {
    const { owner, repo } = splitRepo(input.repo)
    const runningPrs = new Set<number>()
    const subscription = await sdk.stream.subscribeToRepo({ owner, repo })

    stdout(`Daemon subscribed to ${owner}/${repo}. Waiting for PR feedback events...`)

    subscription.on("event", async (payload) => {
      const event = payload as RepoEvent
      if (!isFeedbackEvent(event)) {
        return
      }

      const prompt = buildPrompt(event)

      if (runningPrs.has(event.prNumber)) {
        stdout(
          `Feedback received for PR #${event.prNumber}, but a session is already running. Ignoring for now.`,
        )
        return
      }

      runningPrs.add(event.prNumber)

      try {
        const managed = await sdk.pr.isManaged({
          owner: event.owner,
          repo: event.repo,
          prNumber: event.prNumber,
        })
        if (!managed) {
          stdout(`Ignoring ${event.type} on unmanaged PR #${event.prNumber}.`)
          return
        }

        stdout(`Launching one-shot pi session for ${event.type} on PR #${event.prNumber}...`)
        const exitCode = await runOneShot({
          event,
          prompt,
          projectDir: input.projectDir,
        })
        stdout(`One-shot pi session finished for PR #${event.prNumber} (exit ${exitCode}).`)
      } catch (error) {
        stderr(error instanceof Error ? error.message : String(error))
      } finally {
        runningPrs.delete(event.prNumber)
      }
    })

    await waitForShutdown(() => subscription.close())
    return 0
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error))
    return 1
  }
}

export async function waitForShutdown(close: () => void): Promise<void> {
  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => {
      close()
      resolve()
    })
  })
}

function stdout(line: string): void {
  process.stdout.write(`${line}\n`)
}

function stderr(line: string): void {
  process.stderr.write(`${line}\n`)
}
