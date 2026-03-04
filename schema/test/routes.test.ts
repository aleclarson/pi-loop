import test from "node:test";
import assert from "node:assert/strict";
import {
  authDeviceStartRoute,
  authDeviceCompleteRoute,
  authSessionRoute,
  prCreateRoute,
  githubWebhookRoute,
  repoStreamRoute,
  routePath
} from "../src/index.ts";

test("schema exports rouzer route declarations with stable paths", () => {
  assert.equal(routePath(authDeviceStartRoute), "/auth/device/start");
  assert.equal(routePath(authDeviceCompleteRoute), "/auth/device/complete");
  assert.equal(routePath(authSessionRoute), "/auth/session");
  assert.equal(routePath(prCreateRoute), "/pr/create");
  assert.equal(routePath(githubWebhookRoute), "/webhooks/github");
  assert.equal(routePath(repoStreamRoute), "/stream");
});
