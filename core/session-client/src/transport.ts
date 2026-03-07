export type ServerEndpoint =
  | { kind: "tcp"; port: number; url: string }
  | { kind: "ipc"; socketPath: string; url: string }

export function createClientUrl(endpoint?: ServerEndpoint): string {
  if (!endpoint) {
    throw new Error("A server endpoint is required")
  }

  return endpoint.url
}
