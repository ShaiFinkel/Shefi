import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { env } from "../../lib/env.js";
import { db } from "../../db/client.js";

const allowedTables = new Set([
  "items",
  "reminders",
  "agent_events",
  "dev_tasks",
  "proposals",
  "records",
]);

const safeQueryTool = tool({
  name: "query_db",
  description:
    "מריץ SELECT-בלבד על ה־DB. טבלאות מותרות: items, reminders, agent_events, dev_tasks, proposals, records.",
  parameters: z.object({
    sql: z.string().describe("שאילתת SELECT בלבד"),
  }),
  execute: async ({ sql }) => {
    const trimmed = sql.trim().replace(/;$/g, "");
    if (!/^select\b/i.test(trimmed)) {
      return "שגיאה: רק SELECT מותר.";
    }
    const lower = trimmed.toLowerCase();
    const tableMatches = lower.match(/from\s+([a-z_]+)/g) || [];
    for (const m of tableMatches) {
      const tbl = m.replace(/from\s+/, "").trim();
      if (!allowedTables.has(tbl)) {
        return `שגיאה: טבלה לא מותרת: ${tbl}`;
      }
    }
    try {
      const rows = db.prepare(trimmed).all();
      const limited = rows.slice(0, 50);
      return JSON.stringify(limited, null, 2);
    } catch (err) {
      return `שגיאה: ${(err as Error).message}`;
    }
  },
});

const summarizeTool = tool({
  name: "open_items_summary",
  description: "סיכום מהיר של מצב המשימות הפתוחות.",
  parameters: z.object({}),
  execute: async () => {
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM items WHERE status='open') AS open_items,
           (SELECT COUNT(*) FROM items WHERE status='done' AND closed_at >= date('now','-7 day')) AS closed_week,
           (SELECT COUNT(*) FROM items WHERE status='open' AND due_date < date('now')) AS overdue,
           (SELECT COUNT(*) FROM dev_tasks WHERE status IN ('spec','in_progress','review')) AS dev_open`,
      )
      .get() as Record<string, number>;
    return JSON.stringify(counts, null, 2);
  },
});

export const aviv = new Agent({
  name: "Aviv",
  model: env.OPENAI_MODEL_SMART,
  instructions: `אתה אביב, האנליסט של החברה.
מנתח דאטה ומציג תובנות בעברית.

כלים: query_db (SELECT-only), open_items_summary.

כללים:
- כתוב SQL פשוט ובטוח.
- סכם בעברית 2-4 נקודות מרכזיות.
- אל תכתוב מספרים ארוכים בלי הקשר.`,
  tools: [safeQueryTool, summarizeTool],
});
