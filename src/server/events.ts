import EventEmitter from "eventemitter3";
import { db } from "../db/client.js";

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

export interface NewAgentEvent {
  agent: string;
  kind: AgentEventKind;
  content: string;
  target_agent?: string | null;
  meta?: Record<string, unknown> | null;
}

class EventBus extends EventEmitter<{ event: (e: AgentEvent) => void }> {
  private insertStmt = db.prepare(`
    INSERT INTO agent_events (agent, kind, content, target_agent, meta)
    VALUES (@agent, @kind, @content, @target_agent, @meta)
    RETURNING *
  `);

  emitEvent(input: NewAgentEvent): AgentEvent {
    const row = this.insertStmt.get({
      agent: input.agent,
      kind: input.kind,
      content: input.content,
      target_agent: input.target_agent ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    }) as Omit<AgentEvent, "meta"> & { meta: string | null };

    const event: AgentEvent = {
      ...row,
      meta: row.meta ? (JSON.parse(row.meta) as Record<string, unknown>) : null,
    };
    this.emit("event", event);
    return event;
  }

  recent(limit = 200): AgentEvent[] {
    const rows = db
      .prepare(
        `SELECT * FROM agent_events ORDER BY id DESC LIMIT ?`,
      )
      .all(limit) as (Omit<AgentEvent, "meta"> & { meta: string | null })[];
    return rows.reverse().map((r) => ({
      ...r,
      meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : null,
    }));
  }

  since(sinceId: number, limit = 500): AgentEvent[] {
    const rows = db
      .prepare(
        `SELECT * FROM agent_events WHERE id > ? ORDER BY id ASC LIMIT ?`,
      )
      .all(sinceId, limit) as (Omit<AgentEvent, "meta"> & { meta: string | null })[];
    return rows.map((r) => ({
      ...r,
      meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : null,
    }));
  }
}

export const eventBus = new EventBus();
