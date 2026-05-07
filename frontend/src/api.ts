import type { AgentEvent, AgentInfo, DevTask, Proposal } from "./types";

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
