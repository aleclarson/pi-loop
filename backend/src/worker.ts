import { createClient } from "@libsql/client/web";
import { TursoBackendControlPlane } from "./persistence.ts";
import { HttpError, assertRepo } from "./control-plane.ts";
import {
  authDeviceCompleteRoute,
  authDeviceStartRoute,
  authSessionRoute,
  githubWebhookRoute,
  prCreateRoute,
  repoStreamRoute,
  routePath
} from "@goddard-ai/schema";
import { RepoStream } from "./objects/RepoStream.ts";

export { RepoStream };

export interface Env {
  TURSO_DB_URL: string;
  TURSO_DB_AUTH_TOKEN: string;
  REPO_STREAM: DurableObjectNamespace;
}

const AUTH_DEVICE_START_PATH = routePath(authDeviceStartRoute);
const AUTH_DEVICE_COMPLETE_PATH = routePath(authDeviceCompleteRoute);
const AUTH_SESSION_PATH = routePath(authSessionRoute);
const PR_CREATE_PATH = routePath(prCreateRoute);
const GITHUB_WEBHOOK_PATH = routePath(githubWebhookRoute);
const REPO_STREAM_PATH = routePath(repoStreamRoute);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    const client = createClient({
      url: env.TURSO_DB_URL,
      authToken: env.TURSO_DB_AUTH_TOKEN
    });
    const controlPlane = new TursoBackendControlPlane(client as any);

    try {
      if (method === "POST" && url.pathname === AUTH_DEVICE_START_PATH) {
        const body = authDeviceStartRoute.POST({ body: await request.json() }).args.body;
        return writeJson(200, await controlPlane.startDeviceFlow(body));
      }

      if (method === "POST" && url.pathname === AUTH_DEVICE_COMPLETE_PATH) {
        const body = authDeviceCompleteRoute.POST({ body: await request.json() }).args.body;
        return writeJson(200, await controlPlane.completeDeviceFlow(body));
      }

      if (method === "GET" && url.pathname === AUTH_SESSION_PATH) {
        const token = readBearerToken(request);
        authSessionRoute.GET({ headers: { authorization: `Bearer ${token}` } });
        return writeJson(200, await controlPlane.getSession(token));
      }

      if (method === "POST" && url.pathname === PR_CREATE_PATH) {
        const token = readBearerToken(request);
        const body = prCreateRoute.POST({
          headers: { authorization: `Bearer ${token}` },
          body: await request.json()
        }).args.body;
        const pr = await controlPlane.createPr(token, body);

        // Broadcast to Durable Object
        await broadcastToRepo(env, pr.owner, pr.repo, {
          type: "pr.created",
          owner: pr.owner,
          repo: pr.repo,
          prNumber: pr.number,
          title: pr.title,
          author: pr.createdBy,
          createdAt: pr.createdAt
        });

        return writeJson(200, pr);
      }

      if (method === "POST" && url.pathname === GITHUB_WEBHOOK_PATH) {
        const body = githubWebhookRoute.POST({ body: await request.json() }).args.body;
        const event = await controlPlane.handleGitHubWebhook(body);

        // Broadcast to Durable Object
        await broadcastToRepo(env, event.owner, event.repo, event);

        return writeJson(200, event);
      }

      if (url.pathname === REPO_STREAM_PATH) {
        const streamRequest = repoStreamRoute.GET({
          query: {
            owner: url.searchParams.get("owner") ?? "",
            repo: url.searchParams.get("repo") ?? "",
            token: url.searchParams.get("token") ?? ""
          }
        });
        const { owner, repo, token } = streamRequest.args.query;

        assertRepo(owner, repo);
        await controlPlane.getSession(token);

        const id = env.REPO_STREAM.idFromName(`${owner}/${repo}`);
        const obj = env.REPO_STREAM.get(id);

        return obj.fetch(request);
      }

      return writeJson(404, { error: "Not found" });
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      return writeJson(statusCode, { error: message });
    }
  }
};

async function broadcastToRepo(env: Env, owner: string, repo: string, event: any) {
  const id = env.REPO_STREAM.idFromName(`${owner}/${repo}`);
  const obj = env.REPO_STREAM.get(id);
  // We'll need a way to send the event to the Durable Object.
  // One way is to have a special /internal/broadcast route in the DO.
  await obj.fetch(new Request("https://internal/broadcast", {
    method: "POST",
    body: JSON.stringify(event)
  }));
}

function writeJson(status: number, payload: any): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function readBearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing Bearer token");
  }
  return header.slice("Bearer ".length);
}
