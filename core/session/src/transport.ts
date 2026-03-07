import { randomUUID } from "node:crypto"
import os from "node:os"
import path from "node:path"

export interface TransportOptions {
  transport?: "tcp" | "ipc"
  port?: number
  socketPath?: string
}

export type ServerListenTarget =
  | { kind: "tcp"; value: number; display: string }
  | { kind: "ipc"; value: string; display: string }

export type ServerEndpoint =
  | { kind: "tcp"; port: number; url: string }
  | { kind: "ipc"; socketPath: string; url: string }

export function getDefaultIpcDirectory(platform = process.platform): string {
  if (platform === "win32") {
    return "\\\\.\\pipe"
  }

  return os.tmpdir()
}

export function createRandomSocketPath(platform = process.platform): string {
  const id = randomUUID()

  if (platform === "win32") {
    return `\\\\.\\pipe\\goddard-session-${id}`
  }

  return path.join(getDefaultIpcDirectory(platform), `goddard-session-${id}.sock`)
}

export function resolveServerListenTarget(options: TransportOptions = {}): ServerListenTarget {
  if (options.socketPath) {
    return {
      kind: "ipc",
      value: options.socketPath,
      display: `ws+unix://${options.socketPath}`,
    }
  }

  if (options.transport === "ipc") {
    const socketPath = createRandomSocketPath()
    return {
      kind: "ipc",
      value: socketPath,
      display: `ws+unix://${socketPath}`,
    }
  }

  return {
    kind: "tcp",
    value: options.port ?? 0,
    display: `ws://localhost:${options.port ?? 0}`,
  }
}

export function createServerEndpoint(listenTarget: ServerListenTarget, address: string | null): ServerEndpoint {
  if (listenTarget.kind === "ipc") {
    return {
      kind: "ipc",
      socketPath: listenTarget.value,
      url: `ws+unix://${listenTarget.value}`,
    }
  }

  if (!address) {
    throw new Error("A bound TCP address is required to create a server endpoint")
  }

  return {
    kind: "tcp",
    port: Number(address),
    url: `ws://localhost:${address}`,
  }
}
