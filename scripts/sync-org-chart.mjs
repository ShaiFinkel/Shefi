#!/usr/bin/env node
// Sync the People tab from the standalone org-chart HTML.
// Source of truth: /Users/shaifinkelstein/Desktop/Org-Chart-Dragontail/standalone.html
//
// Strategy:
//   * Match DB rows to org chart by (in priority): org_chart_id, then email, then normalized name.
//   * For matched: overwrite org-chart-derived fields (position, department, manager, level,
//     hire_date, address, person_number, tech_title, grade_level, gender). Fill birthday/email/phone
//     ONLY if currently NULL — never clobber Shefi's manual fixes.
//   * For org-chart entries not in DB: INSERT new employees (active=1, channel inferred from country).
//   * For DB rows not in org chart: leave alone (international staff, contractors). Print them.
//
// After all rows are upserted, also denormalize manager_name from manager_org_id for easy display.

import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

const STANDALONE = "/Users/shaifinkelstein/Desktop/Org-Chart-Dragontail/standalone.html";
const DB_PATH = path.resolve(process.cwd(), "data/shefi.db");

// ---------- Extract initialEmployees array from standalone.html ----------
function extractEmployees() {
  const html = readFileSync(STANDALONE, "utf8");
  const startMarker = "const initialEmployees = ";
  const start = html.indexOf(startMarker);
  if (start === -1) throw new Error("Could not find initialEmployees in standalone.html");
  // Find matching `];` after the marker
  const afterStart = html.slice(start + startMarker.length);
  let depth = 0;
  let end = -1;
  for (let i = 0; i < afterStart.length; i++) {
    const c = afterStart[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error("Could not find end of initialEmployees array");
  const arrText = afterStart.slice(0, end);
  // It's plain JS object literals — eval safely with Function
  // eslint-disable-next-line no-new-func
  const arr = new Function(`return ${arrText};`)();
  if (!Array.isArray(arr)) throw new Error("initialEmployees is not an array");
  return arr;
}

// "Bachar, Itzik" -> "Itzik Bachar"
function normalizeName(orgName) {
  if (!orgName) return "";
  if (orgName.includes(",")) {
    const [last, first] = orgName.split(",").map((s) => s.trim());
    return `${first} ${last}`;
  }
  return orgName.trim();
}

function lc(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

// "1981-04-28" -> { md: "04-28", full: "1981-04-28" }; "" -> { md: null, full: null }
function parseBirthday(s) {
  if (!s || typeof s !== "string") return { md: null, full: null };
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { md: null, full: null };
  return { md: `${m[2]}-${m[3]}`, full: s.trim() };
}

function inferLocation(address, country) {
  if (!address) return null;
  const a = address.toLowerCase();
  const cities = [
    ["tel aviv", "Tel Aviv"],
    ["givatayim", "Givatayim"],
    ["ramat gan", "Ramat Gan"],
    ["petah tikva", "Petah Tikva"],
    ["modi'in", "Modi'in"],
    ["modiin", "Modi'in"],
    ["kfar saba", "Kfar Saba"],
    ["herzliya", "Herzliya"],
    ["holon", "Holon"],
    ["bat yam", "Bat Yam"],
    ["jerusalem", "Jerusalem"],
    ["haifa", "Haifa"],
    ["beer sheva", "Beer Sheva"],
    ["beersheba", "Beer Sheva"],
    ["rishon", "Rishon LeZion"],
    ["netanya", "Netanya"],
    ["raanana", "Ra'anana"],
    ["ra'anana", "Ra'anana"],
    ["brisbane", "Brisbane"],
    ["sydney", "Sydney"],
    ["melbourne", "Melbourne"],
    ["queensland", "QLD"],
  ];
  for (const [needle, label] of cities) {
    if (a.includes(needle)) return label;
  }
  if (country && country.toLowerCase() !== "israel") return country;
  return null;
}

// ---------- Main sync ----------
function main() {
  const orgEmployees = extractEmployees();
  console.log(`Loaded ${orgEmployees.length} employees from org chart.\n`);

  const db = new Database(DB_PATH);

  // Run migrations the same way the server does (so columns exist):
  function ensureColumn(table, column, defSql) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${defSql}`);
    }
  }
  ensureColumn("employees", "position", "TEXT");
  ensureColumn("employees", "department", "TEXT");
  ensureColumn("employees", "org_chart_id", "TEXT");
  ensureColumn("employees", "manager_org_id", "TEXT");
  ensureColumn("employees", "level", "INTEGER");
  ensureColumn("employees", "location", "TEXT");
  ensureColumn("employees", "hire_date", "TEXT");
  ensureColumn("employees", "person_number", "TEXT");
  ensureColumn("employees", "tech_title", "TEXT");
  ensureColumn("employees", "address", "TEXT");
  ensureColumn("employees", "grade_level", "TEXT");
  ensureColumn("employees", "gender", "TEXT");
  ensureColumn("employees", "manager_name", "TEXT");
  ensureColumn("employees", "salary_monthly", "INTEGER");
  ensureColumn("employees", "salary_yearly", "INTEGER");
  ensureColumn("employees", "currency", "TEXT");

  // Pre-fetch all DB rows for matching
  const dbRows = db.prepare("SELECT * FROM employees").all();
  const byOrgId = new Map();
  const byEmail = new Map();
  const byNorm = new Map();
  for (const r of dbRows) {
    if (r.org_chart_id) byOrgId.set(String(r.org_chart_id), r);
    if (r.email) byEmail.set(lc(r.email), r);
    byNorm.set(lc(r.name), r);
  }

  const updateStmt = db.prepare(`
    UPDATE employees SET
      name = COALESCE(@name, name),
      email = COALESCE(email, @email),
      phone = COALESCE(NULLIF(phone,''), @phone),
      birthday_md = COALESCE(birthday_md, @birthday_md),
      birthday_full = COALESCE(birthday_full, @birthday_full),
      org_chart_id = @org_chart_id,
      manager_org_id = @manager_org_id,
      position = @position,
      department = @department,
      level = @level,
      location = COALESCE(@location, location),
      hire_date = @hire_date,
      person_number = @person_number,
      tech_title = @tech_title,
      address = @address,
      grade_level = @grade_level,
      gender = @gender,
      salary_monthly = @salary_monthly,
      salary_yearly = @salary_yearly,
      currency = @currency,
      type = CASE WHEN @is_contractor = 1 THEN 'Contractor' ELSE COALESCE(type, 'Employee') END,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  const insertStmt = db.prepare(`
    INSERT INTO employees (
      name, country, type, email, phone, birthday_md, birthday_full,
      amount_ils, channel, position, department, org_chart_id, manager_org_id,
      level, location, hire_date, person_number, tech_title, address,
      grade_level, gender, salary_monthly, salary_yearly, currency
    ) VALUES (
      @name, @country, @type, @email, @phone, @birthday_md, @birthday_full,
      @amount_ils, @channel, @position, @department, @org_chart_id, @manager_org_id,
      @level, @location, @hire_date, @person_number, @tech_title, @address,
      @grade_level, @gender, @salary_monthly, @salary_yearly, @currency
    )
  `);

  let matched = 0;
  let inserted = 0;
  const matchedDbIds = new Set();

  const tx = db.transaction(() => {
    for (const o of orgEmployees) {
      const name = normalizeName(o.fullName);
      const orgId = String(o.id);
      const email = o.email || null;
      const { md, full } = parseBirthday(o.birthday);
      const isContractor = o.isContractor === true;
      const country = o.country || "Israel";

      const toInt = (v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = parseInt(String(v).replace(/[,\s]/g, ""), 10);
        return Number.isFinite(n) ? n : null;
      };

      const payload = {
        name,
        email,
        phone: o.phone || null,
        birthday_md: md,
        birthday_full: full,
        org_chart_id: orgId,
        manager_org_id: o.managerId ? String(o.managerId) : null,
        position: o.position || null,
        department: o.department || null,
        level: typeof o.level === "number" ? o.level : null,
        location: inferLocation(o.address, country),
        hire_date: o.startDate || null,
        person_number: o.personNumber || null,
        tech_title: o.techTitle || null,
        address: o.address || null,
        grade_level: o.gradeLevel || null,
        gender: o.gender || null,
        salary_monthly: toInt(o.salaryMonthly),
        salary_yearly: toInt(o.salaryYearly),
        currency: o.currency || null,
        is_contractor: isContractor ? 1 : 0,
      };

      const existing =
        byOrgId.get(orgId) ||
        (email && byEmail.get(lc(email))) ||
        byNorm.get(lc(name));

      if (existing) {
        matched++;
        matchedDbIds.add(existing.id);
        updateStmt.run({ ...payload, id: existing.id });
      } else {
        inserted++;
        const channel = country.toLowerCase() === "israel" ? "buyme" : "manual";
        try {
          insertStmt.run({
            ...payload,
            country,
            type: isContractor ? "Contractor" : "Employee",
            amount_ils: 300,
            channel,
          });
        } catch (err) {
          console.error(`INSERT failed for "${name}" (orgId=${orgId}, email=${email}):`, err.message);
          // Likely a UNIQUE constraint on name — find and link instead.
          const conflict = db.prepare("SELECT * FROM employees WHERE name = ?").get(name);
          if (conflict) {
            console.error(`  → name collides with DB id=${conflict.id} (email=${conflict.email}). Linking to org chart.`);
            updateStmt.run({ ...payload, id: conflict.id });
            matched++;
            inserted--;
            matchedDbIds.add(conflict.id);
          } else {
            throw err;
          }
        }
      }
    }

    // Denormalize manager_name from manager_org_id (so the UI doesn't have to look it up)
    db.exec(`
      UPDATE employees AS child SET manager_name = (
        SELECT mgr.name FROM employees mgr
        WHERE mgr.org_chart_id = child.manager_org_id
      ) WHERE manager_org_id IS NOT NULL
    `);
  });

  tx();

  console.log(`✓ Matched & updated: ${matched}`);
  console.log(`✓ Inserted: ${inserted}`);

  // Show DB rows NOT in org chart (likely international/contractors)
  const orgIdsSeen = new Set(orgEmployees.map((o) => String(o.id)));
  const inDbNotOrg = db
    .prepare(
      "SELECT id, name, country, type, channel, email FROM employees WHERE active=1 ORDER BY name",
    )
    .all()
    .filter((r) => !r.org_chart_id || !orgIdsSeen.has(String(r.org_chart_id)));

  if (inDbNotOrg.length) {
    console.log(`\n⚠ ${inDbNotOrg.length} active employees in DB but NOT in org chart (left untouched):`);
    console.table(inDbNotOrg);
  }

  // Final counts
  const total = db.prepare("SELECT COUNT(*) AS n FROM employees WHERE active=1").get().n;
  const withDept = db.prepare("SELECT COUNT(*) AS n FROM employees WHERE active=1 AND department IS NOT NULL").get().n;
  const withHire = db.prepare("SELECT COUNT(*) AS n FROM employees WHERE active=1 AND hire_date IS NOT NULL").get().n;
  const withMgr = db.prepare("SELECT COUNT(*) AS n FROM employees WHERE active=1 AND manager_name IS NOT NULL").get().n;
  console.log(`\nFinal: ${total} active · ${withDept} with dept · ${withHire} with hire date · ${withMgr} with manager`);
}

main();
