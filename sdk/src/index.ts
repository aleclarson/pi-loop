import {
  apiRoutes,
  authDeviceCompleteRoute,
  authDeviceStartRoute,
  authSessionRoute,
  prCreateRoute,
  repoStreamRoute,
  type AuthSession,
  type CreatePrInput,
  type DeviceFlowComplete,
  type DeviceFlowSession,
  type DeviceFlowStart,
  type GitHubWebhookInput,
  type PiAgentConfig,
  type PullRequestRecord,
  type RepoEvent,
  type RepoRef,
  type StreamMessage,
  type ThinkingLevel
} from "@goddard-ai/schema";
import { createClient, type RouteRequest } from "rouzer";
import { InMemoryTokenStorage, type TokenStorage } from "./token-storage.ts";
import { appendSpecInstructions } from "./agents.ts";

export const SDK_VERSION = "0.1.0";

type FetchLike = typeof fetch;
type WebSocketCtor = typeof WebSocket;
type RouzerHttpClient = ReturnType<typeof createClient<typeof apiRoutes>>;

export type GoddardSdkOptions = {
  baseUrl: string;
  tokenStorage?: TokenStorage;
  fetchImpl?: FetchLike;
  webSocketImpl?: WebSocketCtor;
};

type StreamHandler = (event?: unknown) => void;

export class StreamSubscription {
  #socket: WebSocket;
  #listeners = new Map<string, Set<StreamHandler>>();

  constructor(socket: WebSocket) {
    this.#socket = socket;
  }

  on(eventName: string, handler: StreamHandler): this {
    const listeners = this.#listeners.get(eventName) ?? new Set<StreamHandler>();
    listeners.add(handler);
    this.#listeners.set(eventName, listeners);
    return this;
  }

  off(eventName: string, handler: StreamHandler): this {
    this.#listeners.get(eventName)?.delete(handler);
    return this;
  }

  emit(eventName: string, payload?: unknown): void {
    this.#listeners.get(eventName)?.forEach((listener) => listener(payload));
  }

  close(): void {
    this.#socket.close();
  }
}

export class GoddardSdk {
  readonly auth: {
    startDeviceFlow: (input?: DeviceFlowStart) => Promise<DeviceFlowSession>;
    completeDeviceFlow: (input: DeviceFlowComplete) => Promise<AuthSession>;
    whoami: () => Promise<AuthSession>;
    logout: () => Promise<void>;
  };

  readonly pr: {
    create: (input: CreatePrInput) => Promise<PullRequestRecord>;
  };

  readonly stream: {
    subscribeToRepo: (repo: RepoRef) => Promise<StreamSubscription>;
  };

  readonly agents: {
    appendSpecInstructions: (cwd?: string) => Promise<string>;
  };

  readonly #baseUrl: URL;
  readonly #tokenStorage: TokenStorage;
  readonly #fetchImpl: FetchLike;
  readonly #webSocketImpl: WebSocketCtor;
  readonly #rouzerClient: RouzerHttpClient;

  constructor(options: GoddardSdkOptions) {
    this.#baseUrl = new URL(options.baseUrl);
    this.#tokenStorage = options.tokenStorage ?? new InMemoryTokenStorage();
    this.#fetchImpl = options.fetchImpl ?? fetch;
    this.#webSocketImpl = options.webSocketImpl ?? WebSocket;
    this.#rouzerClient = createClient({
      baseURL: this.#baseUrl.toString(),
      fetch: this.#fetchImpl,
      routes: apiRoutes
    });

    this.auth = {
      startDeviceFlow: async (input = {}) => {
        return this.#sendJson<DeviceFlowSession>(
          this.#rouzerClient.request(authDeviceStartRoute.POST({ body: input }))
        );
      },
      completeDeviceFlow: async (input) => {
        const session = await this.#sendJson<AuthSession>(
          this.#rouzerClient.request(authDeviceCompleteRoute.POST({ body: input }))
        );
        await this.#tokenStorage.setToken(session.token);
        return session;
      },
      whoami: async () => {
        const token = await this.#requireToken();
        return this.#sendJson<AuthSession>(
          this.#rouzerClient.request(authSessionRoute.GET({ headers: { authorization: `Bearer ${token}` } }))
        );
      },
      logout: async () => {
        await this.#tokenStorage.clearToken();
      }
    };

    this.pr = {
      create: async (input) => {
        const token = await this.#requireToken();
        return this.#sendJson<PullRequestRecord>(
          this.#rouzerClient.request(
            prCreateRoute.POST({
              headers: { authorization: `Bearer ${token}` },
              body: input
            })
          )
        );
      }
    };

    this.stream = {
      subscribeToRepo: async ({ owner, repo }) => {
        const token = await this.#tokenStorage.getToken();
        if (!token) {
          throw new Error("Not authenticated. Run login first.");
        }

        const streamRequest = repoStreamRoute.GET({
          query: {
            owner,
            repo,
            token
          }
        });
        const streamUrl = buildRouteUrl(this.#baseUrl, streamRequest);

        const socket = new this.#webSocketImpl(streamUrl);
        const subscription = new StreamSubscription(socket);

        socket.addEventListener("open", () => subscription.emit("open"));
        socket.addEventListener("close", () => subscription.emit("close"));
        socket.addEventListener("error", (error) => subscription.emit("error", error));
        socket.addEventListener("message", (event) => {
          try {
            const parsed = JSON.parse(String(event.data)) as StreamMessage;
            subscription.emit("event", parsed.event);
            subscription.emit(parsed.event.type, parsed.event);
          } catch (error) {
            subscription.emit("error", new Error(`Invalid stream payload: ${String(error)}`));
          }
        });

        await waitForSocketOpen(socket);
        return subscription;
      }
    };

    this.agents = {
      appendSpecInstructions: async (cwd) => {
        return appendSpecInstructions(cwd);
      }
    };
  }

  async #sendJson<T>(responsePromise: Promise<Response>): Promise<T> {
    const response = await responsePromise;

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Request failed (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as T;
  }

  async #requireToken(): Promise<string> {
    const token = await this.#tokenStorage.getToken();
    if (!token) {
      throw new Error("Not authenticated. Run login first.");
    }

    return token;
  }
}

function buildRouteUrl(baseUrl: URL, request: RouteRequest): URL {
  const pathname = request.path.href(request.args.path as Record<string, string> | undefined);
  const url = new URL(pathname, baseUrl);
  const query = request.args.query as Record<string, unknown> | undefined;

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

async function waitForSocketOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
    };

    socket.addEventListener("open", onOpen, { once: true });
    socket.addEventListener("error", onError, { once: true });
  });
}

export function createSdk(options: GoddardSdkOptions): GoddardSdk {
  return new GoddardSdk(options);
}

export type {
  AuthSession,
  CreatePrInput,
  DeviceFlowComplete,
  DeviceFlowSession,
  DeviceFlowStart,
  PiAgentConfig,
  PullRequestRecord,
  RepoEvent,
  RepoRef,
  ThinkingLevel,
  TokenStorage,
  GitHubWebhookInput
};
export { InMemoryTokenStorage };
export { LOOP_SYSTEM_PROMPT, SPEC_SYSTEM_PROMPT, PROPOSE_SYSTEM_PROMPT } from "./prompts.ts";
