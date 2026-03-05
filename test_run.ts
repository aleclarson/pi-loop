import { runCli } from "./cmd/src/index.ts";

async function run() {
  const code = await runCli(["loop", "run"], { stdout: console.log, stderr: console.error }, {
    createLoopRuntime: () => ({
      start: async () => {
        console.log("STARTED");
      }
    })
  });
  console.log("CODE", code);
}
run();
