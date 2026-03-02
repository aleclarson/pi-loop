import { createClient } from "@goddard-ai/sdk";

export function createWebhookHandler() {
  const sdk = createClient({ serviceName: "github-app" });

  return function handleWebhook(event?: { name?: string }) {
    return {
      handled: true,
      eventName: event?.name ?? "unknown",
      sdk: sdk.ping()
    };
  };
}
