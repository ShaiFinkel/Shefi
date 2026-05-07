import { db } from "../db/client.js";

export type DevTaskStatus =
  | "spec"
  | "in_progress"
  | "review"
  | "merged"
  | "rejected"
  | "cancelled";

export type ProposalStatus = "ready" | "approved" | "rejected" | "merged";

export interface DevTask {
  id: number;
  title: string;
  spec: string | null;
  status: DevTaskStatus;
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
  status: ProposalStatus;
  created_at: string;
}

export interface Approval {
  id: number;
  proposal_id: number;
  decision: "approve" | "reject" | "comment";
  comment: string | null;
  decided_at: string;
}

// ===== Dev Tasks =====

export function createDevTask(input: {
  title: string;
  spec?: string;
  created_by?: string;
  assignee?: string;
}): DevTask {
  const stmt = db.prepare(`
    INSERT INTO dev_tasks (title, spec, created_by, assignee)
    VALUES (@title, @spec, @created_by, @assignee)
    RETURNING *
  `);
  return stmt.get({
    title: input.title,
    spec: input.spec ?? null,
    created_by: input.created_by ?? "CEO",
    assignee: input.assignee ?? null,
  }) as DevTask;
}

export function listDevTasks(): DevTask[] {
  return db
    .prepare(`SELECT * FROM dev_tasks ORDER BY id DESC LIMIT 100`)
    .all() as DevTask[];
}

export function getDevTask(id: number): DevTask | undefined {
  return db.prepare(`SELECT * FROM dev_tasks WHERE id = ?`).get(id) as
    | DevTask
    | undefined;
}

export function setDevTaskStatus(id: number, status: DevTaskStatus): void {
  db.prepare(
    `UPDATE dev_tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(status, id);
}

export function setDevTaskAssignee(id: number, assignee: string): void {
  db.prepare(
    `UPDATE dev_tasks SET assignee = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(assignee, id);
}

// ===== Proposals =====

export function createProposal(input: {
  dev_task_id: number | null;
  branch: string;
  summary: string;
  diff_text: string;
}): Proposal {
  const stmt = db.prepare(`
    INSERT INTO proposals (dev_task_id, branch, summary, diff_text)
    VALUES (@dev_task_id, @branch, @summary, @diff_text)
    RETURNING *
  `);
  return stmt.get(input) as Proposal;
}

export function listProposals(status?: string): Proposal[] {
  if (status) {
    return db
      .prepare(`SELECT * FROM proposals WHERE status = ? ORDER BY id DESC`)
      .all(status) as Proposal[];
  }
  return db
    .prepare(`SELECT * FROM proposals ORDER BY id DESC LIMIT 100`)
    .all() as Proposal[];
}

export function getProposal(id: number): Proposal | undefined {
  return db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(id) as
    | Proposal
    | undefined;
}

export function setProposalStatus(id: number, status: ProposalStatus): void {
  db.prepare(`UPDATE proposals SET status = ? WHERE id = ?`).run(status, id);
}

export function recordApproval(
  proposalId: number,
  decision: "approve" | "reject" | "comment",
  comment: string | null,
): Approval {
  const stmt = db.prepare(`
    INSERT INTO approvals (proposal_id, decision, comment)
    VALUES (?, ?, ?)
    RETURNING *
  `);
  return stmt.get(proposalId, decision, comment) as Approval;
}
