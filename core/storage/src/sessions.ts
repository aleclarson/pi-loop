import { createLocalDb } from "./db.ts";
import * as schema from "./schema.ts";
import { eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getLocalDbPath } from "./db.ts";
import Database from "better-sqlite3";

export class LocalSessionStorage {
  #dbPushed = false;

  async ensureDb() {
    if (this.#dbPushed) return;
    const dbPath = getLocalDbPath();
    await mkdir(dirname(dbPath), { recursive: true });

    // Fallback: execute raw string. drizzle-kit api doesn't work in this specific env.
    const sqlite = new Database(dbPath);
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS pi_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_owner TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        pr_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    this.#dbPushed = true;
  }

  async createSession(owner: string, repo: string, prNumber: number) {
    await this.ensureDb();
    const db = createLocalDb();
    const createdAt = new Date().toISOString();

    const [inserted] = await db
      .insert(schema.piSessions)
      .values({
        repoOwner: owner,
        repoName: repo,
        prNumber,
        status: "active",
        createdAt
      })
      .returning();

    return inserted;
  }

  async updateSession(id: number, status: string) {
    await this.ensureDb();
    const db = createLocalDb();

    const [updated] = await db
      .update(schema.piSessions)
      .set({ status })
      .where(eq(schema.piSessions.id, id))
      .returning();

    if (!updated) {
      throw new Error("Session not found");
    }

    return updated;
  }
}
