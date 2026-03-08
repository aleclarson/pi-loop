import { AgentSideConnection, ClientSideConnection, Agent, Client, ndJsonStream } from "@agentclientprotocol/sdk";
import * as schema from "@agentclientprotocol/sdk";
import { db, messages } from "./db.js";
import { fetchRegistryAgent, RegistryAgent } from "./registry.js";
import { spawn, ChildProcess } from "node:child_process";

export class SessionServer implements Agent {
    private sessionId: string | null = null;
    private agentProcess: ChildProcess | null = null;
    private agentConnection: ClientSideConnection | null = null;
    private serverConnection: AgentSideConnection | null = null;

    constructor(private agentName: string) {}

    async initialize(params: schema.InitializeRequest): Promise<schema.InitializeResponse> {
        return {
            protocolVersion: 1
        };
    }

    async newSession(params: schema.NewSessionRequest): Promise<schema.NewSessionResponse> {
        // We will initialize the agent connection right here
        if (!this.agentConnection) {
            const registryAgent = await fetchRegistryAgent(this.agentName);
            if (!registryAgent) {
                throw new Error(`Agent not found: ${this.agentName}`);
            }

            let cmd: string;
            let args: string[];

            if (registryAgent.distribution.type === "npx" && registryAgent.distribution.package) {
                cmd = "npx";
                args = ["-y", registryAgent.distribution.package];
            } else if (registryAgent.distribution.type === "binary" && registryAgent.distribution.cmd) {
                cmd = registryAgent.distribution.cmd;
                args = registryAgent.distribution.args || [];
            } else if (registryAgent.distribution.type === "uvx" && registryAgent.distribution.package) {
                cmd = "uvx";
                args = [registryAgent.distribution.package];
            } else {
                throw new Error("Unsupported agent distribution");
            }

            this.agentProcess = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });

            if (!this.agentProcess.stdout || !this.agentProcess.stdin) {
                throw new Error("Failed to initialize agent stdio streams");
            }

            const writableStream = new WritableStream<Uint8Array>({
                write: (chunk) => {
                    this.agentProcess!.stdin!.write(chunk);
                }
            });

            const readableStream = new ReadableStream<Uint8Array>({
                start: (controller) => {
                    this.agentProcess!.stdout!.on("data", (chunk: Buffer) => controller.enqueue(chunk));
                    this.agentProcess!.stdout!.on("end", () => controller.close());
                    this.agentProcess!.stdout!.on("error", (err) => controller.error(err));
                }
            });

            const stream = ndJsonStream(writableStream, readableStream);

            this.agentConnection = new ClientSideConnection(
                () => new GoddardClient(this.sessionId!, this.serverConnection!),
                stream
            );

            const response = await this.agentConnection.initialize({
                protocolVersion: 1,
                clientInfo: {
                    name: "goddard-session",
                    version: "0.1.0"
                }
            });

            if (response.protocolVersion !== 1) {
                throw new Error(`Invalid protocol version: ${response.protocolVersion}. Only version 1 is supported.`);
            }
        }

        // Pass session creation to agent and record
        const response = await this.agentConnection.newSession(params);
        this.sessionId = response.sessionId;

        // We must update the sessionId in our client instance since it was assigned after creation
        // but for minimal implementation we'll assume GoddardClient uses a function to resolve it,
        // or we simply re-initialize the client.

        return {
            sessionId: this.sessionId
        };
    }

    async authenticate(params: schema.AuthenticateRequest): Promise<schema.AuthenticateResponse> {
        return {};
    }

    async prompt(params: schema.PromptRequest): Promise<schema.PromptResponse> {
        if (!this.sessionId) {
            throw new Error("No active session");
        }

        await db.insert(messages).values({
            sessionId: this.sessionId,
            type: "session/prompt",
            payload: JSON.stringify(params),
            createdAt: new Date()
        });

        if (!this.agentConnection) {
             throw new Error("Agent connection not initialized");
        }

        const response = await this.agentConnection.prompt(params);

        return response;
    }

    async setSessionMode(params: schema.SetSessionModeRequest): Promise<schema.SetSessionModeResponse | void> {
        if (!this.sessionId) return;
        await db.insert(messages).values({
            sessionId: this.sessionId,
            type: "session/set_mode",
            payload: JSON.stringify(params),
            createdAt: new Date()
        });
        if (this.agentConnection?.setSessionMode) {
             return this.agentConnection.setSessionMode(params);
        }
    }

    async setSessionConfigOption(params: schema.SetSessionConfigOptionRequest): Promise<schema.SetSessionConfigOptionResponse> {
        if (!this.sessionId) {
            throw new Error("No active session");
        }
        await db.insert(messages).values({
            sessionId: this.sessionId,
            type: "session/set_config_option",
            payload: JSON.stringify(params),
            createdAt: new Date()
        });
        if (this.agentConnection?.setSessionConfigOption) {
            return this.agentConnection.setSessionConfigOption(params);
        }
        return { configOptions: [] };
    }

    async cancel(params: schema.CancelNotification): Promise<void> {
        if (this.agentConnection) {
            await this.agentConnection.cancel(params);
        }
    }

    async listen() {
        const writableStream = new WritableStream<Uint8Array>({
            write(chunk) {
                process.stdout.write(chunk);
            }
        });

        const readableStream = new ReadableStream<Uint8Array>({
            start(controller) {
                process.stdin.on("data", (chunk: Buffer) => {
                    controller.enqueue(chunk);
                });
                process.stdin.on("end", () => {
                    controller.close();
                });
                process.stdin.on("error", (err) => {
                    controller.error(err);
                });
            }
        });

        const stream = ndJsonStream(writableStream, readableStream);
        this.serverConnection = new AgentSideConnection(() => this, stream);
    }
}

class GoddardClient implements Client {
    constructor(private sessionId: string, private serverConnection: AgentSideConnection) {}

    async requestPermission(params: schema.RequestPermissionRequest): Promise<schema.RequestPermissionResponse> {
        return {
            outcome: { outcome: "cancelled" }
        };
    }

    async sessionUpdate(params: schema.SessionNotification): Promise<void> {
        await db.insert(messages).values({
            sessionId: this.sessionId,
            type: "session/update",
            payload: JSON.stringify(params),
            createdAt: new Date()
        });

        // Proxy the session update up to the connected client
        await this.serverConnection.sessionUpdate(params);
    }
}
