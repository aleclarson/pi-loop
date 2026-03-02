import test from "node:test";
import assert from "node:assert/strict";
import { runCommand } from "../src/index.ts";

test("runCommand returns args and sdk ping", () => {
  assert.deepEqual(runCommand(["deploy"]), {
    args: ["deploy"],
    sdk: "pong:cmd"
  });
});
