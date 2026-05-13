import type {
  AgentEvent,
  AgentInfo,
  BirthdayMonthData,
  CatalogItem,
  DashboardSummary,
  DevTask,
  Employee,
  EquipmentRequest,
  EquipmentRequestStatus,
  Proposal,
  TaskItem,
} from "./types";

const BASE = "";

// localStorage key where the admin token is cached on the CEO browser.
// Set via the dashboard "Admin sign-in" prompt; auto-attached to every
// admin API call. Empty/missing = no header sent (fine when ADMIN_TOKEN is
// not configured server-side).
export const ADMIN_TOKEN_KEY = "shefi_admin_token";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const adminToken =
    typeof localStorage !== "undefined" ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
  const res = await fetch(BASE + url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { "X-Admin-Token": adminToken } : {}),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    throw new Error("admin_token_required");
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  agents: () => json<AgentInfo[]>("/api/agents"),
  recentEvents: (limit = 200) => json<AgentEvent[]>(`/api/events?limit=${limit}`),
  proposals: (status?: string) =>
    json<Proposal[]>(`/api/proposals${status ? `?status=${status}` : ""}`),
  proposal: (id: number) => json<Proposal>(`/api/proposals/${id}`),
  approve: (id: number, comment?: string) =>
    json<{ ok: boolean }>(`/api/proposals/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
  reject: (id: number, comment?: string) =>
    json<{ ok: boolean }>(`/api/proposals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),
  devTasks: () => json<DevTask[]>("/api/dev-tasks"),
  chat: (message: string, target: "Shefi" | "Noam") =>
    json<{ ok: boolean }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, target }),
    }),

  // Dashboard
  summary: () => json<DashboardSummary>("/api/dashboard/summary"),
  openTasks: () => json<TaskItem[]>("/api/tasks/open"),

  // Employees
  employees: (q?: string) =>
    json<Employee[]>(`/api/employees${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  employeesAll: () => json<Employee[]>("/api/employees/all"),
  createEmployee: (data: Partial<Employee>) =>
    json<Employee>("/api/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEmployee: (id: number, data: Partial<Employee>) =>
    json<Employee>(`/api/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  departEmployee: (id: number, departure_date?: string) =>
    json<{ ok: boolean }>(`/api/employees/${id}/depart`, {
      method: "POST",
      body: JSON.stringify({ departure_date }),
    }),
  restoreEmployee: (id: number) =>
    json<{ ok: boolean }>(`/api/employees/${id}/restore`, { method: "POST" }),

  // Birthdays
  birthdaysMonth: (month: string) =>
    json<BirthdayMonthData>(`/api/birthdays/${month}`),
  createOrders: (month: string) =>
    json<{ created: number; skipped: number }>(
      `/api/birthdays/${month}/create-orders`,
      { method: "POST" },
    ),
  approveOrders: (month: string) =>
    json<{ approved: number }>(`/api/birthdays/${month}/approve`, {
      method: "POST",
    }),
  markSent: (month: string) =>
    json<{ sent: number }>(`/api/birthdays/${month}/sent`, { method: "POST" }),
  skipOrders: (month: string) =>
    json<{ skipped: number }>(`/api/birthdays/${month}/skip`, { method: "POST" }),
  csvUrl: (month: string) => `/api/birthdays/${month}/csv`,

  // Equipment
  catalog: (all = false) =>
    json<CatalogItem[]>(`/api/equipment/catalog${all ? "?all=1" : ""}`),
  createCatalogItem: (data: Partial<CatalogItem>) =>
    json<CatalogItem>("/api/equipment/catalog", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCatalogItem: (id: number, data: Partial<CatalogItem>) =>
    json<CatalogItem>(`/api/equipment/catalog/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  equipmentRequests: (params?: {
    status?: EquipmentRequestStatus | "active" | "all";
    employee_id?: number;
    awaiting?: "manager" | "exec" | "any";
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.employee_id) q.set("employee_id", String(params.employee_id));
    if (params?.awaiting) q.set("awaiting", params.awaiting);
    const qs = q.toString();
    return json<EquipmentRequest[]>(`/api/equipment/requests${qs ? "?" + qs : ""}`);
  },
  createEquipmentRequest: (data: {
    employee_id: number;
    catalog_id?: number;
    custom_name?: string;
    quantity?: number;
    justification?: string;
    delivery_to?: "office" | "home";
    delivery_address?: string;
  }) =>
    json<EquipmentRequest>("/api/equipment/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  managerApproveRequest: (id: number) =>
    json<EquipmentRequest>(`/api/equipment/requests/${id}/manager-approve`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  execApproveRequest: (id: number, quote_url?: string) =>
    json<EquipmentRequest>(`/api/equipment/requests/${id}/exec-approve`, {
      method: "POST",
      body: JSON.stringify({ quote_url }),
    }),
  rejectRequest: (id: number, reason: string) =>
    json<EquipmentRequest>(`/api/equipment/requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  markRequestOrdered: (id: number) =>
    json<EquipmentRequest>(`/api/equipment/requests/${id}/order`, { method: "POST" }),
  markRequestReceived: (id: number) =>
    json<EquipmentRequest>(`/api/equipment/requests/${id}/receive`, { method: "POST" }),
  attachQuote: (id: number, quote_url: string) =>
    json<EquipmentRequest>(`/api/equipment/requests/${id}/quote`, {
      method: "POST",
      body: JSON.stringify({ quote_url }),
    }),
  uploadQuote: async (id: number, file: File): Promise<EquipmentRequest> => {
    const fd = new FormData();
    fd.append("quote", file, file.name);
    const adminToken =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ADMIN_TOKEN_KEY)
        : null;
    const res = await fetch(`/api/equipment/requests/${id}/upload-quote`, {
      method: "POST",
      credentials: "include",
      headers: adminToken ? { "X-Admin-Token": adminToken } : undefined,
      body: fd,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = (await res.json()) as { request: EquipmentRequest };
    return data.request;
  },
};

export function connectWS(
  onSnapshot: (events: AgentEvent[]) => void,
  onEvent: (event: AgentEvent) => void,
): WebSocket {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as
        | { type: "snapshot"; events: AgentEvent[] }
        | { type: "event"; event: AgentEvent };
      if (data.type === "snapshot") onSnapshot(data.events);
      else onEvent(data.event);
    } catch (e) {
      console.error("ws parse failed", e);
    }
  };
  return ws;
}
