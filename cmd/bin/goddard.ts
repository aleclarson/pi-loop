#!/usr/bin/env -S pnpm tsx
import { runCommand } from "../src/index.ts";

const result = runCommand(process.argv.slice(2));
process.stdout.write(`${JSON.stringify(result)}\n`);
