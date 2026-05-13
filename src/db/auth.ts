// Authentication primitives for the employee portal.
// Two short-lived stores:
//   - email_tokens: one-time magic-link tokens (expire in ~30 min, single-use)
//   - employee_sessions: long-lived session cookies (expire in ~30 days)

import crypto from "node:crypto";
import { db } from "./client.js";
import type { Employee } from "./employees.js";

// ===== Constants =====

export const MAGIC_LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE_NAME = "shefi_session";

// ===== Types =====

export interface EmailToken {
  id: number;
  token: string;
  employee_id: number;
  email: string;
  expires_at: string;
  used_at: string | null;
  ip: string | null;
  created_at: string;
}

export interface EmployeeSession {
  id: number;
  token: string;
  employee_id: number;
  expires_at: string;
  user_agent: string | null;
  last_seen_at: string;
  created_at: string;
}

// ===== Random token generator =====

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function isoFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

// ===== Magic links =====

export function findEmployeeByEmail(email: string): Employee | undefined {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return undefined;
  // Case-insensitive comparison; many emails were entered with mixed case.
  return db
    .prepare(`SELECT * FROM employees WHERE LOWER(email) = ? AND active = 1`)
    .get(trimmed) as Employee | undefined;
}

export function createEmailToken(input: {
  employee_id: number;
  email: string;
  ip?: string | null;
}): EmailToken {
  const stmt = db.prepare(`
    INSERT INTO email_tokens (token, employee_id, email, expires_at, ip)
    VALUES (@token, @employee_id, @email, @expires_at, @ip)
    RETURNING *
  `);
  return stmt.get({
    token: randomToken(24),
    employee_id: input.employee_id,
    email: input.email,
    expires_at: isoFromNow(MAGIC_LINK_TTL_MS),
    ip: input.ip ?? null,
  }) as EmailToken;
}

export function consumeEmailToken(token: string): EmailToken | null {
  const row = db
    .prepare(`SELECT * FROM email_tokens WHERE token = ?`)
    .get(token) as EmailToken | undefined;
  if (!row) return null;
  if (row.used_at) return null; // single-use enforced
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  db.prepare(
    `UPDATE email_tokens SET used_at = datetime('now') WHERE id = ?`,
  ).run(row.id);
  return row;
}

// ===== Sessions =====

export function createSession(input: {
  employee_id: number;
  user_agent?: string | null;
}): EmployeeSession {
  const stmt = db.prepare(`
    INSERT INTO employee_sessions (token, employee_id, expires_at, user_agent)
    VALUES (@token, @employee_id, @expires_at, @user_agent)
    RETURNING *
  `);
  return stmt.get({
    token: randomToken(32),
    employee_id: input.employee_id,
    expires_at: isoFromNow(SESSION_TTL_MS),
    user_agent: input.user_agent ?? null,
  }) as EmployeeSession;
}

export function findSessionWithEmployee(
  token: string,
): { session: EmployeeSession; employee: Employee } | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.*, e.id AS e_id
       FROM employee_sessions s
       JOIN employees e ON e.id = s.employee_id
       WHERE s.token = ? AND e.active = 1`,
    )
    .get(token) as (EmployeeSession & { e_id: number }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM employee_sessions WHERE id = ?`).run(row.id);
    return null;
  }
  // Touch last_seen_at (cheap; SQLite WAL handles this fine)
  db.prepare(
    `UPDATE employee_sessions SET last_seen_at = datetime('now') WHERE id = ?`,
  ).run(row.id);
  const employee = db
    .prepare(`SELECT * FROM employees WHERE id = ?`)
    .get(row.employee_id) as Employee;
  return {
    session: {
      id: row.id,
      token: row.token,
      employee_id: row.employee_id,
      expires_at: row.expires_at,
      user_agent: row.user_agent,
      last_seen_at: row.last_seen_at,
      created_at: row.created_at,
    },
    employee,
  };
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM employee_sessions WHERE token = ?`).run(token);
}

// ===== Approval tokens (emailed one-click links) =====

export const APPROVAL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type ApprovalAction = "approve" | "reject";

export interface ApprovalToken {
  id: number;
  token: string;
  request_id: number;
  manager_employee_id: number;
  action: ApprovalAction;
  expires_at: string;
  used_at: string | null;
  used_ip: string | null;
  reason: string | null;
  created_at: string;
}

/**
 * Issues an approve+reject token pair for one request, returned as plain
 * URL-safe strings. Both share the same TTL.
 */
export function createApprovalTokens(input: {
  request_id: number;
  manager_employee_id: number;
}): { approve: string; reject: string } {
  const expires = isoFromNow(APPROVAL_TOKEN_TTL_MS);
  const stmt = db.prepare(`
    INSERT INTO approval_tokens (token, request_id, manager_employee_id, action, expires_at)
    VALUES (@token, @request_id, @manager_employee_id, @action, @expires_at)
  `);
  const tx = db.transaction(() => {
    const approve = randomToken(24);
    const reject = randomToken(24);
    stmt.run({
      token: approve,
      request_id: input.request_id,
      manager_employee_id: input.manager_employee_id,
      action: "approve",
      expires_at: expires,
    });
    stmt.run({
      token: reject,
      request_id: input.request_id,
      manager_employee_id: input.manager_employee_id,
      action: "reject",
      expires_at: expires,
    });
    return { approve, reject };
  });
  return tx();
}

/**
 * Looks up a token without consuming it (used when rendering the reject
 * form so the form can re-submit the same token on POST).
 */
export function findApprovalToken(token: string): ApprovalToken | null {
  if (!token) return null;
  const row = db
    .prepare(`SELECT * FROM approval_tokens WHERE token = ?`)
    .get(token) as ApprovalToken | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

/**
 * Single-use consume. Returns the row on success, or null if missing /
 * expired / already used.
 */
export function consumeApprovalToken(input: {
  token: string;
  ip?: string | null;
  reason?: string | null;
}): ApprovalToken | null {
  const row = findApprovalToken(input.token);
  if (!row) return null;
  if (row.used_at) return null;
  db.prepare(
    `UPDATE approval_tokens
       SET used_at = datetime('now'),
           used_ip = ?,
           reason = ?
     WHERE id = ?`,
  ).run(input.ip ?? null, input.reason ?? null, row.id);
  return row;
}

// ===== Maintenance =====

export function cleanupExpiredAuth(): { tokens: number; sessions: number; approvals: number } {
  const tokens = db
    .prepare(`DELETE FROM email_tokens WHERE expires_at < datetime('now', '-1 day')`)
    .run().changes;
  const sessions = db
    .prepare(`DELETE FROM employee_sessions WHERE expires_at < datetime('now')`)
    .run().changes;
  const approvals = db
    .prepare(`DELETE FROM approval_tokens WHERE expires_at < datetime('now', '-1 day')`)
    .run().changes;
  return { tokens, sessions, approvals };
}
