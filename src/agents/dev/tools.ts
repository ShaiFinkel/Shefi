import { tool } from "@openai/agents";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
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
  description:
    "מתחיל לעבוד על dev_task — יוצר branch ומסמן in_progress. קרא לכלי זה **מיד** אחרי handoff מנועם, עם ה־id מהשורה DEV_TASK_ID: N.",
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

export const getDevTaskTool = tool({
  name: "get_dev_task",
  description:
    "מחזיר title, spec, status ו-assignee של משימת פיתוח לפי id. השתמש אחרי start_work אם צריך לעיין שוב במפרט, או כשלא ברור איזו משימה לפתוח.",
  parameters: z.object({
    id: z.number().int(),
  }),
  execute: async ({ id }) => {
    const t = getDevTask(id);
    if (!t) return `dev_task #${id} לא נמצא`;
    return JSON.stringify(
      {
        id: t.id,
        title: t.title,
        spec: t.spec,
        status: t.status,
        assignee: t.assignee,
      },
      null,
      2,
    );
  },
});

// Soft cap for any single read response. Anything bigger is truncated and
// the caller is told to re-read with a line range. Lower this number → fewer
// tokens per file, but possibly more reads.
const READ_CHAR_CAP = 6000;

export function readFileSlice(input: {
  path: string;
  start_line: number | null;
  end_line: number | null;
}): string {
  if (!isPathSafe(input.path)) return `שגיאה: גישה לנתיב אסורה (${input.path})`;
  const abs = resolve(process.cwd(), input.path);
  if (!existsSync(abs)) return `הקובץ לא קיים: ${input.path}`;
  const lines = readFileSync(abs, "utf-8").split("\n");
  const total = lines.length;
  const from = Math.max(1, input.start_line ?? 1);
  const to = Math.min(total, input.end_line ?? total);
  if (from > to) return `שגיאה: טווח לא תקין (${from}-${to})`;
  const slice = lines.slice(from - 1, to);
  const numbered = slice.map((l, i) => `${String(from + i).padStart(5)}| ${l}`).join("\n");
  if (numbered.length > READ_CHAR_CAP) {
    const truncated = numbered.slice(0, READ_CHAR_CAP);
    const lastNewline = truncated.lastIndexOf("\n");
    return (
      truncated.slice(0, lastNewline > 0 ? lastNewline : truncated.length) +
      `\n... (קובץ באורך ${total} שורות. קראת ${from}-${to}, נקצץ באמצע. קרא שוב עם start_line/end_line צרים יותר.)`
    );
  }
  return `// ${input.path} — שורות ${from}-${to} מתוך ${total}\n${numbered}`;
}

export const readFileTool = tool({
  name: "read_file",
  description:
    "קורא קובץ (או קטע ממנו). אם מציינים start_line/end_line — מחזיר רק את הטווח. אחרת מחזיר את כל הקובץ עד תקרה (~6KB) ואז מתבקש לקרוא שוב עם טווח. ההחזר תמיד מסומן בקידומת LINE| כדי לעזור לכוון.",
  parameters: z.object({
    path: z.string().describe("נתיב יחסי, למשל src/agents/shefi.ts"),
    start_line: z
      .number()
      .int()
      .nullable()
      .describe("שורת התחלה (1-מבוסס). null = מתחילה."),
    end_line: z
      .number()
      .int()
      .nullable()
      .describe("שורת סיום (כולל). null = עד הסוף."),
  }),
  execute: async ({ path, start_line, end_line }) => readFileSlice({ path, start_line, end_line }),
});

// Node-based ripgrep alternative — no external dependency. Walks the repo
// (skipping node_modules/dist/data/.git etc.), reads each text file, applies
// the regex, and returns up to 30 path:line:content matches. The PM (Noam)
// uses this to discover where things live before writing a spec; Daniel
// uses it as a fallback when he needs a call site.
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "data",
  ".git",
  ".next",
  "build",
  "coverage",
  ".cache",
]);
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|html|css|scss|sql|sh|yml|yaml|toml|env\.example)$/i;

export function* walkRepo(root: string, dir: string = root): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") && entry !== ".env.example") continue;
    if (SKIP_DIRS.has(entry)) continue;
    const abs = resolve(dir, entry);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) {
      yield* walkRepo(root, abs);
    } else if (st.isFile() && TEXT_EXT.test(entry)) {
      if (st.size > 1_000_000) continue; // skip huge files
      yield abs;
    }
  }
}

export function globToRegex(glob: string): RegExp {
  // Tiny glob → regex with the gitignore convention that `**/` may match
  // zero directories, so `src/lib/**/*.ts` also matches `src/lib/email.ts`.
  // We tokenize first to avoid regex meta-chars (?, ., *) from one stage
  // colliding with another (e.g. a `?` produced by `(?:.../)?` getting
  // re-interpreted as the glob `?`).
  let out = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*" && glob[i + 2] === "/") {
      out += "(?:[^/]+/)*"; // zero-or-more path segments
      i += 3;
    } else if (c === "*" && glob[i + 1] === "*") {
      out += ".*";
      i += 2;
    } else if (c === "*") {
      out += "[^/]*";
      i += 1;
    } else if (c === "?") {
      out += "[^/]";
      i += 1;
    } else if ("\\.+^${}()|[]".includes(c)) {
      out += "\\" + c;
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return new RegExp("^" + out + "$");
}

export function grepRepo(input: { pattern: string; glob: string | null }): string {
  if (!input.pattern.trim()) return "שגיאה: pattern ריק";
  let regex: RegExp;
  try { regex = new RegExp(input.pattern); }
  catch (e) { return `שגיאה: regex לא תקין (${(e as Error).message})`; }
  const root = process.cwd();
  const globRe = input.glob ? globToRegex(input.glob) : null;
  const matches: string[] = [];
  for (const abs of walkRepo(root)) {
    const rel = relative(root, abs);
    if (globRe && !globRe.test(rel)) continue;
    let content: string;
    try { content = readFileSync(abs, "utf-8"); } catch { continue; }
    const lines = content.split("\n");
    let perFile = 0;
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        if (perFile >= 8) break;
        let snippet = lines[i].trim();
        if (snippet.length > 200) snippet = snippet.slice(0, 200) + "…";
        matches.push(`${rel}:${i + 1}: ${snippet}`);
        perFile++;
        if (matches.length >= 31) break;
      }
    }
    if (matches.length >= 31) break;
  }
  if (matches.length === 0) return `אין התאמות ל־"${input.pattern}"${input.glob ? ` ב־${input.glob}` : ""}`;
  const head = matches.slice(0, 30).join("\n");
  const more = matches.length > 30 ? `\n... (יש עוד התאמות. צמצם תבנית pattern או glob.)` : "";
  return head + more;
}

export const grepRepoTool = tool({
  name: "grep_repo",
  description:
    "מחפש regex בכל קבצי הקוד של הרפו (מדלג על node_modules/dist/data/.git). מחזיר עד 30 התאמות בפורמט path:line:content. תמיד תשתמש בזה לפני שאתה קורא קבצים גדולים — קודם מצא איפה הסימן שאתה מחפש, ואז קרא רק את הטווח הזה ב־read_file.",
  parameters: z.object({
    pattern: z.string().describe("ביטוי רגולרי (JavaScript regex)."),
    glob: z
      .string()
      .nullable()
      .describe("תבנית glob יחסית, למשל 'src/**/*.ts' או '*.tsx'. null = כל הקוד."),
  }),
  execute: async ({ pattern, glob }) => grepRepo({ pattern, glob }),
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
