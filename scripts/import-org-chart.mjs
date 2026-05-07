import { db } from "../dist/db/client.js";

const ORG_PATH = "/Users/shaifinkelstein/Desktop/Org-Chart-Dragontail/src/data/employees.js";
const { initialEmployees } = await import(`file://${ORG_PATH}`);

console.log(`Loaded ${initialEmployees.length} employees from org chart.`);

function normalizeName(fullName) {
  // Org chart uses "Last, First" or sometimes "Last, First Middle"
  const trimmed = fullName.trim();
  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",");
    return `${rest.join(",").trim()} ${last.trim()}`.trim();
  }
  return trimmed;
}

function inferCountry(location) {
  const l = (location || "").toLowerCase();
  if (l === "tel aviv" || l === "haifa") return "Israel";
  if (l === "new york") return "USA";
  if (l === "london") return "UK";
  return null; // Remote / Other / "" → unknown
}

function inferChannel(country) {
  if (country === "Israel") return "buyme";
  if (country === "USA") return "amazon_us";
  return "manual";
}

const findByEmail = db.prepare(
  `SELECT id, name FROM employees WHERE LOWER(email) = LOWER(?) LIMIT 1`,
);
const findByName = db.prepare(
  `SELECT id, name FROM employees WHERE LOWER(name) = LOWER(?) LIMIT 1`,
);

const updateOrgFields = db.prepare(`
  UPDATE employees SET
    position = ?,
    department = ?,
    org_chart_id = ?,
    manager_org_id = ?,
    level = ?,
    location = ?,
    updated_at = datetime('now')
  WHERE id = ?
`);

// Also fill in country/email/phone if currently empty for existing matched employees.
const fillMissing = db.prepare(`
  UPDATE employees SET
    country = COALESCE(NULLIF(country, ''), ?),
    email = COALESCE(NULLIF(email, ''), LOWER(?)),
    phone = COALESCE(NULLIF(phone, ''), ?),
    updated_at = datetime('now')
  WHERE id = ?
`);

const insertNew = db.prepare(`
  INSERT INTO employees (
    name, country, type, email, phone, amount_ils, channel,
    position, department, org_chart_id, manager_org_id, level, location
  )
  VALUES (?, ?, 'Employee', LOWER(?), ?, 300, ?, ?, ?, ?, ?, ?, ?)
  RETURNING id
`);

let matched = 0;
let inserted = 0;
const newNames = [];

for (const oc of initialEmployees) {
  const name = normalizeName(oc.fullName);
  const email = (oc.email || "").trim();
  const phone = (oc.phone || "").trim();
  const country = inferCountry(oc.location);
  const channel = inferChannel(country);

  let row = email ? findByEmail.get(email) : null;
  if (!row) row = findByName.get(name);

  if (row) {
    updateOrgFields.run(
      oc.position || null,
      oc.department || null,
      oc.id,
      oc.managerId,
      oc.level ?? null,
      oc.location || null,
      row.id,
    );
    fillMissing.run(country, email, phone, row.id);
    matched++;
  } else {
    insertNew.run(
      name,
      country,
      email,
      phone,
      channel,
      oc.position || null,
      oc.department || null,
      oc.id,
      oc.managerId,
      oc.level ?? null,
      oc.location || null,
    );
    inserted++;
    newNames.push(`  + ${name} (${oc.position}, ${oc.department})`);
  }
}

console.log(`✓ matched & enriched: ${matched}`);
console.log(`✓ inserted as new: ${inserted}`);
if (newNames.length) {
  console.log("\nNew employees added:");
  console.log(newNames.join("\n"));
}

const totalAfter = db.prepare(`SELECT COUNT(*) as n FROM employees WHERE active = 1`).get();
console.log(`\nTotal active employees in DB: ${totalAfter.n}`);

const withDept = db.prepare(`SELECT COUNT(*) as n FROM employees WHERE department IS NOT NULL`).get();
console.log(`With department: ${withDept.n}`);

const byDept = db.prepare(`SELECT department, COUNT(*) as n FROM employees WHERE department IS NOT NULL GROUP BY department ORDER BY n DESC`).all();
console.log("\nBy department:");
console.table(byDept);
