import type { FastifyInstance } from "fastify";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { extname, resolve } from "node:path";
import { db } from "../db/client.js";

const QUOTES_DIR = resolve(process.cwd(), "data/quotes");
mkdirSync(QUOTES_DIR, { recursive: true });

function safeQuoteFilename(requestId: number, originalName: string): string {
  const ext = extname(originalName).toLowerCase().slice(0, 10);
  const base = originalName
    .slice(0, -ext.length || undefined)
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .slice(0, 60) || "quote";
  return `req-${requestId}-${Date.now()}-${base}${ext}`;
}
import {
  approveOrdersForMonth,
  findEmployeesByQuery,
  getEmployeeById,
  listActiveEmployees,
  listOrdersForMonth,
  markDeparted,
  markOrdersSentForMonth,
  skipOrdersForMonth,
  upsertEmployee,
} from "../db/employees.js";
import {
  buyMeCsvForMonth,
  createOrdersForMonth,
  formatPreview,
} from "../agents/ops/birthdays-tools.js";
import {
  attachQuote,
  counts as equipmentCounts,
  createCatalogItem,
  createRequest,
  execApprove,
  getCatalogItem,
  getRequest,
  listCatalog,
  listRequests,
  managerApprove,
  markOrdered,
  markReceived,
  reject as rejectRequest,
  updateCatalogItem,
  type EquipmentCategory,
  type ListRequestsFilter,
  type RequestStatus,
} from "../db/equipment.js";

interface CountRow { n: number }

// ===== Org Chart bridge — types & helpers =====

interface OrgChartEntry {
  id: string | number;
  fullName?: string;
  position?: string | null;
  department?: string | null;
  level?: number | null;
  managerId?: string | number | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  personNumber?: string | null;
  techTitle?: string | null;
  salaryMonthly?: string | number | null;
  salaryYearly?: string | number | null;
  currency?: string | null;
  startDate?: string | null;
  birthday?: string | null;
  address?: string | null;
  country?: string | null;
  gradeLevel?: string | null;
  gender?: string | null;
  isContractor?: boolean;
}

interface OrgChartDbRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  birthday_md: string | null;
  birthday_full: string | null;
  position: string | null;
  department: string | null;
  level: number | null;
  org_chart_id: string | null;
  manager_org_id: string | null;
  hire_date: string | null;
  person_number: string | null;
  tech_title: string | null;
  address: string | null;
  country: string | null;
  grade_level: string | null;
  gender: string | null;
  salary_monthly: number | null;
  salary_yearly: number | null;
  currency: string | null;
  type: string | null;
}

// "Itzik Bachar" -> "Bachar, Itzik"  (org chart's display format)
function nameToOrgChartFormat(name: string | null): string {
  if (!name) return "";
  if (name.includes(",")) return name; // already formatted
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return `${last}, ${first}`;
}

// "Bachar, Itzik" -> "Itzik Bachar"
function orgChartNameToDisplay(orgName: string | null | undefined): string {
  if (!orgName) return "";
  if (orgName.includes(",")) {
    const [last, first] = orgName.split(",").map((s) => s.trim());
    return `${first} ${last}`;
  }
  return orgName.trim();
}

function rowToOrgChartEntry(r: OrgChartDbRow): OrgChartEntry {
  return {
    id: r.org_chart_id ?? String(r.id),
    fullName: nameToOrgChartFormat(r.name),
    position: r.position ?? "",
    department: r.department ?? "",
    level: r.level ?? null,
    managerId: r.manager_org_id ?? null,
    email: r.email ?? "",
    phone: r.phone ?? "",
    notes: r.notes ?? "",
    personNumber: r.person_number ?? "",
    techTitle: r.tech_title ?? "",
    salaryMonthly: r.salary_monthly !== null ? String(r.salary_monthly) : "",
    salaryYearly: r.salary_yearly !== null ? String(r.salary_yearly) : "",
    currency: r.currency ?? "",
    startDate: r.hire_date ?? "",
    birthday: r.birthday_full ?? "",
    address: r.address ?? "",
    country: r.country ?? "",
    gradeLevel: r.grade_level ?? "",
    gender: r.gender ?? "",
    ...(r.type === "Contractor" ? { isContractor: true } : {}),
  };
}

function parseBirthdayMD(s: string | null | undefined): {
  md: string | null;
  full: string | null;
} {
  if (!s || typeof s !== "string") return { md: null, full: null };
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { md: null, full: null };
  return { md: `${m[2]}-${m[3]}`, full: s.trim() };
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v).replace(/[,\s₪$]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

interface SyncResult {
  inserted: number;
  updated: number;
  marked_departed: number;
  total: number;
}

function applyOrgChartSync(entries: OrgChartEntry[]): SyncResult {
  const sentIds = new Set<string>();
  for (const e of entries) sentIds.add(String(e.id));

  // Find rows currently in DB that have org_chart_id but were dropped from the payload
  const existingOrgRows = db
    .prepare(
      `SELECT id, org_chart_id, name FROM employees WHERE active = 1 AND org_chart_id IS NOT NULL`,
    )
    .all() as { id: number; org_chart_id: string; name: string }[];
  const departedIds: number[] = [];
  for (const r of existingOrgRows) {
    if (!sentIds.has(String(r.org_chart_id))) departedIds.push(r.id);
  }

  // Pre-build lookup maps for matching
  const allRows = db
    .prepare(`SELECT id, org_chart_id, email, name FROM employees`)
    .all() as { id: number; org_chart_id: string | null; email: string | null; name: string }[];
  const byOrgId = new Map<string, number>();
  const byEmail = new Map<string, number>();
  for (const r of allRows) {
    if (r.org_chart_id) byOrgId.set(String(r.org_chart_id), r.id);
    if (r.email) byEmail.set(r.email.toLowerCase(), r.id);
  }

  const updateStmt = db.prepare(`
    UPDATE employees SET
      name = @name,
      email = @email,
      phone = @phone,
      notes = @notes,
      birthday_md = @birthday_md,
      birthday_full = @birthday_full,
      org_chart_id = @org_chart_id,
      org_chart_order = @org_chart_order,
      manager_org_id = @manager_org_id,
      position = @position,
      department = @department,
      level = @level,
      hire_date = @hire_date,
      person_number = @person_number,
      tech_title = @tech_title,
      address = @address,
      country = @country,
      grade_level = @grade_level,
      gender = @gender,
      salary_monthly = @salary_monthly,
      salary_yearly = @salary_yearly,
      currency = @currency,
      type = @type,
      active = 1,
      departed_at = NULL,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  const insertStmt = db.prepare(`
    INSERT INTO employees (
      name, country, type, email, phone, notes, birthday_md, birthday_full,
      amount_ils, channel, position, department, org_chart_id, org_chart_order,
      manager_org_id, level, hire_date, person_number, tech_title, address,
      grade_level, gender, salary_monthly, salary_yearly, currency
    ) VALUES (
      @name, @country, @type, @email, @phone, @notes, @birthday_md, @birthday_full,
      @amount_ils, @channel, @position, @department, @org_chart_id, @org_chart_order,
      @manager_org_id, @level, @hire_date, @person_number, @tech_title, @address,
      @grade_level, @gender, @salary_monthly, @salary_yearly, @currency
    )
  `);

  let inserted = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const orgId = String(e.id);
      const name = orgChartNameToDisplay(e.fullName);
      const email = e.email || null;
      const { md, full } = parseBirthdayMD(e.birthday);
      const isContractor = e.isContractor === true;
      const country = e.country || "Israel";

      const payload = {
        name,
        country,
        type: isContractor ? "Contractor" : "Employee",
        email,
        phone: e.phone || null,
        notes: e.notes || null,
        birthday_md: md,
        birthday_full: full,
        org_chart_id: orgId,
        org_chart_order: i,
        manager_org_id: e.managerId ? String(e.managerId) : null,
        position: e.position || null,
        department: e.department || null,
        level: typeof e.level === "number" ? e.level : null,
        hire_date: e.startDate || null,
        person_number: e.personNumber || null,
        tech_title: e.techTitle || null,
        address: e.address || null,
        grade_level: e.gradeLevel || null,
        gender: e.gender || null,
        salary_monthly: toIntOrNull(e.salaryMonthly),
        salary_yearly: toIntOrNull(e.salaryYearly),
        currency: e.currency || null,
      };

      const existingId =
        byOrgId.get(orgId) ?? (email ? byEmail.get(email.toLowerCase()) : undefined);

      if (existingId !== undefined) {
        updateStmt.run({ ...payload, id: existingId });
        updated++;
      } else {
        const channel = country.toLowerCase() === "israel" ? "buyme" : "manual";
        insertStmt.run({
          ...payload,
          amount_ils: 300,
          channel,
        });
        inserted++;
      }
    }

    // Mark removed-from-org-chart entries as departed (no destructive delete)
    if (departedIds.length) {
      const stmt = db.prepare(
        `UPDATE employees SET active = 0, departed_at = date('now'), updated_at = datetime('now') WHERE id = ?`,
      );
      for (const id of departedIds) stmt.run(id);
    }

    // Re-denormalize manager_name for everyone
    db.exec(`
      UPDATE employees AS child SET manager_name = (
        SELECT mgr.name FROM employees mgr
        WHERE mgr.org_chart_id = child.manager_org_id
      ) WHERE manager_org_id IS NOT NULL
    `);
  });

  tx();

  return {
    inserted,
    updated,
    marked_departed: departedIds.length,
    total: entries.length,
  };
}

export async function registerDashboardRoutes(app: FastifyInstance) {
  // ===== Summary =====
  app.get("/api/dashboard/summary", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    const monthMM = month.slice(5);

    const openTasks = (db.prepare(`SELECT COUNT(*) as n FROM items WHERE status = 'open'`).get() as CountRow).n;
    const dueToday = (db.prepare(`SELECT COUNT(*) as n FROM items WHERE status = 'open' AND due_date = ?`).get(today) as CountRow).n;
    const overdue = (db.prepare(`SELECT COUNT(*) as n FROM items WHERE status = 'open' AND due_date IS NOT NULL AND due_date < ?`).get(today) as CountRow).n;
    const pendingReminders = (db.prepare(`SELECT COUNT(*) as n FROM reminders WHERE sent = 0`).get() as CountRow).n;

    const activeEmployees = (db.prepare(`SELECT COUNT(*) as n FROM employees WHERE active = 1`).get() as CountRow).n;
    const giftEligible = (db.prepare(`SELECT COUNT(*) as n FROM employees WHERE active = 1 AND type LIKE 'Employee%'`).get() as CountRow).n;
    const birthdaysThisMonth = (db.prepare(`SELECT COUNT(*) as n FROM employees WHERE active = 1 AND birthday_md LIKE ? || '-%' AND type LIKE 'Employee%'`).get(monthMM) as CountRow).n;
    const pendingOrders = (db.prepare(`SELECT COUNT(*) as n FROM birthday_orders WHERE status = 'pending'`).get() as CountRow).n;
    const approvedOrders = (db.prepare(`SELECT COUNT(*) as n FROM birthday_orders WHERE status = 'approved'`).get() as CountRow).n;

    const openDevTasks = (db.prepare(`SELECT COUNT(*) as n FROM dev_tasks WHERE status NOT IN ('merged','rejected','cancelled')`).get() as CountRow).n;
    const readyProposals = (db.prepare(`SELECT COUNT(*) as n FROM proposals WHERE status = 'ready'`).get() as CountRow).n;

    const vendorRecords = (db.prepare(`SELECT COUNT(*) as n FROM records WHERE category = 'vendor' AND status = 'active'`).get() as CountRow).n;
    const eventRecords = (db.prepare(`SELECT COUNT(*) as n FROM records WHERE category = 'event' AND status = 'active'`).get() as CountRow).n;
    const memoriesCount = (db.prepare(`SELECT COUNT(*) as n FROM memories`).get() as CountRow).n;
    const eqCounts = equipmentCounts();

    return {
      today,
      month,
      tasks: { open: openTasks, due_today: dueToday, overdue },
      reminders: { pending: pendingReminders },
      employees: { active: activeEmployees, eligible: giftEligible, birthdays_this_month: birthdaysThisMonth },
      birthdays: { pending_orders: pendingOrders, approved_orders: approvedOrders },
      dev: { open_tasks: openDevTasks, ready_proposals: readyProposals },
      vendors: { active: vendorRecords },
      events: { active: eventRecords },
      memories: memoriesCount,
      equipment: eqCounts,
    };
  });

  // ===== Employees =====
  app.get("/api/employees", async (req) => {
    const q = (req.query as { q?: string }).q?.trim();
    return q ? findEmployeesByQuery(q) : listActiveEmployees();
  });

  app.get("/api/employees/all", async () => {
    return db
      .prepare(`SELECT * FROM employees ORDER BY active DESC, name`)
      .all();
  });

  app.get("/api/employees/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const e = getEmployeeById(id);
    if (!e) return reply.code(404).send({ error: "not found" });
    return e;
  });

  app.post("/api/employees", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    if (!body.name || typeof body.name !== "string") {
      return reply.code(400).send({ error: "name required" });
    }
    const e = upsertEmployee({
      name: body.name as string,
      country: (body.country as string) ?? null,
      type: (body.type as string) ?? "Employee",
      email: (body.email as string) ?? null,
      phone: (body.phone as string) ?? null,
      birthday_md: (body.birthday_md as string) ?? null,
      birthday_full: (body.birthday_full as string) ?? null,
      amount_ils: (body.amount_ils as number) ?? 300,
      channel: (body.channel as never) ?? "buyme",
      notes: (body.notes as string) ?? null,
    });
    return e;
  });

  app.patch("/api/employees/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const existing = getEmployeeById(id);
    if (!existing) return reply.code(404).send({ error: "not found" });
    const body = req.body as Record<string, unknown>;
    const allowed = ["name", "name_he", "country", "type", "email", "phone", "birthday_md", "birthday_full", "amount_ils", "channel", "notes", "position", "department", "manager_org_id", "level", "location", "hire_date", "person_number", "tech_title", "address", "grade_level", "gender", "salary_monthly", "salary_yearly", "currency"];
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const k of allowed) {
      if (k in body) {
        updates.push(`${k} = ?`);
        values.push(body[k]);
      }
    }
    if (updates.length === 0) return existing;
    values.push(id);
    db.prepare(
      `UPDATE employees SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    ).run(...values);
    return getEmployeeById(id);
  });

  app.post("/api/employees/:id/depart", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const e = getEmployeeById(id);
    if (!e) return reply.code(404).send({ error: "not found" });
    const body = (req.body ?? {}) as { departure_date?: string };
    const date = body.departure_date ?? new Date().toISOString().slice(0, 10);
    markDeparted(id, date);
    return { ok: true };
  });

  app.post("/api/employees/:id/restore", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const e = getEmployeeById(id);
    if (!e) return reply.code(404).send({ error: "not found" });
    db.prepare(
      `UPDATE employees SET active = 1, departed_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    ).run(id);
    return { ok: true };
  });

  // ===== Birthdays =====
  app.get("/api/birthdays/:month", async (req) => {
    const month = (req.params as { month: string }).month;
    const monthMM = month.slice(5);
    const employees = db
      .prepare(
        `SELECT * FROM employees WHERE active = 1 AND birthday_md LIKE ? || '-%' AND type LIKE 'Employee%' ORDER BY birthday_md`,
      )
      .all(monthMM);
    const orders = listOrdersForMonth(month);
    return {
      month,
      employees,
      orders,
      preview_text: formatPreview(month),
    };
  });

  app.post("/api/birthdays/:month/create-orders", async (req) => {
    const month = (req.params as { month: string }).month;
    const r = createOrdersForMonth(month);
    return r;
  });

  app.post("/api/birthdays/:month/approve", async (req) => {
    const month = (req.params as { month: string }).month;
    const r = approveOrdersForMonth(month);
    return { approved: r };
  });

  app.post("/api/birthdays/:month/sent", async (req) => {
    const month = (req.params as { month: string }).month;
    const r = markOrdersSentForMonth(month);
    return { sent: r };
  });

  app.post("/api/birthdays/:month/skip", async (req) => {
    const month = (req.params as { month: string }).month;
    const r = skipOrdersForMonth(month);
    return { skipped: r };
  });

  app.get("/api/birthdays/:month/csv", async (req, reply) => {
    const month = (req.params as { month: string }).month;
    const csv = buyMeCsvForMonth(month);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="buyme-${month}.csv"`);
    return csv;
  });

  // ===== Org Chart bridge =====
  // The standalone org-chart HTML (frontend/public/orgchart.html) reads/writes
  // its full employee list through these two endpoints, so any edit made in
  // the org chart UI is mirrored into the DB and shows up in the People tab.

  app.get("/api/org-chart", async () => {
    // Preserve the order set by PUT (or backfilled from the original
    // initialEmployees array). Rows with no order_index sort last.
    const rows = db
      .prepare(
        `SELECT * FROM employees
         WHERE active = 1 AND org_chart_id IS NOT NULL
         ORDER BY
           CASE WHEN org_chart_order IS NULL THEN 1 ELSE 0 END,
           org_chart_order,
           CAST(org_chart_id AS INTEGER)`,
      )
      .all() as OrgChartDbRow[];
    return rows.map(rowToOrgChartEntry);
  });

  app.put("/api/org-chart", async (req, reply) => {
    const body = req.body;
    if (!Array.isArray(body)) {
      return reply.code(400).send({ error: "expected array of employees" });
    }
    const result = applyOrgChartSync(body as OrgChartEntry[]);
    return result;
  });

  // ===== Equipment =====

  // Catalog
  app.get("/api/equipment/catalog", async (req) => {
    const all = (req.query as { all?: string }).all === "1";
    return listCatalog(all);
  });

  app.post("/api/equipment/catalog", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    if (!body.name || typeof body.name !== "string") {
      return reply.code(400).send({ error: "name required" });
    }
    return createCatalogItem({
      name: body.name as string,
      category: (body.category as EquipmentCategory) ?? "other",
      description: (body.description as string) ?? null,
      vendor: (body.vendor as string) ?? null,
      price:
        typeof body.price === "number"
          ? body.price
          : body.price
            ? Number(body.price)
            : null,
      currency: (body.currency as string) ?? "₪",
      image_url: (body.image_url as string) ?? null,
    });
  });

  app.patch("/api/equipment/catalog/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const item = getCatalogItem(id);
    if (!item) return reply.code(404).send({ error: "not found" });
    return updateCatalogItem(id, req.body as Record<string, unknown>);
  });

  // Requests
  app.get("/api/equipment/requests", async (req) => {
    const q = req.query as {
      status?: string;
      employee_id?: string;
      awaiting?: string;
    };
    const filter: ListRequestsFilter = {};
    if (q.status) filter.status = q.status as RequestStatus | "active" | "all";
    if (q.employee_id) filter.employee_id = Number(q.employee_id);
    if (q.awaiting === "manager" || q.awaiting === "exec" || q.awaiting === "any") {
      filter.awaiting = q.awaiting;
    }
    return listRequests(filter);
  });

  app.get("/api/equipment/requests/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const r = getRequest(id);
    if (!r) return reply.code(404).send({ error: "not found" });
    return r;
  });

  app.post("/api/equipment/requests", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    if (!body.employee_id || typeof body.employee_id !== "number") {
      return reply.code(400).send({ error: "employee_id required" });
    }
    if (!body.catalog_id && !body.custom_name) {
      return reply.code(400).send({ error: "catalog_id or custom_name required" });
    }
    try {
      return createRequest({
        employee_id: body.employee_id as number,
        catalog_id: (body.catalog_id as number) ?? null,
        custom_name: (body.custom_name as string) ?? null,
        quantity: (body.quantity as number) ?? 1,
        justification: (body.justification as string) ?? null,
        notes: (body.notes as string) ?? null,
        delivery_to:
          body.delivery_to === "home" || body.delivery_to === "office"
            ? body.delivery_to
            : null,
        delivery_address: (body.delivery_address as string) ?? null,
      });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.post("/api/equipment/requests/:id/manager-approve", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { decided_by?: string };
    const updated = managerApprove(id, body.decided_by ?? "Shai");
    if (!updated) return reply.code(404).send({ error: "not found or wrong status" });
    return updated;
  });

  app.post("/api/equipment/requests/:id/exec-approve", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { decided_by?: string; quote_url?: string };
    const updated = execApprove(id, body.decided_by ?? "Shai", body.quote_url ?? null);
    if (!updated) return reply.code(404).send({ error: "not found or wrong status" });
    return updated;
  });

  app.post("/api/equipment/requests/:id/reject", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { decided_by?: string; reason?: string };
    const updated = rejectRequest(
      id,
      body.decided_by ?? "Shai",
      body.reason ?? "ללא סיבה",
    );
    if (!updated) return reply.code(404).send({ error: "not found or wrong status" });
    return updated;
  });

  app.post("/api/equipment/requests/:id/order", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const updated = markOrdered(id);
    if (!updated) return reply.code(404).send({ error: "not found or wrong status" });
    return updated;
  });

  app.post("/api/equipment/requests/:id/receive", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const updated = markReceived(id);
    if (!updated) return reply.code(404).send({ error: "not found or wrong status" });
    return updated;
  });

  app.post("/api/equipment/requests/:id/quote", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = req.body as { quote_url?: string };
    if (!body?.quote_url) {
      return reply.code(400).send({ error: "quote_url required" });
    }
    const updated = attachQuote(id, body.quote_url);
    if (!updated) return reply.code(404).send({ error: "not found" });
    return updated;
  });

  // Upload an actual file (PDF/image/etc.) for a request's price quote.
  // Field name in multipart form must be "quote".
  app.post("/api/equipment/requests/:id/upload-quote", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!getRequest(id)) return reply.code(404).send({ error: "not found" });

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "no file uploaded (field name: quote)" });

    const filename = safeQuoteFilename(id, file.filename);
    const target = resolve(QUOTES_DIR, filename);
    await pipeline(file.file, createWriteStream(target));

    if (file.file.truncated) {
      return reply.code(413).send({ error: "file too large (max 10MB)" });
    }

    const url = `/api/equipment/quotes/${encodeURIComponent(filename)}`;
    const updated = attachQuote(id, url);
    return {
      ok: true,
      quote_url: url,
      filename,
      size: (await stat(target)).size,
      request: updated,
    };
  });

  // Serve uploaded quote files (download / preview in browser).
  app.get("/api/equipment/quotes/:filename", async (req, reply) => {
    const filename = (req.params as { filename: string }).filename;
    // Reject path traversal
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return reply.code(400).send({ error: "bad filename" });
    }
    const path = resolve(QUOTES_DIR, filename);
    if (!path.startsWith(QUOTES_DIR + "/") || !existsSync(path)) {
      return reply.code(404).send({ error: "not found" });
    }
    const ext = extname(filename).toLowerCase();
    const mime: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
    };
    reply.header("Content-Type", mime[ext] ?? "application/octet-stream");
    reply.header("Content-Disposition", `inline; filename="${filename}"`);
    return reply.send(createReadStream(path));
  });

  // ===== Tasks (read-only for dashboard cards) =====
  app.get("/api/tasks/open", async () => {
    return db
      .prepare(
        `SELECT * FROM items WHERE status = 'open' ORDER BY
           CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date,
           CASE priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 WHEN 'P4' THEN 4 ELSE 5 END
         LIMIT 100`,
      )
      .all();
  });
}
