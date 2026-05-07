import { tool } from "@openai/agents";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  abortBranch,
  commitOnBranch,
  createFeatureBranch,
  getDiffAgainstMain,
  isPathSafe,
} from "../../dev/git.js";
import {
  createDevTask,
  createProposal,
  getDevTask,
  listDevTasks,
  setDevTaskStatus,
  setDevTaskAssignee,
} from "../../dev/proposals.js";

const execFileAsync = promisify(execFile);

// ===== PM (Noam) tools =====

export const createDevTaskTool = tool({
  name: "create_dev_task",
  description: "יוצר משימת פיתוח חדשה ב־backlog. החזר את ה־id שנוצר.",
  parameters: z.object({
    title: z.string().describe("כותרת קצרה למשימה"),
    spec: z.string().describe("מפרט מלא: מה צריך, למה, וקריטריוני קבלה"),
    assignee: z
      .enum(["Daniel", "Liya", "Uri", "Rotem"])
      .nullable()
      .describe("למי מהצוות להעביר. בדרך כלל Daniel."),
  }),
  execute: async ({ title, spec, assignee }) => {
    const task = createDevTask({
      title,
      spec,
      assignee: assignee ?? "Daniel",
    });
    return `dev_task #${task.id} נוצר. assignee=${task.assignee ?? "—"}`;
  },
});

export const listDevTasksTool = tool({
  name: "list_dev_tasks",
  description: "מציג את כל משימות הפיתוח ב־backlog.",
  parameters: z.object({}),
  execute: async () => {
    const tasks = listDevTasks();
    if (tasks.length === 0) return "אין משימות פיתוח פתוחות.";
    return tasks
      .map(
        (t) =>
          `#${t.id} [${t.status}] ${t.title} (${t.assignee ?? "—"})`,
      )
      .join("\n");
  },
});

export const setDevTaskStatusTool = tool({
  name: "set_dev_task_status",
  description: "מעדכן סטטוס של משימת פיתוח.",
  parameters: z.object({
    id: z.number().int(),
    status: z.enum([
      "spec",
      "in_progress",
      "review",
      "merged",
      "rejected",
      "cancelled",
    ]),
  }),
  execute: async ({ id, status }) => {
    setDevTaskStatus(id, status);
    return `dev_task #${id} → ${status}`;
  },
});

// ===== Dev (Daniel) tools =====

export const startWorkTool = tool({
  name: "start_work",
  description: "מתחיל לעבוד על dev_task — יוצר branch ומסמן in_progress.",
  parameters: z.object({
    dev_task_id: z.number().int(),
  }),
  execute: async ({ dev_task_id }) => {
    const task = getDevTask(dev_task_id);
    if (!task) return `dev_task #${dev_task_id} לא נמצא`;
    const branch = await createFeatureBranch(dev_task_id);
    setDevTaskStatus(dev_task_id, "in_progress");
    setDevTaskAssignee(dev_task_id, "Daniel");
    return `branch=${branch}. עכשיו אפשר לכתוב קוד עם write_file.`;
  },
});

export const readFileTool = tool({
  name: "read_file",
  description: "קורא קובץ מהרפו (path יחסי לתיקיית הפרויקט).",
  parameters: z.object({
    path: z.string().describe("נתיב יחסי, למשל src/agents/shefi.ts"),
  }),
  execute: async ({ path }) => {
    if (!isPathSafe(path)) return `שגיאה: גישה לנתיב אסורה (${path})`;
    const abs = resolve(process.cwd(), path);
    if (!existsSync(abs)) return `הקובץ לא קיים: ${path}`;
    const content = readFileSync(abs, "utf-8");
    if (content.length > 12000) {
      return content.slice(0, 12000) + "\n... (truncated)";
    }
    return content;
  },
});

export const writeFileTool = tool({
  name: "write_file",
  description:
    "כותב קובץ ב־branch הפעיל. הנתיב חייב להיות תחת src/, frontend/src/, README.md או דומה. אסור .env, node_modules, dist, data, .git.",
  parameters: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ path, content }) => {
    if (!isPathSafe(path)) return `שגיאה: גישה לנתיב אסורה (${path})`;
    const abs = resolve(process.cwd(), path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
    return `נכתב: ${path} (${content.length} bytes)`;
  },
});

export const runTypecheckTool = tool({
  name: "run_typecheck",
  description: "מריץ tsc --noEmit ומחזיר את התוצאה.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "npx",
        ["tsc", "--noEmit"],
        { cwd: process.cwd(), timeout: 60_000 },
      );
      return `OK\n${(stdout + stderr).slice(0, 4000)}`;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return `FAIL\n${(e.stdout || "") + (e.stderr || "") + (e.message || "")}`.slice(
        0,
        4000,
      );
    }
  },
});

export const createProposalTool = tool({
  name: "create_proposal",
  description:
    "מסכם את העבודה: commit ב־branch, מחשב diff מול main, יוצר רשומת proposal לאישור.",
  parameters: z.object({
    dev_task_id: z.number().int(),
    branch: z.string(),
    summary: z.string().describe("סיכום קצר בעברית של מה שינית"),
  }),
  execute: async ({ dev_task_id, branch, summary }) => {
    await commitOnBranch(branch, `[#${dev_task_id}] ${summary}`);
    const diff = await getDiffAgainstMain(branch);
    if (!diff.trim()) {
      return `שגיאה: אין שינויים מול main ב־${branch}`;
    }
    const proposal = createProposal({
      dev_task_id,
      branch,
      summary,
      diff_text: diff,
    });
    setDevTaskStatus(dev_task_id, "review");
    return `proposal #${proposal.id} נוצר, ממתין לאישור CEO`;
  },
});

export const cancelBranchTool = tool({
  name: "cancel_branch",
  description: "מוחק branch (עוזב את העבודה). השתמש אם זה לא ייצא טוב.",
  parameters: z.object({
    branch: z.string(),
    dev_task_id: z.number().int().nullable(),
  }),
  execute: async ({ branch, dev_task_id }) => {
    await abortBranch(branch);
    if (dev_task_id) setDevTaskStatus(dev_task_id, "cancelled");
    return `${branch} נמחק`;
  },
});

// ===== QA (Kosem) tools =====

export const lintTool = tool({
  name: "lint",
  description: "מריץ בדיקת lint בסיסית (typecheck כרגע).",
  parameters: z.object({}),
  execute: async () => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "npx",
        ["tsc", "--noEmit"],
        { cwd: process.cwd(), timeout: 60_000 },
      );
      return `lint OK\n${(stdout + stderr).slice(0, 2000)}`;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return `lint FAIL\n${(e.stdout || "") + (e.stderr || "") + (e.message || "")}`.slice(
        0,
        2000,
      );
    }
  },
});

export const smokeTestTool = tool({
  name: "smoke_test",
  description:
    "בודק שהפרויקט מתקמפל ושהמודולים נטענים. לא בודק התנהגות בפועל.",
  parameters: z.object({}),
  execute: async () => {
    try {
      await execFileAsync("npx", ["tsc", "--noEmit"], {
        cwd: process.cwd(),
        timeout: 60_000,
      });
      return "smoke OK — typecheck passes";
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      return `smoke FAIL\n${((e.stdout || "") + (e.stderr || "")).slice(0, 2000)}`;
    }
  },
});
