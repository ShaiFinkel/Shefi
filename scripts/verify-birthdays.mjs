import { db } from "../dist/db/client.js";
import { formatPreview, createOrdersForMonth } from "../dist/agents/ops/birthdays-tools.js";

const total = db.prepare("SELECT COUNT(*) as n FROM employees WHERE active = 1").get();
console.log("Active employees:", total.n);

const byChannel = db.prepare("SELECT channel, COUNT(*) as n FROM employees WHERE active = 1 GROUP BY channel").all();
console.log("By channel:", byChannel);

const byType = db.prepare("SELECT type, COUNT(*) as n FROM employees WHERE active = 1 GROUP BY type").all();
console.log("By type:", byType);

const noBirthday = db.prepare("SELECT name, country FROM employees WHERE birthday_md IS NULL").all();
if (noBirthday.length) {
  console.log("\n⚠️ Employees without birthday:");
  for (const e of noBirthday) console.log(`  ${e.name} (${e.country})`);
}

console.log("\n--- Preview for current month ---");
console.log(formatPreview(new Date().toISOString().slice(0, 7)));

console.log("\n--- Preview for next month (June 2026) ---");
console.log(formatPreview("2026-06"));

console.log("\n--- Dry-run create orders for 2026-06 ---");
const r = createOrdersForMonth("2026-06");
console.log(`created: ${r.created}, skipped (already existed): ${r.skipped}`);

const orders = db.prepare("SELECT * FROM birthday_orders WHERE month = ?").all("2026-06");
console.log(`Total orders for 2026-06 in DB: ${orders.length}`);
