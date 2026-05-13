#!/usr/bin/env node
// Seeds the equipment_catalog table with items ordered in the last 6 months
// (Sep 2025 – Feb 2026), based on the historical purchase list.
//
// - Deduplicates: ThinkPad E14 ordered 6 times → one catalog entry.
// - Categorizes by EquipmentCategory (laptop / monitor / phone / accessory / software / other).
// - Includes typical NIS prices as a starting reference (you can edit any item later in the UI).
// - Skips items whose `name` already exists (idempotent — safe to re-run).

import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "data/shefi.db");
const db = new Database(DB_PATH);

const items = [
  // === 💻 Laptops & desktops ===
  { name: "Lenovo ThinkPad E14 Gen 7",           category: "laptop",    vendor: "Lenovo", price: 5500, description: "מחשב נייד עסקי, 14 אינץ'" },
  { name: "Lenovo Yoga 7",                        category: "laptop",    vendor: "Lenovo", price: 6000, description: "מחשב נייד 2-in-1" },
  { name: "Lenovo IdeaPad Slim 5",                category: "laptop",    vendor: "Lenovo", price: 3800, description: "מחשב נייד שירותי" },
  { name: "Apple MacBook Air 13.6\" M4",         category: "laptop",    vendor: "Apple",  price: 5500, description: "MacBook Air דור M4" },
  { name: "Apple MacBook Pro 14\" M5",           category: "laptop",    vendor: "Apple",  price: 9500, description: "MacBook Pro 14 דור M5" },
  { name: "Apple MacBook Pro 14\" M4 Max (128GB)", category: "laptop",  vendor: "Apple",  price: 22000, description: "מחשב מפתחים — 128GB RAM" },
  { name: "Apple iMac 24\" M4",                  category: "laptop",    vendor: "Apple",  price: 7500, description: "מחשב שולחני All-in-One" },

  // === 🖥 Monitors ===
  { name: "Dell P2425H 24\"",                    category: "monitor",   vendor: "Dell",   price: 900,  description: "מסך עבודה סטנדרטי 24 אינץ'" },

  // === 📱 Phones ===
  { name: "Apple iPhone 17",                     category: "phone",     vendor: "Apple",   price: 4000, description: null },
  { name: "Samsung Galaxy S25 Ultra",            category: "phone",     vendor: "Samsung", price: 5500, description: null },
  { name: "Samsung Galaxy A17",                  category: "phone",     vendor: "Samsung", price: 1200, description: "טלפון בסיסי" },

  // === 🎧 Accessories — input devices ===
  { name: "Dell Keyboard + Mouse Set (KM5221W)", category: "accessory", vendor: "Dell",     price: 150, description: "סט מקלדת + עכבר אלחוטי" },
  { name: "Logitech MK850 Combo",                category: "accessory", vendor: "Logitech", price: 400, description: "מקלדת + עכבר אלחוטי Multi-Device" },
  { name: "Logitech MX Vertical Mouse",          category: "accessory", vendor: "Logitech", price: 450, description: "עכבר ארגונומי אנכי" },
  { name: "Apple Magic Keyboard",                category: "accessory", vendor: "Apple",    price: 450, description: null },
  { name: "Apple Magic Trackpad",                category: "accessory", vendor: "Apple",    price: 600, description: null },

  // === 🎧 Accessories — audio/smart-home ===
  { name: "Apple HomePod mini",                  category: "accessory", vendor: "Apple",    price: 450, description: "רמקול חכם" },

  // === 🎧 Accessories — e-ink & note-taking ===
  { name: "Boox Note Air 5C",                    category: "accessory", vendor: "Boox",       price: 2500, description: "מחברת דיגיטלית E-Ink צבעונית" },
  { name: "Supernote Nomad",                     category: "accessory", vendor: "Supernote",  price: 1800, description: "מחברת דיגיטלית E-Ink קומפקטית" },
  { name: "reMarkable Paper Pro Move",           category: "accessory", vendor: "reMarkable", price: 2400, description: "מחברת דיגיטלית E-Ink ניידת" },

  // === 🎧 Accessories — connectivity ===
  { name: "Docking Station (USB-C universal)",   category: "accessory", vendor: null,        price: 700, description: "תחנת עגינה אוניברסלית USB-C" },
  { name: "ASUS Power Adapter",                  category: "accessory", vendor: "ASUS",      price: 250, description: "מתאם מתח" },
  { name: "HDMI Cable (3m)",                     category: "accessory", vendor: null,        price: 50,  description: "כבל HDMI סטנדרטי" },
  { name: "USB-C Cable",                         category: "accessory", vendor: null,        price: 50,  description: "כבל USB-C כללי" },
  { name: "Samsung USB-C Cable",                 category: "accessory", vendor: "Samsung",   price: 60,  description: null },

  // === 🧩 Software ===
  { name: "Microsoft Windows 11 Pro",            category: "software",  vendor: "Microsoft", price: 750, description: "רישיון מערכת הפעלה" },
];

const existing = db.prepare(`SELECT name FROM equipment_catalog`).all();
const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));

const insert = db.prepare(`
  INSERT INTO equipment_catalog (name, category, description, vendor, price, currency, image_url, active)
  VALUES (@name, @category, @description, @vendor, @price, '₪', NULL, 1)
`);

let added = 0;
let skipped = 0;
const skippedNames = [];

const tx = db.transaction(() => {
  for (const it of items) {
    if (existingNames.has(it.name.toLowerCase())) {
      skipped++;
      skippedNames.push(it.name);
      continue;
    }
    insert.run({
      name: it.name,
      category: it.category,
      description: it.description ?? null,
      vendor: it.vendor ?? null,
      price: it.price ?? null,
    });
    added++;
  }
});
tx();

console.log(`\n✓ Seeded equipment catalog`);
console.log(`  Added:   ${added}`);
console.log(`  Skipped: ${skipped} (already in catalog)`);
if (skippedNames.length) {
  console.log("  Skipped items:");
  for (const n of skippedNames) console.log(`    - ${n}`);
}

const byCat = db.prepare(`
  SELECT category, COUNT(*) AS n FROM equipment_catalog WHERE active = 1
  GROUP BY category ORDER BY category
`).all();
console.log("\nCatalog by category:");
for (const row of byCat) console.log(`  ${row.category.padEnd(12)} ${row.n}`);
console.log(`  ${"TOTAL".padEnd(12)} ${byCat.reduce((s, r) => s + r.n, 0)}`);

db.close();
