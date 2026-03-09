import mri from "mri"
import { SessionServer } from "./server.js"

async function main() {
  const argv = process.argv.slice(2)
  const args = mri(argv, {
    string: ["resume"],
  })

  const agentName = args._[0]
  const resumeId = args.resume

  if (!agentName) {
    console.error("Usage: goddard-session <agent-name> [--resume <id>]")
    process.exit(1)
  }

  const server = new SessionServer(agentName, async (params) => {
    // This allows stdout to forward permission requests back up the pipe
    console.log(JSON.stringify({ type: "permission_request", ...params }))
    return { outcome: { outcome: "cancelled" } }
  })

  if (resumeId) {
    await server.loadSession({ sessionId: resumeId, mcpServers: [], cwd: process.cwd() })
  }

  await server.listen()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
