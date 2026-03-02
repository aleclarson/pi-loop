import { createClient } from "@goddard-ai/sdk";

export function runCommand(argv: string[] = []) {
  const sdk = createClient({ serviceName: "cmd" });
  return {
    args: argv,
    sdk: sdk.ping()
  };
}
