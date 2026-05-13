import { db } from "./client.js";

export type EquipmentCategory =
  | "laptop"
  | "monitor"
  | "chair"
  | "accessory"
  | "software"
  | "phone"
  | "other";

export type RequestStatus =
  | "pending"
  | "manager_approved"
  | "exec_approved"
  | "ordered"
  | "received"
  | "rejected";

export interface CatalogItem {
  id: number;
  name: string;
  category: EquipmentCategory;
  description: string | null;
  vendor: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export type DeliveryTo = "office" | "home";

export interface EquipmentRequest {
  id: number;
  employee_id: number;
  catalog_id: number | null;
  custom_name: string | null;
  quantity: number;
  justification: string | null;
  status: RequestStatus;
  manager_decision_by: string | null;
  manager_decision_at: string | null;
  exec_decision_by: string | null;
  exec_decision_at: string | null;
  quote_url: string | null;
  rejected_reason: string | null;
  ordered_at: string | null;
  received_at: string | null;
  delivery_to: DeliveryTo | null;
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentRequestEnriched extends EquipmentRequest {
  employee_name: string;
  employee_department: string | null;
  employee_manager_name: string | null;
  employee_home_address: string | null;
  catalog_name: string | null;
  catalog_category: EquipmentCategory | null;
  catalog_price: number | null;
  catalog_currency: string | null;
  display_name: string;
}

// ===== Catalog CRUD =====

export interface UpsertCatalogInput {
  name: string;
  category?: EquipmentCategory;
  description?: string | null;
  vendor?: string | null;
  price?: number | null;
  currency?: string;
  image_url?: string | null;
}

export function listCatalog(includeInactive = false): CatalogItem[] {
  const sql = includeInactive
    ? `SELECT * FROM equipment_catalog ORDER BY active DESC, category, name`
    : `SELECT * FROM equipment_catalog WHERE active = 1 ORDER BY category, name`;
  return db.prepare(sql).all() as CatalogItem[];
}

export function getCatalogItem(id: number): CatalogItem | undefined {
  return db.prepare(`SELECT * FROM equipment_catalog WHERE id = ?`).get(id) as
    | CatalogItem
    | undefined;
}

export function createCatalogItem(input: UpsertCatalogInput): CatalogItem {
  const stmt = db.prepare(`
    INSERT INTO equipment_catalog (name, category, description, vendor, price, currency, image_url)
    VALUES (@name, @category, @description, @vendor, @price, @currency, @image_url)
    RETURNING *
  `);
  return stmt.get({
    name: input.name,
    category: input.category ?? "other",
    description: input.description ?? null,
    vendor: input.vendor ?? null,
    price: input.price ?? null,
    currency: input.currency ?? "₪",
    image_url: input.image_url ?? null,
  }) as CatalogItem;
}

export function updateCatalogItem(
  id: number,
  patch: Partial<UpsertCatalogInput> & { active?: number },
): CatalogItem | undefined {
  const allowed = [
    "name",
    "category",
    "description",
    "vendor",
    "price",
    "currency",
    "image_url",
    "active",
  ] as const;
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const k of allowed) {
    if (k in patch) {
      updates.push(`${k} = ?`);
      values.push((patch as Record<string, unknown>)[k]);
    }
  }
  if (!updates.length) return getCatalogItem(id);
  values.push(id);
  db.prepare(
    `UPDATE equipment_catalog SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
  ).run(...values);
  return getCatalogItem(id);
}

// ===== Requests =====

export interface CreateRequestInput {
  employee_id: number;
  catalog_id?: number | null;
  custom_name?: string | null;
  quantity?: number;
  justification?: string | null;
  notes?: string | null;
  delivery_to?: DeliveryTo | null;
  delivery_address?: string | null;
}

export function createRequest(input: CreateRequestInput): EquipmentRequest {
  if (!input.catalog_id && !input.custom_name) {
    throw new Error("either catalog_id or custom_name is required");
  }
  if (input.delivery_to === "home" && !input.delivery_address?.trim()) {
    throw new Error("delivery_address is required when delivery_to='home'");
  }
  const stmt = db.prepare(`
    INSERT INTO equipment_requests
      (employee_id, catalog_id, custom_name, quantity, justification, notes, delivery_to, delivery_address)
    VALUES (@employee_id, @catalog_id, @custom_name, @quantity, @justification, @notes, @delivery_to, @delivery_address)
    RETURNING *
  `);
  return stmt.get({
    employee_id: input.employee_id,
    catalog_id: input.catalog_id ?? null,
    custom_name: input.custom_name ?? null,
    quantity: input.quantity ?? 1,
    justification: input.justification ?? null,
    notes: input.notes ?? null,
    delivery_to: input.delivery_to ?? null,
    delivery_address:
      input.delivery_to === "home" ? input.delivery_address?.trim() ?? null : null,
  }) as EquipmentRequest;
}

const ENRICHED_SELECT = `
  SELECT r.*,
         e.name AS employee_name,
         e.department AS employee_department,
         e.manager_name AS employee_manager_name,
         e.address AS employee_home_address,
         c.name AS catalog_name,
         c.category AS catalog_category,
         c.price AS catalog_price,
         c.currency AS catalog_currency,
         COALESCE(c.name, r.custom_name) AS display_name
  FROM equipment_requests r
  JOIN employees e ON e.id = r.employee_id
  LEFT JOIN equipment_catalog c ON c.id = r.catalog_id
`;

export function getRequest(id: number): EquipmentRequestEnriched | undefined {
  return db.prepare(`${ENRICHED_SELECT} WHERE r.id = ?`).get(id) as
    | EquipmentRequestEnriched
    | undefined;
}

export interface ListRequestsFilter {
  status?: RequestStatus | "active" | "all";
  employee_id?: number;
  awaiting?: "manager" | "exec" | "any";
}

export function listRequests(filter: ListRequestsFilter = {}): EquipmentRequestEnriched[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.status && filter.status !== "all") {
    if (filter.status === "active") {
      where.push(`r.status NOT IN ('rejected','received')`);
    } else {
      where.push(`r.status = ?`);
      params.push(filter.status);
    }
  }

  if (filter.employee_id) {
    where.push(`r.employee_id = ?`);
    params.push(filter.employee_id);
  }

  if (filter.awaiting === "manager") where.push(`r.status = 'pending'`);
  if (filter.awaiting === "exec") where.push(`r.status = 'manager_approved'`);
  if (filter.awaiting === "any")
    where.push(`r.status IN ('pending','manager_approved')`);

  const sql = `${ENRICHED_SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY r.created_at DESC`;
  return db.prepare(sql).all(...params) as EquipmentRequestEnriched[];
}

// Two-stage approval

export function managerApprove(
  id: number,
  decidedBy: string,
): EquipmentRequest | undefined {
  db.prepare(
    `UPDATE equipment_requests
     SET status = 'manager_approved',
         manager_decision_by = ?,
         manager_decision_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ? AND status = 'pending'`,
  ).run(decidedBy, id);
  return db.prepare(`SELECT * FROM equipment_requests WHERE id = ?`).get(id) as
    | EquipmentRequest
    | undefined;
}

export function execApprove(
  id: number,
  decidedBy: string,
  quoteUrl?: string | null,
): EquipmentRequest | undefined {
  db.prepare(
    `UPDATE equipment_requests
     SET status = 'exec_approved',
         exec_decision_by = ?,
         exec_decision_at = datetime('now'),
         quote_url = COALESCE(?, quote_url),
         updated_at = datetime('now')
     WHERE id = ? AND status IN ('manager_approved','pending')`,
  ).run(decidedBy, quoteUrl ?? null, id);
  return db.prepare(`SELECT * FROM equipment_requests WHERE id = ?`).get(id) as
    | EquipmentRequest
    | undefined;
}

export function reject(
  id: number,
  decidedBy: string,
  reason: string,
): EquipmentRequest | undefined {
  // Stamps both manager and exec fields with the rejector for clarity
  db.prepare(
    `UPDATE equipment_requests
     SET status = 'rejected',
         rejected_reason = ?,
         exec_decision_by = COALESCE(exec_decision_by, ?),
         exec_decision_at = COALESCE(exec_decision_at, datetime('now')),
         updated_at = datetime('now')
     WHERE id = ? AND status NOT IN ('rejected','received')`,
  ).run(reason, decidedBy, id);
  return db.prepare(`SELECT * FROM equipment_requests WHERE id = ?`).get(id) as
    | EquipmentRequest
    | undefined;
}

export function markOrdered(id: number): EquipmentRequest | undefined {
  db.prepare(
    `UPDATE equipment_requests
     SET status = 'ordered', ordered_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND status = 'exec_approved'`,
  ).run(id);
  return db.prepare(`SELECT * FROM equipment_requests WHERE id = ?`).get(id) as
    | EquipmentRequest
    | undefined;
}

export function markReceived(id: number): EquipmentRequest | undefined {
  db.prepare(
    `UPDATE equipment_requests
     SET status = 'received', received_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND status IN ('ordered','exec_approved')`,
  ).run(id);
  return db.prepare(`SELECT * FROM equipment_requests WHERE id = ?`).get(id) as
    | EquipmentRequest
    | undefined;
}

export function attachQuote(id: number, quoteUrl: string): EquipmentRequest | undefined {
  db.prepare(
    `UPDATE equipment_requests SET quote_url = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(quoteUrl, id);
  return db.prepare(`SELECT * FROM equipment_requests WHERE id = ?`).get(id) as
    | EquipmentRequest
    | undefined;
}

export function counts(): {
  awaiting_manager: number;
  awaiting_exec: number;
  approved: number;
  ordered: number;
} {
  const c = (sql: string) =>
    (db.prepare(sql).get() as { n: number }).n;
  return {
    awaiting_manager: c(
      `SELECT COUNT(*) AS n FROM equipment_requests WHERE status = 'pending'`,
    ),
    awaiting_exec: c(
      `SELECT COUNT(*) AS n FROM equipment_requests WHERE status = 'manager_approved'`,
    ),
    approved: c(
      `SELECT COUNT(*) AS n FROM equipment_requests WHERE status = 'exec_approved'`,
    ),
    ordered: c(
      `SELECT COUNT(*) AS n FROM equipment_requests WHERE status = 'ordered'`,
    ),
  };
}
