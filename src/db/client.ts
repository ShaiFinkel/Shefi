import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "../lib/env.js";
import { schemaSql } from "./schema.js";

export type ItemKind = "task" | "idea" | "note";
export type Priority = "P1" | "P2" | "P3" | "P4";
export type Status = "open" | "done" | "archived";

export interface Item {
  id: number;
  kind: ItemKind;
  title: string;
  details: string | null;
  priority: Priority | null;
  status: Status;
  due_date: string | null;
  source: string;
  raw_input: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface Reminder {
  id: number;
  item_id: number | null;
  remind_at: string;
  message: string | null;
  sent: number;
  created_at: string;
}

export interface Memory {
  id: number;
  item_id: number | null;
  text: string;
  embedding: string;
  created_at: string;
}

const dbPath = resolve(process.cwd(), env.DB_PATH);
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(schemaSql);

// ---------- Items ----------

export interface CreateItemInput {
  kind: ItemKind;
  title: string;
  details?: string | null;
  priority?: Priority | null;
  due_date?: string | null;
  source?: string;
  raw_input?: string | null;
}

export function createItem(input: CreateItemInput): Item {
  const stmt = db.prepare(`
    INSERT INTO items (kind, title, details, priority, due_date, source, raw_input)
    VALUES (@kind, @title, @details, @priority, @due_date, @source, @raw_input)
    RETURNING *
  `);
  return stmt.get({
    kind: input.kind,
    title: input.title,
    details: input.details ?? null,
    priority: input.priority ?? null,
    due_date: input.due_date ?? null,
    source: input.source ?? "telegram",
    raw_input: input.raw_input ?? null,
  }) as Item;
}

export function getItem(id: number): Item | undefined {
  return db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as
    | Item
    | undefined;
}

export function listOpenItems(limit = 50): Item[] {
  return db
    .prepare(
      `SELECT * FROM items WHERE status = 'open'
       ORDER BY
         CASE priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 WHEN 'P4' THEN 4 ELSE 5 END,
         CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date,
         created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Item[];
}

export function listItemsForToday(): Item[] {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .prepare(
      `SELECT * FROM items WHERE status = 'open' AND (due_date <= ? OR due_date IS NULL)
       ORDER BY
         CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date,
         CASE priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 WHEN 'P4' THEN 4 ELSE 5 END`,
    )
    .all(today) as Item[];
}

export function listOverdueItems(): Item[] {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .prepare(
      `SELECT * FROM items WHERE status = 'open' AND due_date IS NOT NULL AND due_date < ?
       ORDER BY due_date`,
    )
    .all(today) as Item[];
}

export function listClosedSince(sinceIso: string): Item[] {
  return db
    .prepare(
      `SELECT * FROM items WHERE status = 'done' AND closed_at >= ?
       ORDER BY closed_at DESC`,
    )
    .all(sinceIso) as Item[];
}

export function closeItem(id: number): Item | undefined {
  const stmt = db.prepare(`
    UPDATE items
    SET status = 'done', closed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND status = 'open'
    RETURNING *
  `);
  return stmt.get(id) as Item | undefined;
}

export function updatePriority(id: number, priority: Priority): Item | undefined {
  const stmt = db.prepare(`
    UPDATE items SET priority = ?, updated_at = datetime('now')
    WHERE id = ? RETURNING *
  `);
  return stmt.get(priority, id) as Item | undefined;
}

export function updateDueDate(id: number, dueDate: string | null): Item | undefined {
  const stmt = db.prepare(`
    UPDATE items SET due_date = ?, updated_at = datetime('now')
    WHERE id = ? RETURNING *
  `);
  return stmt.get(dueDate, id) as Item | undefined;
}

// ---------- Reminders ----------

export function createReminder(input: {
  item_id?: number | null;
  remind_at: string;
  message?: string | null;
}): Reminder {
  const stmt = db.prepare(`
    INSERT INTO reminders (item_id, remind_at, message)
    VALUES (@item_id, @remind_at, @message)
    RETURNING *
  `);
  return stmt.get({
    item_id: input.item_id ?? null,
    remind_at: input.remind_at,
    message: input.message ?? null,
  }) as Reminder;
}

export function pendingRemindersDue(nowIso: string): Reminder[] {
  return db
    .prepare(
      `SELECT * FROM reminders WHERE sent = 0 AND remind_at <= ? ORDER BY remind_at`,
    )
    .all(nowIso) as Reminder[];
}

export function markReminderSent(id: number): void {
  db.prepare(`UPDATE reminders SET sent = 1 WHERE id = ?`).run(id);
}

// ---------- Memories ----------

export function saveMemory(input: {
  item_id?: number | null;
  text: string;
  embedding: number[];
}): Memory {
  const stmt = db.prepare(`
    INSERT INTO memories (item_id, text, embedding)
    VALUES (@item_id, @text, @embedding)
    RETURNING *
  `);
  return stmt.get({
    item_id: input.item_id ?? null,
    text: input.text,
    embedding: JSON.stringify(input.embedding),
  }) as Memory;
}

export function allMemories(): Memory[] {
  return db.prepare(`SELECT * FROM memories ORDER BY created_at DESC`).all() as Memory[];
}
