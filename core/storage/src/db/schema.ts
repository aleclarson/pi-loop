import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  type: text("type").notNull(),
  payload: text("payload", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})
