```ts
import { spawn } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import * as fs from "node:fs/promises";

class MyClient implements acp.Client {
  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    console.log(`\n🔐 Permission requested for tool: ${params.toolCall.title}`);

    // In this simple client, we auto-approve the first suggested option.
    // In a production client, you would present these to the user.
    if (params.options.length > 0) {
      const firstOption = params.options[0];
      console.log(
        `   Automatically selecting: ${firstOption.name} (${firstOption.kind})`,
      );
      return {
        outcome: {
          outcome: "selected",
          optionId: firstOption.optionId,
        },
      };
    }

    return {
      outcome: {
        outcome: "cancelled",
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;
    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        if (update.content.type === "text") {
          process.stdout.write(update.content.text);
        }
        break;
      case "tool_call":
        console.log(
          `\n🔧 [Tool Call] ${update.title} - status: ${update.status}`,
        );
        break;
      case "agent_thought_chunk":
        // Optionally handle thoughts/reasoning
        break;
      default:
        // Handle other update types if needed
        break;
    }
  }

  async readTextFile(
    params: acp.ReadTextFileRequest,
  ): Promise<acp.ReadTextFileResponse> {
    try {
      const content = await fs.readFile(params.path, "utf-8");
      return { content };
    } catch (error) {
      console.error(`Error reading file ${params.path}:`, error);
      throw error;
    }
  }

  async writeTextFile(
    params: acp.WriteTextFileRequest,
  ): Promise<acp.WriteTextFileResponse> {
    try {
      await fs.writeFile(params.path, params.content, "utf-8");
      return {};
    } catch (error) {
      console.error(`Error writing file ${params.path}:`, error);
      throw error;
    }
  }
}

async function main() {
  console.log("Starting gemini --experimental-acp...");

  // Spawn the agent process
  const agentProcess = spawn("gemini", ["--experimental-acp"], {
    stdio: ["pipe", "pipe", "inherit"],
  });

  // Create web-compatible streams from the process's stdio
  const input = Writable.toWeb(agentProcess.stdin!);
  const output = Readable.toWeb(agentProcess.stdout!);

  // Create the NDJSON stream for ACP communication
  const stream = acp.ndJsonStream(input, output);

  // Initialize the client implementation
  const clientImpl = new MyClient();

  // Create the ACP connection
  const connection = new acp.ClientSideConnection(
    (_agent) => clientImpl,
    stream,
  );

  try {
    // Step 1: Initialize connection and negotiate capabilities
    const initResult = await connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
    });

    console.log(`✅ Connected to Gemini ACP (v${initResult.protocolVersion})`);

    // Step 2: Create a new session
    const sessionResult = await connection.newSession({
      cwd: process.cwd(),
      mcpServers: [],
    });

    console.log(`📝 Session created: ${sessionResult.sessionId}`);

    // Step 3: Send a prompt
    const promptText =
      process.argv.slice(2).join(" ") ||
      "Hello! Can you list the files in the current directory?";
    console.log(`💬 User: ${promptText}\n`);

    const promptResult = await connection.prompt({
      sessionId: sessionResult.sessionId,
      prompt: [
        {
          type: "text",
          text: promptText,
        },
      ],
    });

    console.log(
      `\n\n✅ Turn finished. Stop reason: ${promptResult.stopReason}`,
    );
  } catch (error) {
    console.error("❌ ACP Error:", error);
  } finally {
    // Clean up
    agentProcess.kill();
    process.exit(0);
  }
}

main().catch(console.error);
```
