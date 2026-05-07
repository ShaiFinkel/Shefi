export type AgentEventKind =
  | "message"
  | "tool_call"
  | "tool_result"
  | "handoff"
  | "system";

export interface AgentEvent {
  id: number;
  ts: string;
  agent: string;
  kind: AgentEventKind;
  content: string;
  target_agent: string | null;
  meta: Record<string, unknown> | null;
}

export type Division = "ops" | "dev" | "knowledge";

export interface AgentInfo {
  key: string;
  display: string;
  role: string;
  division: Division;
}

export interface DevTask {
  id: number;
  title: string;
  spec: string | null;
  status: string;
  assignee: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: number;
  dev_task_id: number | null;
  branch: string;
  summary: string;
  diff_text: string;
  status: "ready" | "approved" | "rejected" | "merged";
  created_at: string;
}
