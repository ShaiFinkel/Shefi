import { tool } from "@openai/agents";
import { z } from "zod";
import { db } from "../../db/client.js";

interface RecordRow {
  id: number;
  agent: string;
  category: string;
  title: string;
  body: string | null;
  data: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function makeRecordTools(agentName: string, defaultCategory: string) {
  const addRecord = tool({
    name: `${defaultCategory}_add`,
    description: `שומר רשומה חדשה בקטגוריית ${defaultCategory}.`,
    parameters: z.object({
      title: z.string(),
      body: z.string().nullable(),
      due_date: z.string().nullable().describe("YYYY-MM-DD או null"),
      data: z
        .string()
        .nullable()
        .describe("JSON string לפרטים נוספים, אופציונלי"),
    }),
    execute: async ({ title, body, due_date, data }) => {
      const stmt = db.prepare(`
        INSERT INTO records (agent, category, title, body, data, due_date)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `);
      const row = stmt.get(
        agentName,
        defaultCategory,
        title,
        body,
        data,
        due_date,
      ) as { id: number };
      return `נשמר #${row.id}: ${title}`;
    },
  });

  const listRecords = tool({
    name: `${defaultCategory}_list`,
    description: `מציג את כל הרשומות בקטגוריית ${defaultCategory}.`,
    parameters: z.object({
      status: z.string().nullable(),
    }),
    execute: async ({ status }) => {
      const rows = (
        status
          ? (db
              .prepare(
                `SELECT * FROM records WHERE agent = ? AND category = ? AND status = ? ORDER BY due_date IS NULL, due_date, id DESC LIMIT 100`,
              )
              .all(agentName, defaultCategory, status) as RecordRow[])
          : (db
              .prepare(
                `SELECT * FROM records WHERE agent = ? AND category = ? ORDER BY due_date IS NULL, due_date, id DESC LIMIT 100`,
              )
              .all(agentName, defaultCategory) as RecordRow[])
      );
      if (rows.length === 0) return "אין רשומות.";
      return rows
        .map(
          (r) =>
            `#${r.id} [${r.status}] ${r.title}${r.due_date ? ` | ${r.due_date}` : ""}`,
        )
        .join("\n");
    },
  });

  const closeRecord = tool({
    name: `${defaultCategory}_close`,
    description: `מסמן רשומה כסגורה.`,
    parameters: z.object({ id: z.number().int() }),
    execute: async ({ id }) => {
      db.prepare(
        `UPDATE records SET status = 'closed', updated_at = datetime('now') WHERE id = ? AND agent = ?`,
      ).run(id, agentName);
      return `#${id} נסגר`;
    },
  });

  return [addRecord, listRecords, closeRecord];
}
