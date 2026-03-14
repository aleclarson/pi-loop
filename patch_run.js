const fs = require('fs');

let content = fs.readFileSync('core/loop/src/index.ts', 'utf8');

content = content.replace(
    /import type \{ CycleStrategy \} from "@goddard-ai\/config";/,
    `import type { AgentLoopParams, LoopStrategy } from "@goddard-ai/schema/loop";`
);

content = content.replace(
    /export async function runAgentLoop\([\s\S]*?handler\?: acp.Client\n\): Promise<AgentSession> \{/,
    `export async function runAgentLoop(\n  { session: sessionParams, strategy, rateLimits }: AgentLoopParams,\n  handler?: acp.Client\n): Promise<AgentSession> {`
);

content = content.replace(
    /export type \{ CycleContext, CycleStrategy, GoddardLoopConfig, PiAgentConfig \} from "\.\/types\.ts";/,
    `export type { GoddardLoopConfig, PiAgentConfig } from "./types.ts";\nexport type { LoopContext, LoopStrategy } from "@goddard-ai/schema/loop";`
);

fs.writeFileSync('core/loop/src/index.ts', content);
