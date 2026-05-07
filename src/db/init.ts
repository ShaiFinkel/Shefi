import { db } from "./client.js";

const tables = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
  .all() as { name: string }[];

console.log("DB מוכן. טבלאות:");
for (const t of tables) {
  console.log(`  - ${t.name}`);
}
