import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../../lib/env.js";
import { db } from "../../db/client.js";

const execFileAsync = promisify(execFile);

const healthcheckTool = tool({
  name: "healthcheck",
  description: "בודק שה־DB מגיב ושיש לוגים אחרונים מהסוכנים.",
  parameters: z.object({}),
  execute: async () => {
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM items) AS items,
           (SELECT COUNT(*) FROM agent_events) AS events,
           (SELECT COUNT(*) FROM dev_tasks) AS dev_tasks,
           (SELECT COUNT(*) FROM proposals WHERE status='ready') AS pending_proposals`,
      )
      .get() as Record<string, number>;
    const lastEvent = db
      .prepare(`SELECT ts, agent FROM agent_events ORDER BY id DESC LIMIT 1`)
      .get() as { ts: string; agent: string } | undefined;
    return JSON.stringify(
      { ...counts, last_event: lastEvent ?? null },
      null,
      2,
    );
  },
});

const tailLogsTool = tool({
  name: "tail_events",
  description: "מציג את N האירועים האחרונים מ־agent_events.",
  parameters: z.object({ n: z.number().int().min(1).max(50) }),
  execute: async ({ n }) => {
    const rows = db
      .prepare(
        `SELECT ts, agent, kind, content FROM agent_events ORDER BY id DESC LIMIT ?`,
      )
      .all(n) as { ts: string; agent: string; kind: string; content: string }[];
    return rows
      .reverse()
      .map((r) => `[${r.ts}] ${r.agent} ${r.kind}: ${r.content.slice(0, 120)}`)
      .join("\n");
  },
});

const diskUsageTool = tool({
  name: "disk_usage",
  description: "בודק כמה מקום ה־DB תופס.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const { stdout } = await execFileAsync("du", ["-sh", "data/"], {
        cwd: process.cwd(),
      });
      return stdout.trim();
    } catch (err) {
      return `שגיאה: ${(err as Error).message}`;
    }
  },
});

export const uri = new Agent({
  name: "Uri",
  model: env.OPENAI_MODEL_FAST,
  instructions: `אתה אורי, ה־DevOps של החברה.
מנטר את בריאות המערכת ומדווח ל־CEO ולנועם אם משהו לא תקין.

כלים: healthcheck, tail_events, disk_usage.
דוח קצר בעברית, עם מספרים ספציפיים.`,
  tools: [healthcheckTool, tailLogsTool, diskUsageTool],
});
