import { defineConfig } from "drizzle-kit"
import { getDatabasePath } from "./src/paths.js"

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: getDatabasePath(),
  },
})
