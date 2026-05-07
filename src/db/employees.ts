import { db } from "./client.js";

export type Channel =
  | "buyme"
  | "amazon_au"
  | "amazon_us"
  | "amazon_ca"
  | "manual";

export type OrderStatus =
  | "pending"
  | "approved"
  | "sent"
  | "skipped"
  | "failed";

export interface Employee {
  id: number;
  name: string;
  name_he: string | null;
  country: string | null;
  type: string | null;
  email: string | null;
  phone: string | null;
  birthday_md: string | null;
  birthday_full: string | null;
  amount_ils: number;
  channel: Channel;
  notes: string | null;
  active: number;
  departed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BirthdayOrder {
  id: number;
  employee_id: number;
  month: string;
  send_date: string;
  channel: Channel;
  amount_ils: number;
  status: OrderStatus;
  approved_at: string | null;
  sent_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface UpsertEmployeeInput {
  name: string;
  name_he?: string | null;
  country?: string | null;
  type?: string | null;
  email?: string | null;
  phone?: string | null;
  birthday_md?: string | null;
  birthday_full?: string | null;
  amount_ils?: number;
  channel?: Channel;
  notes?: string | null;
}

const upsertStmt = db.prepare(`
  INSERT INTO employees (name, name_he, country, type, email, phone, birthday_md, birthday_full, amount_ils, channel, notes)
  VALUES (@name, @name_he, @country, @type, @email, @phone, @birthday_md, @birthday_full, @amount_ils, @channel, @notes)
  ON CONFLICT(name) DO UPDATE SET
    name_he = excluded.name_he,
    country = excluded.country,
    type = excluded.type,
    email = excluded.email,
    phone = excluded.phone,
    birthday_md = excluded.birthday_md,
    birthday_full = excluded.birthday_full,
    amount_ils = excluded.amount_ils,
    channel = excluded.channel,
    notes = excluded.notes,
    updated_at = datetime('now')
  RETURNING *
`);

export function upsertEmployee(input: UpsertEmployeeInput): Employee {
  return upsertStmt.get({
    name: input.name,
    name_he: input.name_he ?? null,
    country: input.country ?? null,
    type: input.type ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    birthday_md: input.birthday_md ?? null,
    birthday_full: input.birthday_full ?? null,
    amount_ils: input.amount_ils ?? 300,
    channel: input.channel ?? "buyme",
    notes: input.notes ?? null,
  }) as Employee;
}

export function getEmployeeById(id: number): Employee | undefined {
  return db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id) as
    | Employee
    | undefined;
}

export function findEmployeesByQuery(query: string): Employee[] {
  const like = `%${query.trim()}%`;
  return db
    .prepare(
      `SELECT * FROM employees
       WHERE active = 1
         AND (name LIKE ? COLLATE NOCASE OR name_he LIKE ? OR email LIKE ? COLLATE NOCASE)
       ORDER BY name LIMIT 20`,
    )
    .all(like, like, like) as Employee[];
}

export function listActiveEmployees(): Employee[] {
  return db
    .prepare(`SELECT * FROM employees WHERE active = 1 ORDER BY birthday_md`)
    .all() as Employee[];
}

export function listEmployeesByMonth(monthMM: string): Employee[] {
  // monthMM: "MM" e.g. "06"
  // Only "real" employees get gifts — Contractors are excluded by user policy.
  return db
    .prepare(
      `SELECT * FROM employees
       WHERE active = 1
         AND birthday_md LIKE ? || '-%'
         AND type LIKE 'Employee%'
       ORDER BY birthday_md`,
    )
    .all(monthMM) as Employee[];
}

export function markDeparted(employeeId: number, departedAt: string): void {
  db.prepare(
    `UPDATE employees SET active = 0, departed_at = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(departedAt, employeeId);
}

// ---------- Birthday orders ----------

const insertOrderStmt = db.prepare(`
  INSERT INTO birthday_orders (employee_id, month, send_date, channel, amount_ils, status, notes)
  VALUES (@employee_id, @month, @send_date, @channel, @amount_ils, 'pending', @notes)
  ON CONFLICT(employee_id, month) DO NOTHING
  RETURNING *
`);

export interface CreateOrderInput {
  employee_id: number;
  month: string;
  send_date: string;
  channel: Channel;
  amount_ils: number;
  notes?: string | null;
}

export function createOrder(input: CreateOrderInput): BirthdayOrder | undefined {
  return insertOrderStmt.get({
    employee_id: input.employee_id,
    month: input.month,
    send_date: input.send_date,
    channel: input.channel,
    amount_ils: input.amount_ils,
    notes: input.notes ?? null,
  }) as BirthdayOrder | undefined;
}

export function listOrdersForMonth(month: string): (BirthdayOrder & {
  employee_name: string;
  employee_country: string | null;
  employee_email: string | null;
  employee_phone: string | null;
})[] {
  return db
    .prepare(
      `SELECT bo.*,
              e.name AS employee_name,
              e.country AS employee_country,
              e.email AS employee_email,
              e.phone AS employee_phone
       FROM birthday_orders bo
       JOIN employees e ON e.id = bo.employee_id
       WHERE bo.month = ?
       ORDER BY bo.send_date, e.name`,
    )
    .all(month) as never;
}

export function approveOrdersForMonth(month: string): number {
  const res = db
    .prepare(
      `UPDATE birthday_orders SET status = 'approved', approved_at = datetime('now')
       WHERE month = ? AND status = 'pending'`,
    )
    .run(month);
  return res.changes;
}

export function markOrdersSentForMonth(month: string): number {
  const res = db
    .prepare(
      `UPDATE birthday_orders SET status = 'sent', sent_at = datetime('now')
       WHERE month = ? AND status = 'approved'`,
    )
    .run(month);
  return res.changes;
}

export function skipOrdersForMonth(month: string): number {
  const res = db
    .prepare(
      `UPDATE birthday_orders SET status = 'skipped' WHERE month = ? AND status = 'pending'`,
    )
    .run(month);
  return res.changes;
}
