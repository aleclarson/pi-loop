import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rpcClientPath = path.resolve(__dirname, "../../node_modules/@mariozechner/pi-coding-agent/dist/modes/rpc/rpc-client.js")

const { RpcClient } = await import(rpcClientPath)

import type { SessionDriver, SessionDriverContext, SessionDriverInput } from "./types.ts"

export const driver: SessionDriver = {
  name: "pi-rpc" as any,
  run: async (input: SessionDriverInput, context: SessionDriverContext) => {
    // Custom RPC client that spawns via 'pi' command directly instead of 'node <cliPath>'
    const ExternalRpcClient: any = class extends (RpcClient as any) {
      async start() {
        const args = ["--mode", "rpc", ...(this.options.args || [])]
        this.process = spawn("pi", args, {
          cwd: this.options.cwd,
          env: { ...process.env, ...this.options.env },
          stdio: ["pipe", "pipe", "pipe"],
        })

        this.process.stdout.on("data", (data: Buffer) => {
          const lines = data.toString().split("\n")
          for (const line of lines) {
            if (line.trim()) {
              this.handleLine(line)
            }
          }
        })

        this.process.stderr.on("data", (data: Buffer) => {
          this.stderr += data.toString()
        })

        return new Promise<void>((resolve, reject) => {
          const onStart = (event: any) => {
            if (event.type === "agent_start") {
              this.eventListeners.delete(onStart)
              resolve()
            }
          }
          this.onEvent(onStart)
          
          this.process.on("error", reject)
          this.process.on("exit", (code: number) => {
            if (code !== 0 && code !== null) {
              reject(new Error(`Agent process exited with code ${code}. Stderr: ${this.stderr}`))
            }
          })
        })
      }

      async stop() {
        if (this.process) {
          this.process.kill()
        }
      }
    }

    const client = new ExternalRpcClient({
      cwd: context.cwd,
      args: input.resume ? ["--session", input.resume] : ["--no-session"],
    })

    await client.start()

    try {
      if (input.initialPrompt) {
        client.onEvent((event: any) => {
          if (
            event.type === "message_update" &&
            event.assistantMessageEvent?.type === "text_delta"
          ) {
            context.stdout.write(event.assistantMessageEvent.delta)
          }
        })

        await client.prompt(input.initialPrompt)
        await client.waitForIdle()
        context.stdout.write("\n")
      }

      return 0
    } finally {
      await client.stop()
    }
  },
}
