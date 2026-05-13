#!/usr/bin/env node
// Restores the original org-chart visual order by reading the order of
// initialEmployees from the standalone HTML and writing each row's index
// into employees.org_chart_order.
//
// Run once after adding the org_chart_order column. After this, every PUT
// /api/org-chart will keep the order in sync going forward.

import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

const STANDALONE = "/Users/shaifinkelstein/Desktop/Org-Chart-Dragontail/standalone.html";
const DB_PATH = path.resolve(process.cwd(), "data/shefi.db");

const html = readFileSync(STANDALONE, "utf8");
const start = html.indexOf("const initialEmployees = ");
if (start === -1) throw new Error("initialEmployees not found");
const after = html.slice(start + "const initialEmployees = ".length);
let depth = 0;
let end = -1;
for (let i = 0; i < after.length; i++) {
  if (after[i] === "[") depth++;
  else if (after[i] === "]") {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
if (end === -1) throw new Error("Could not find end of initialEmployees");
// eslint-disable-next-line no-new-func
const arr = new Function(`return ${after.slice(0, end)};`)();

const db = new Database(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS _org_order_tmp (org_chart_id TEXT)`); // no-op safety

// Make sure column exists
const cols = db.prepare("PRAGMA table_info(employees)").all();
if (!cols.some((c) => c.name === "org_chart_order")) {
  db.exec("ALTER TABLE employees ADD COLUMN org_chart_order INTEGER");
}

const stmt = db.prepare(
  "UPDATE employees SET org_chart_order = ? WHERE org_chart_id = ?",
);
let updated = 0;
const tx = db.transaction(() => {
  for (let i = 0; i < arr.length; i++) {
    const r = stmt.run(i, String(arr[i].id));
    if (r.changes > 0) updated++;
  }
});
tx();

console.log(`Backfilled org_chart_order for ${updated} of ${arr.length} entries.`);
const missing = db
  .prepare(
    "SELECT name, org_chart_id FROM employees WHERE org_chart_id IS NOT NULL AND org_chart_order IS NULL",
  )
  .all();
if (missing.length) {
  console.log(`\n${missing.length} active org-chart rows still without order:`);
  console.table(missing);
}
