import { randomUUID } from "node:crypto";
import { createServer as createNodeServer } from "@hattip/adapter-node";
import {
  AuthSession,
  CreatePrInput,
  DeviceFlowComplete,
  DeviceFlowSession,
  DeviceFlowStart,
  GitHubWebhookInput,
  PullRequestRecord,
  RepoEvent,
  authDeviceCompleteRoute,
  authDeviceStartRoute,
  authSessionRoute,
  githubWebhookRoute,
  prCreateRoute,
  repoStreamRoute,
  routePath
} from "@goddard-ai/schema";
import { WebSocketServer, type WebSocket } from "ws";
import { type BackendControlPlane, HttpError, assertRepo } from "./control-plane.ts";

type SessionRecord = AuthSession & { expiresAt: number };
type DeviceSessionRecord = { githubUsername: string; createdAt: number; expiresAt: number };

const DEVICE_FLOW_EXPIRES_IN_SECONDS = 900;
const DEVICE_FLOW_INTERVAL_SECONDS = 5;
const AUTH_SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_JSON_BODY_BYTES = 1024 * 1024;

const AUTH_DEVICE_START_PATH = routePath(authDeviceStartRoute);
const AUTH_DEVICE_COMPLETE_PATH = routePath(authDeviceCompleteRoute);
const AUTH_SESSION_PATH = routePath(authSessionRoute);
const PR_CREATE_PATH = routePath(prCreateRoute);
const GITHUB_WEBHOOK_PATH = routePath(githubWebhookRoute);
const REPO_STREAM_PATH = routePath(repoStreamRoute);

type StartServerOptions = {
  port?: number;
  host?: string;
};

export type BackendServer = {
  port: number;
  close: () => Promise<void>;
};

export class InMemoryBackendControlPlane implements BackendControlPlane {
  #deviceSessions = new Map<string, DeviceSessionRecord>();
  #authSessions = new Map<string, SessionRecord>();
  #pullRequests: PullRequestRecord[] = [];
  #streamsByRepo = new Map<string, Set<WebSocket>>();
  #nextPrId = 1;

  startDeviceFlow(input: DeviceFlowStart = {}): DeviceFlowSession {
    const githubUsername = input.githubUsername?.trim() || "developer";
    const deviceCode = `dev_${randomUUID()}`;
    const userCode = randomUUID().slice(0, 8).toUpperCase();
    const createdAt = Date.now();

    this.#deviceSessions.set(deviceCode, {
      githubUsername,
      createdAt,
      expiresAt: createdAt + DEVICE_FLOW_EXPIRES_IN_SECONDS * 1000
    });

    return {
      deviceCode,
      userCode,
      verificationUri: "https://github.com/login/device",
      expiresIn: DEVICE_FLOW_EXPIRES_IN_SECONDS,
      interval: DEVICE_FLOW_INTERVAL_SECONDS
    };
  }

  completeDeviceFlow(input: DeviceFlowComplete): AuthSession {
    const pending = this.#deviceSessions.get(input.deviceCode);
    if (!pending) {
      throw new HttpError(404, "Unknown device code");
    }

    if (pending.expiresAt <= Date.now()) {
      this.#deviceSessions.delete(input.deviceCode);
      throw new HttpError(410, "Device code expired");
    }

    const githubUsername = input.githubUsername.trim();
    if (!githubUsername) {
      throw new HttpError(400, "githubUsername is required");
    }

    const expiresAt = Date.now() + AUTH_SESSION_TTL_MS;
    const session: SessionRecord = {
      token: `tok_${randomUUID()}`,
      githubUsername,
      githubUserId: hashToInteger(githubUsername),
      expiresAt
    };

    this.#authSessions.set(session.token, session);
    this.#deviceSessions.delete(input.deviceCode);

    return toPublicSession(session);
  }

  getSession(token: string): AuthSession {
    const session = this.#authSessions.get(token);
    if (!session) {
      throw new HttpError(401, "Invalid token");
    }

    if (session.expiresAt <= Date.now()) {
      this.#authSessions.delete(token);
      throw new HttpError(401, "Session expired");
    }

    return toPublicSession(session);
  }

  createPr(token: string, input: CreatePrInput): PullRequestRecord {
    const session = this.getSession(token);
    assertRepo(input.owner, input.repo);
    if (!input.title.trim()) {
      throw new HttpError(400, "title is required");
    }

    const prNumber = this.#pullRequests.length + 1;
    const body = `${input.body?.trim() ?? ""}\n\nAuthored via CLI by @${session.githubUsername}`.trim();

    const record: PullRequestRecord = {
      id: this.#nextPrId++,
      number: prNumber,
      owner: input.owner,
      repo: input.repo,
      title: input.title,
      body,
      head: input.head,
      base: input.base,
      url: `https://github.com/${input.owner}/${input.repo}/pull/${prNumber}`,
      createdBy: session.githubUsername,
      createdAt: new Date().toISOString()
    };

    this.#pullRequests.push(record);

    this.broadcast({
      type: "pr.created",
      owner: input.owner,
      repo: input.repo,
      prNumber: record.number,
      title: record.title,
      author: session.githubUsername,
      createdAt: record.createdAt
    });

    return record;
  }

  handleGitHubWebhook(event: GitHubWebhookInput): RepoEvent {
    assertRepo(event.owner, event.repo);

    const createdAt = new Date().toISOString();
    const mapped: RepoEvent =
      event.type === "issue_comment"
        ? {
            type: "comment",
            owner: event.owner,
            repo: event.repo,
            prNumber: event.prNumber,
            author: event.author,
            body: event.body,
            reactionAdded: "eyes",
            createdAt
          }
        : {
            type: "review",
            owner: event.owner,
            repo: event.repo,
            prNumber: event.prNumber,
            author: event.author,
            state: event.state,
            body: event.body,
            reactionAdded: "eyes",
            createdAt
          };

    this.broadcast(mapped);
    return mapped;
  }

  addStreamSocket(repoKey: string, socket: WebSocket): void {
    const room = this.#streamsByRepo.get(repoKey) ?? new Set<WebSocket>();
    room.add(socket);
    this.#streamsByRepo.set(repoKey, room);
  }

  removeStreamSocket(repoKey: string, socket: WebSocket): void {
    const room = this.#streamsByRepo.get(repoKey);
    room?.delete(socket);
    if (room && room.size === 0) {
      this.#streamsByRepo.delete(repoKey);
    }
  }

  broadcast(event: RepoEvent): void {
    const repoKey = `${event.owner}/${event.repo}`;
    const sockets = this.#streamsByRepo.get(repoKey);
    if (!sockets) {
      return;
    }

    const payload = JSON.stringify({ event });
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  }
}

export async function startBackendServer(
  controlPlane: BackendControlPlane = new InMemoryBackendControlPlane(),
  options: StartServerOptions = {}
): Promise<BackendServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;

  const httpServer = createNodeServer(async ({ request }) => {
    try {
      return await handleHttpRequest(controlPlane, request);
    } catch (error) {
      return handleHttpError(error);
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (requestUrl.pathname !== REPO_STREAM_PATH) {
      socket.destroy();
      return;
    }

    try {
      const streamRequest = repoStreamRoute.GET({
        query: {
          owner: requestUrl.searchParams.get("owner") ?? "",
          repo: requestUrl.searchParams.get("repo") ?? "",
          token: requestUrl.searchParams.get("token") ?? ""
        }
      });

      const { owner, repo, token } = streamRequest.args.query;
      assertRepo(owner, repo);
      controlPlane.getSession(token);

      const repoKey = `${owner}/${repo}`;

      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        controlPlane.addStreamSocket?.(repoKey, ws);
        ws.on("close", () => controlPlane.removeStreamSocket?.(repoKey, ws));
      });
    } catch {
      socket.destroy();
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, () => resolve()));

  return {
    port: Number((httpServer.address() as { port: number }).port),
    close: async () => {
      for (const client of wss.clients) {
        client.close();
      }
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

async function handleHttpRequest(controlPlane: BackendControlPlane, request: Request): Promise<Response> {
  const method = request.method;
  const requestUrl = new URL(request.url);

  try {
    if (method === "POST" && requestUrl.pathname === AUTH_DEVICE_START_PATH) {
      const body = await readJson<any>(request);
      const parsed = authDeviceStartRoute.POST({ body }).args.body;
      return Response.json(await controlPlane.startDeviceFlow(parsed));
    }

    if (method === "POST" && requestUrl.pathname === AUTH_DEVICE_COMPLETE_PATH) {
      const body = await readJson<any>(request);
      const parsed = authDeviceCompleteRoute.POST({ body }).args.body;
      return Response.json(await controlPlane.completeDeviceFlow(parsed));
    }

    if (method === "GET" && requestUrl.pathname === AUTH_SESSION_PATH) {
      const token = readBearerToken(request.headers.get("authorization"));
      authSessionRoute.GET({ headers: { authorization: `Bearer ${token}` } });
      return Response.json(await controlPlane.getSession(token));
    }

    if (method === "POST" && requestUrl.pathname === PR_CREATE_PATH) {
      const token = readBearerToken(request.headers.get("authorization"));
      const body = await readJson<any>(request);
      const parsed = prCreateRoute.POST({
        headers: { authorization: `Bearer ${token}` },
        body
      }).args.body;
      return Response.json(await controlPlane.createPr(token, parsed));
    }

    if (method === "POST" && requestUrl.pathname === GITHUB_WEBHOOK_PATH) {
      const body = await readJson<any>(request);
      const parsed = githubWebhookRoute.POST({ body }).args.body;
      return Response.json(await controlPlane.handleGitHubWebhook(parsed));
    }
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      throw new HttpError(400, "Invalid JSON body format");
    }
    throw error;
  }

  throw new HttpError(404, "Not found");
}

async function readJson<T>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "Request body too large");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "Request body too large");
  }

  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function readBearerToken(header: string | null): string {
  if (!header || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Bearer token");
  }
  return header.slice("Bearer ".length);
}

function handleHttpError(error: unknown): Response {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : "Unknown error";
  return Response.json({ error: message }, { status: statusCode });
}

function toPublicSession(session: SessionRecord): AuthSession {
  return {
    token: session.token,
    githubUsername: session.githubUsername,
    githubUserId: session.githubUserId
  };
}

function hashToInteger(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1000;
}
