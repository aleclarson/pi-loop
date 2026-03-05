import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "node:path";
import { getGoddardGlobalDir } from "./paths.ts";
import * as schema from "./schema.ts";

export function getLocalDbPath(): string {
  return join(getGoddardGlobalDir(), "goddard.db");
}

let _dbInstance: ReturnType<typeof drizzle> | null = null;

export function createLocalDb() {
  if (!_dbInstance) {
    const dbPath = getLocalDbPath();
    const sqlite = new Database(dbPath);
    _dbInstance = drizzle(sqlite, { schema });
  }
  return _dbInstance;
}
