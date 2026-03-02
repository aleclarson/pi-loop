import test from "node:test";
import assert from "node:assert/strict";
import { createWebhookHandler } from "../src/index.ts";

test("webhook handler returns handled payload", () => {
  const handleWebhook = createWebhookHandler();
  assert.deepEqual(handleWebhook({ name: "push" }), {
    handled: true,
    eventName: "push",
    sdk: "pong:github-app"
  });
});
