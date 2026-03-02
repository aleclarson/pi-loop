import test from "node:test";
import assert from "node:assert/strict";
import { createClient, SDK_VERSION } from "../src/index.ts";

test("createClient creates a client with ping", () => {
  const client = createClient({ serviceName: "demo" });
  assert.equal(client.version, SDK_VERSION);
  assert.equal(client.ping(), "pong:demo");
});

test("createClient validates serviceName", () => {
  assert.throws(() => createClient({ serviceName: "" }), /serviceName/);
});
