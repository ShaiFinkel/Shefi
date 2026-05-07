import { db } from "../dist/db/client.js";

// Format: [orgChartOnlyId, birthdayId] — birthday wins, org-chart fields move over.
const DUP_PAIRS = [
  [85, 68], // Elad Shacahr -> Elad Shachar
  [89, 9],  // Carmela Shenkaman-Mualem -> Carmela Shenkman -Mualem
  [94, 81], // Sara Friedman -> Sara Fridman
  [97, 21], // Tamer Oved -> Tomer Oved
  [88, 28], // Omri Bahat Triedel -> Omri Bahat Treidel
  [87, 74], // Tal Gozlan -> Tal Gozlan-Benhamo (assume same person, recent name change)
  [93, 44], // Raii Gurevitch -> Roii Gurevitch
];

const REMOVE_IDS = [92]; // OPEN placeholder

const getRow = db.prepare(`SELECT * FROM employees WHERE id = ?`);
const updateOrg = db.prepare(`
  UPDATE employees SET
    position = COALESCE(?, position),
    department = COALESCE(?, department),
    org_chart_id = COALESCE(?, org_chart_id),
    manager_org_id = COALESCE(?, manager_org_id),
    level = COALESCE(?, level),
    location = COALESCE(?, location),
    updated_at = datetime('now')
  WHERE id = ?
`);
const deleteRow = db.prepare(`DELETE FROM employees WHERE id = ?`);

let merged = 0;
for (const [fromId, toId] of DUP_PAIRS) {
  const from = getRow.get(fromId);
  const to = getRow.get(toId);
  if (!from || !to) {
    console.warn(`skip ${fromId}->${toId}: missing row`);
    continue;
  }
  updateOrg.run(
    from.position,
    from.department,
    from.org_chart_id,
    from.manager_org_id,
    from.level,
    from.location,
    to.id,
  );
  deleteRow.run(from.id);
  console.log(`✓ merged "${from.name}" (#${from.id}) → "${to.name}" (#${to.id})`);
  merged++;
}

for (const id of REMOVE_IDS) {
  const row = getRow.get(id);
  if (row) {
    deleteRow.run(id);
    console.log(`✗ removed "${row.name}" (#${id})`);
  }
}

const total = db.prepare(`SELECT COUNT(*) as n FROM employees WHERE active = 1`).get();
console.log(`\nTotal active employees: ${total.n}`);
const enriched = db.prepare(`SELECT COUNT(*) as n FROM employees WHERE department IS NOT NULL`).get();
console.log(`With org chart data: ${enriched.n}`);
const noDept = db.prepare(`SELECT id, name, email FROM employees WHERE active = 1 AND department IS NULL ORDER BY name`).all();
console.log(`\nWithout department (${noDept.length}):`);
for (const e of noDept) console.log(`  #${e.id} ${e.name} | ${e.email ?? "—"}`);
