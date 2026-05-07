import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
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

interface CountRow { n: number }

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
    const allowed = ["name", "name_he", "country", "type", "email", "phone", "birthday_md", "birthday_full", "amount_ils", "channel", "notes"];
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
