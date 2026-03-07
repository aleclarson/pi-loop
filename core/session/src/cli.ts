import { command, option, restPositionals, runSafely, string, subcommands } from "cmd-ts"

import { loadEmbeddedDriver } from "./drivers/registry.ts"
import type { SessionDriverName } from "./drivers/types.ts"

function mergePrompt(parts: string[]): string | undefined {
  const prompt = parts.join(" ").trim()
  return prompt.length > 0 ? prompt : undefined
}

async function runDriver(
  name: SessionDriverName,
  args: { resume?: string; prompt: string[]; argv?: string[] },
) {
  const driver = await loadEmbeddedDriver(name)
  if (!driver.run) {
    throw new Error(`Driver "${name}" does not support CLI mode`)
  }

  return await driver.run(
    {
      resume: args.resume,
      initialPrompt: mergePrompt(args.prompt),
      argv: args.argv,
    },
    {
      cwd: process.cwd(),
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
    },
  )
}

function promptArgs() {
  return {
    prompt: restPositionals({
      type: string,
      displayName: "prompt",
    }),
  }
}

function resumeArg() {
  return {
    resume: option({
      type: string,
      long: "resume",
      short: "r",
      defaultValue: () => "",
    }),
  }
}

export async function runSessionCli(argv: string[]): Promise<number> {
  const piCmd = command({
    name: "pi",
    args: {
      ...resumeArg(),
      ...promptArgs(),
    },
    handler: async (args) => {
      return await runDriver("pi", { resume: args.resume || undefined, prompt: args.prompt })
    },
  })

  const geminiCmd = command({
    name: "gemini",
    args: {
      ...resumeArg(),
      ...promptArgs(),
    },
    handler: async (args) => {
      return await runDriver("gemini", { resume: args.resume || undefined, prompt: args.prompt })
    },
  })

  const codexCmd = command({
    name: "codex",
    args: {
      ...resumeArg(),
      ...promptArgs(),
    },
    handler: async (args) => {
      return await runDriver("codex", { resume: args.resume || undefined, prompt: args.prompt })
    },
  })

  const ptyCmd = command({
    name: "pty",
    args: {
      argv: restPositionals({ type: string, displayName: "argv" }),
    },
    handler: async (args) => {
      return await runDriver("pty", { prompt: [], argv: args.argv })
    },
  })

  const piRpcCmd = command({
    name: "pi-rpc",
    args: {
      ...resumeArg(),
      ...promptArgs(),
    },
    handler: async (args) => {
      return await runDriver("pi-rpc", { resume: args.resume || undefined, prompt: args.prompt })
    },
  })

  const app = subcommands({
    name: "session",
    cmds: {
      pi: piCmd,
      "pi-rpc": piRpcCmd,
      gemini: geminiCmd,
      codex: codexCmd,
      pty: ptyCmd,
    },
  })

  const result = await runSafely(app, argv)
  if (result._tag === "error") {
    const error = (result as any).error
    process.stderr.write(`${error?.message || "Unknown error"}\n`)
    return error?.config?.exitCode || 1
  }

  const value = (result as any).value

  if (typeof value === "number") {
    return value
  }

  if (value && typeof (value as { value?: number }).value === "number") {
    return (value as { value: number }).value
  }

  return 0
}
