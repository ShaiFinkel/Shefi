// API client for the employee PWA. Uses the session cookie (httpOnly) that
// the server sets after a successful magic-link verification.

import type { CatalogItem, EquipmentRequest } from "./types";

export interface EmployeeMe {
  id: number;
  name: string;
  name_he: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  manager_name: string | null;
  address: string | null;
  birthday_md: string | null;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (res.status === 401) {
    const e = new Error("not_authenticated");
    (e as Error & { code?: string }).code = "not_authenticated";
    throw e;
  }
  if (!res.ok) {
    let body: { error?: string } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const employeeApi = {
  me: () => json<EmployeeMe>("/api/auth/me"),
  requestMagicLink: (email: string) =>
    json<{ ok: boolean; sent: boolean; dev_link?: string }>(
      "/api/auth/request-magic-link",
      { method: "POST", body: JSON.stringify({ email }) },
    ),
  logout: () => json<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  catalog: () => json<CatalogItem[]>("/api/employee/catalog"),
  myRequests: () => json<EquipmentRequest[]>("/api/employee/requests"),
  createRequest: (data: {
    catalog_id?: number;
    custom_name?: string;
    quantity?: number;
    justification?: string;
    delivery_to?: "office" | "home";
    delivery_address?: string;
  }) =>
    json<EquipmentRequest>("/api/employee/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ===== Manager actions =====
  isManager: () =>
    json<{ is_manager: boolean; reports_count: number; pending_count: number }>(
      "/api/employee/is-manager",
    ),
  pendingApprovals: () => json<EquipmentRequest[]>("/api/employee/pending-approvals"),
  managerApprove: (id: number) =>
    json<EquipmentRequest>(`/api/employee/requests/${id}/manager-approve`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  managerReject: (id: number, reason: string) =>
    json<EquipmentRequest>(`/api/employee/requests/${id}/manager-reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
