import type {
  AgentEvent,
  AgentInfo,
  BirthdayMonthData,
  DashboardSummary,
  DevTask,
  Employee,
  Proposal,
  TaskItem,
} from "./types";

const BASE = "";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
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
