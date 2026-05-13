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

// ===== Maintenance =====

export function cleanupExpiredAuth(): { tokens: number; sessions: number } {
  const tokens = db
    .prepare(`DELETE FROM email_tokens WHERE expires_at < datetime('now', '-1 day')`)
    .run().changes;
  const sessions = db
    .prepare(`DELETE FROM employee_sessions WHERE expires_at < datetime('now')`)
    .run().changes;
  return { tokens, sessions };
}
