export const SDK_VERSION = "0.1.0";

export type Client = {
  serviceName: string;
  version: string;
  ping: () => string;
};

export function createClient({ serviceName }: { serviceName: string }): Client {
  if (!serviceName || typeof serviceName !== "string") {
    throw new TypeError("serviceName must be a non-empty string");
  }

  return {
    serviceName,
    version: SDK_VERSION,
    ping() {
      return `pong:${serviceName}`;
    }
  };
}
