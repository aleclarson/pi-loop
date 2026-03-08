import { SessionServer } from "./server.js";
import { initDb } from "./db.js";

async function main() {
    await initDb();

    const agentName = process.argv[2];
    if (!agentName) {
        console.error("Usage: goddard-session <agent-name>");
        process.exit(1);
    }

    const server = new SessionServer(agentName);
    await server.listen();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
