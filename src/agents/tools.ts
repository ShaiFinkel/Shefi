import { tool } from "@openai/agents";
import { z } from "zod";
import {
  closeItem,
  createItem,
  getItem,
  listClosedSince,
  listItemsForToday,
  listOpenItems,
  listOverdueItems,
  updateDueDate,
  updatePriority,
  saveMemory,
  allMemories,
  createReminder,
  type Item,
} from "../db/client.js";
import { embed, cosineSimilarity } from "../lib/llm.js";

function formatItem(item: Item): string {
  const due = item.due_date ? ` | יעד: ${item.due_date}` : "";
  const prio = item.priority ? ` [${item.priority}]` : "";
  const kind =
    item.kind === "task" ? "משימה" : item.kind === "idea" ? "רעיון" : "הערה";
  return `#${item.id} ${kind}${prio}: ${item.title}${due}`;
}

// ===== Tova — Task Manager =====

export const addItemTool = tool({
  name: "add_item",
  description:
    "הוספת פריט חדש (משימה / רעיון / הערה). השתמש כשהמשתמשת מעלה משהו חדש.",
  parameters: z.object({
    kind: z
      .enum(["task", "idea", "note"])
      .describe("task=משימה לביצוע, idea=רעיון לזכור, note=מידע/הערה"),
    title: z.string().describe("כותרת קצרה וברורה בעברית"),
    details: z
      .string()
      .nullable()
      .describe("פרטים נוספים אם רלוונטי, אחרת null"),
    priority: z
      .enum(["P1", "P2", "P3", "P4"])
      .nullable()
      .describe(
        "P1=דחוף וחשוב, P2=חשוב, P3=ברירת מחדל, P4=נמוך. null אם לא ברור.",
      ),
    due_date: z
      .string()
      .nullable()
      .describe("תאריך יעד בפורמט YYYY-MM-DD, או null"),
    raw_input: z
      .string()
      .nullable()
      .describe("ההודעה המקורית של המשתמשת"),
  }),
  execute: async (input) => {
    const item = createItem({
      kind: input.kind,
      title: input.title,
      details: input.details,
      priority: input.priority,
      due_date: input.due_date,
      raw_input: input.raw_input,
    });
    return `נוסף בהצלחה: ${formatItem(item)}`;
  },
});

export const listOpenTool = tool({
  name: "list_open_items",
  description: "מחזיר את כל הפריטים הפתוחים, ממויינים לפי עדיפות ויעד.",
  parameters: z.object({
    limit: z.number().int().min(1).max(100).nullable(),
  }),
  execute: async ({ limit }) => {
    const items = listOpenItems(limit ?? 50);
    if (items.length === 0) return "אין פריטים פתוחים.";
    return items.map(formatItem).join("\n");
  },
});

export const listTodayTool = tool({
  name: "list_today_items",
  description:
    "מחזיר משימות פתוחות שתאריך היעד שלהן היום או באיחור, וכן משימות בלי יעד.",
  parameters: z.object({}),
  execute: async () => {
    const items = listItemsForToday();
    if (items.length === 0) return "אין משימות להיום.";
    return items.map(formatItem).join("\n");
  },
});

export const closeItemTool = tool({
  name: "close_item",
  description: "סוגר משימה לפי id (status=done).",
  parameters: z.object({
    id: z.number().int().describe("ה־id של הפריט"),
  }),
  execute: async ({ id }) => {
    const item = closeItem(id);
    if (!item) return `לא מצאתי פריט פתוח עם id=${id}`;
    return `נסגר: ${formatItem(item)}`;
  },
});

export const setPriorityTool = tool({
  name: "set_priority",
  description: "עדכון עדיפות של פריט.",
  parameters: z.object({
    id: z.number().int(),
    priority: z.enum(["P1", "P2", "P3", "P4"]),
  }),
  execute: async ({ id, priority }) => {
    const item = updatePriority(id, priority);
    if (!item) return `לא מצאתי פריט עם id=${id}`;
    return `עודכן: ${formatItem(item)}`;
  },
});

export const setDueDateTool = tool({
  name: "set_due_date",
  description: "עדכון תאריך יעד של פריט. השתמש ב־null כדי לבטל יעד.",
  parameters: z.object({
    id: z.number().int(),
    due_date: z.string().nullable().describe("YYYY-MM-DD או null"),
  }),
  execute: async ({ id, due_date }) => {
    const item = updateDueDate(id, due_date);
    if (!item) return `לא מצאתי פריט עם id=${id}`;
    return `עודכן: ${formatItem(item)}`;
  },
});

// ===== Mira — Reminders =====

export const scheduleReminderTool = tool({
  name: "schedule_reminder",
  description:
    "תזמון תזכורת חד־פעמית לזמן מסויים. אם יש item_id התזכורת תקושר לפריט.",
  parameters: z.object({
    item_id: z.number().int().nullable(),
    remind_at: z
      .string()
      .describe(
        "ISO datetime, למשל 2026-05-08T08:00:00. אם המשתמשת אמרה 'מחר ב־9' חשב את הזמן בעצמך.",
      ),
    message: z.string().nullable().describe("טקסט התזכורת, אופציונלי"),
  }),
  execute: async (input) => {
    const r = createReminder({
      item_id: input.item_id,
      remind_at: input.remind_at,
      message: input.message,
    });
    return `נקבעה תזכורת #${r.id} ל־${r.remind_at}`;
  },
});

export const buildDigestTool = tool({
  name: "build_digest",
  description:
    "בונה דייג'סט של מצב יום (today/morning) או סיכום (evening). משמש את מירה.",
  parameters: z.object({
    kind: z.enum(["morning", "evening"]),
  }),
  execute: async ({ kind }) => {
    if (kind === "morning") {
      const today = listItemsForToday();
      const overdue = listOverdueItems();
      const lines: string[] = [`בוקר טוב! 🌅`, ``];
      if (overdue.length > 0) {
        lines.push(`באיחור (${overdue.length}):`);
        for (const it of overdue) lines.push(`  • ${formatItem(it)}`);
        lines.push(``);
      }
      if (today.length > 0) {
        lines.push(`להיום (${today.length}):`);
        for (const it of today) lines.push(`  • ${formatItem(it)}`);
      } else {
        lines.push(`אין משימות פתוחות להיום. נשמה.`);
      }
      return lines.join("\n");
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closed = listClosedSince(today.toISOString());
    const open = listOpenItems(100);
    const lines: string[] = [`סיכום יום 🌙`, ``];
    lines.push(`סגרת היום: ${closed.length}`);
    for (const it of closed) lines.push(`  ✓ ${formatItem(it)}`);
    lines.push(``);
    lines.push(`נשארו פתוחות: ${open.length}`);
    return lines.join("\n");
  },
});

// ===== Aya — Memory & Recall =====

export const rememberTool = tool({
  name: "remember",
  description:
    "שומר טקסט בזיכרון הסמנטי לחיפוש עתידי. השתמש לכל פריט חדש מהותי.",
  parameters: z.object({
    item_id: z.number().int().nullable(),
    text: z.string(),
  }),
  execute: async ({ item_id, text }) => {
    const embedding = await embed(text);
    const m = saveMemory({ item_id, text, embedding });
    return `נשמר בזיכרון #${m.id}`;
  },
});

export const recallTool = tool({
  name: "recall",
  description:
    "חיפוש סמנטי בזיכרון. מחזיר את הפריטים הרלוונטיים ביותר לשאלה.",
  parameters: z.object({
    query: z.string(),
    top_k: z.number().int().min(1).max(20).nullable(),
  }),
  execute: async ({ query, top_k }) => {
    const k = top_k ?? 5;
    const queryEmbedding = await embed(query);
    const memories = allMemories();
    if (memories.length === 0) return "הזיכרון ריק.";

    const scored = memories
      .map((m) => {
        const vec = JSON.parse(m.embedding) as number[];
        return { m, score: cosineSimilarity(queryEmbedding, vec) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    const lines: string[] = [];
    for (const { m, score } of scored) {
      const item = m.item_id ? getItem(m.item_id) : null;
      const tag = item ? `#${item.id}` : "—";
      lines.push(`[${tag} | ${score.toFixed(2)}] ${m.text}`);
    }
    return lines.join("\n");
  },
});

// ===== Helpers =====

export function todayContext(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `היום: ${formatter.format(now)} (${now.toISOString().slice(0, 10)})`;
}
