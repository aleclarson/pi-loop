import { JSONRPCClient, type JSONRPCRequest } from "json-rpc-2.0"
import WebSocket from "ws"

import { createClientUrl, type ServerEndpoint } from "./transport"

export interface ClientOptions {
  endpoint: ServerEndpoint
  refreshRateMs?: number
}

export function startClient(options: ClientOptions) {
  const url = createClientUrl(options.endpoint)
  const refreshRateMs = options.refreshRateMs || 100

  const ws = new WebSocket(url)

  const rpcClient = new JSONRPCClient((request: JSONRPCRequest) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(request))
      return Promise.resolve()
    }
    return Promise.reject(new Error("WebSocket is not open"))
  })

  ws.on("message", (data) => {
    rpcClient.receive(JSON.parse(data.toString()))
  })

  ws.on("open", () => {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    process.stdin.on("data", (key: string) => {
      if (key === "\u0003") {
        process.stdout.write("\x1B[2J\x1B[0f")
        process.exit()
      }

      rpcClient.notify("rpc_write_input", { key })
    })

    setInterval(async () => {
      try {
        const screenLines = (await rpcClient.request("rpc_get_screen_state", {})) as string[]
        process.stdout.write("\x1B[2J\x1B[0f")
        process.stdout.write(screenLines.join("\n"))
      } catch {
        // Ignore transient polling errors.
      }
    }, refreshRateMs)
  })

  ws.on("close", () => {
    console.log("Disconnected from server")
    process.exit(0)
  })

  ws.on("error", (error: Error) => {
    console.error("WebSocket error:", error)
    process.exit(1)
  })

  return {
    ws,
    rpcClient,
    close: () => {
      ws.close()
    },
  }
}
