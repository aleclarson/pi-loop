import { createClient } from "@goddard-ai/sdk";

export function createBackendService() {
  const sdk = createClient({ serviceName: "backend" });

  return {
    health() {
      return {
        ok: true,
        sdk: sdk.ping()
      };
    }
  };
}
