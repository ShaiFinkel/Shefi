import XLSX from "xlsx";
import { upsertEmployee } from "../dist/db/employees.js";

const FILE = process.argv[2] || "data/inputs/birthdays.xlsx";
const wb = XLSX.readFile(FILE);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

const dataRows = rows.slice(3).filter((r) => (r[0] ?? "").toString().trim() !== "");
console.log(`Parsing ${dataRows.length} rows from ${FILE}`);

function channelFor(country, notes) {
  const c = (country || "").toLowerCase();
  const n = (notes || "").toLowerCase();
  if (c === "israel") return "buyme";
  if (n.includes("amazon australia") || c === "australia") return "amazon_au";
  if (n.includes("amazon usa") || c === "usa") return "amazon_us";
  if (n.includes("amazon canada") || c === "canada") return "amazon_ca";
  return "manual";
}

const HEADER_LIKE = new Set([
  "Name", "Country", "Notes", "Employee", "Contractor",
  "Employee - Hourly", "Employee/intern/contractor",
]);

let imported = 0;
let skipped = 0;
for (const row of dataRows) {
  const [name, country, type, , , date, amount, email, phone, notes] = row;
  const cleanName = String(name).trim();
  if (!cleanName || HEADER_LIKE.has(cleanName)) {
    skipped++;
    continue;
  }
  const dateStr = String(date || "").trim();
  const md = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr.slice(5) : null;
  const full = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : null;
  const amountIls = Number(amount) > 0 ? Number(amount) : 300;
  const channel = channelFor(country, notes);
  upsertEmployee({
    name: cleanName,
    country: String(country || "").trim() || null,
    type: String(type || "").trim() || null,
    email: String(email || "").trim().toLowerCase() || null,
    phone: String(phone || "").trim() || null,
    birthday_md: md,
    birthday_full: full,
    amount_ils: amountIls,
    channel,
    notes: String(notes || "").trim() || null,
  });
  imported++;
}

console.log(`✓ imported ${imported}, skipped ${skipped}`);
process.exit(0);
