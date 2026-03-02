import test from "node:test";
import assert from "node:assert/strict";
import { createBackendService } from "../src/index.ts";

test("backend health returns ok and sdk ping", () => {
  const service = createBackendService();
  assert.deepEqual(service.health(), { ok: true, sdk: "pong:backend" });
});
