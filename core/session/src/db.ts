import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export const messages = sqliteTable("messages", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull()
});

const schema = { messages };

const dir = path.join(os.homedir(), ".goddard");
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(path.join(dir, "session.db"));

// Basic table initialization
sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );
`);

export const db = drizzle({ client: sqlite, schema });

export async function initDb() {
    // handled synchronously above for minimal implementation
}
