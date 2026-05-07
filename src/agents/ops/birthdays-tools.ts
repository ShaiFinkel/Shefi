import { tool } from "@openai/agents";
import { z } from "zod";
import {
  approveOrdersForMonth,
  createOrder,
  findEmployeesByQuery,
  listEmployeesByMonth,
  listOrdersForMonth,
  markDeparted,
  markOrdersSentForMonth,
  skipOrdersForMonth,
} from "../../db/employees.js";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseMonth(month: string | null | undefined): { ym: string; mm: string; year: number } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return { ym: month, mm: month.slice(5), year: Number(month.slice(0, 4)) };
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  return { ym: `${y}-${m}`, mm: m, year: y };
}

function monthName(mm: string): string {
  const names = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];
  return names[Number(mm) - 1] ?? mm;
}

export function formatPreview(month: string): string {
  const { ym, mm } = parseMonth(month);
  const employees = listEmployeesByMonth(mm);
  const israeli = employees.filter((e) => e.channel === "buyme");
  const abroad = employees.filter((e) => e.channel !== "buyme");
  const lines: string[] = [];
  lines.push(`🎂 ימי הולדת לחודש ${monthName(mm)} (${ym})`);
  lines.push("");
  if (israeli.length > 0) {
    lines.push(`📦 BuyMe — להזמנה (${israeli.length}):`);
    for (const e of israeli) {
      const day = e.birthday_md?.slice(3) ?? "??";
      lines.push(`  ${day} | ${e.name} | ${e.amount_ils}₪ | ${e.email ?? ""}`);
    }
    const total = israeli.reduce((s, e) => s + e.amount_ils, 0);
    lines.push(`  סה״כ: ${total}₪`);
  } else {
    lines.push("📦 BuyMe — אין ימי הולדת בישראל החודש.");
  }
  lines.push("");
  if (abroad.length > 0) {
    lines.push(`🌍 חו״ל — תזכורת ידנית (${abroad.length}):`);
    for (const e of abroad) {
      const day = e.birthday_md?.slice(3) ?? "??";
      const platform = e.channel === "amazon_au"
        ? "Amazon AU"
        : e.channel === "amazon_us"
          ? "Amazon US"
          : e.channel === "amazon_ca"
            ? "Amazon CA"
            : "ידני";
      lines.push(`  ${day} | ${e.name} (${e.country}) | ${platform}`);
    }
  } else {
    lines.push("🌍 חו״ל — אין ימי הולדת בחו״ל החודש.");
  }
  return lines.join("\n");
}

export function createOrdersForMonth(month: string): { created: number; skipped: number } {
  const { ym, mm, year } = parseMonth(month);
  const employees = listEmployeesByMonth(mm);
  const israeli = employees.filter((e) => e.channel === "buyme");
  let created = 0;
  let skipped = 0;
  for (const e of israeli) {
    const dd = e.birthday_md?.slice(3) ?? "01";
    const sendDate = `${year}-${mm}-${dd}`;
    const order = createOrder({
      employee_id: e.id,
      month: ym,
      send_date: sendDate,
      channel: e.channel,
      amount_ils: e.amount_ils,
    });
    if (order) created++;
    else skipped++;
  }
  return { created, skipped };
}

export function buyMeCsvForMonth(month: string): string {
  const { ym } = parseMonth(month);
  const orders = listOrdersForMonth(ym).filter((o) => o.channel === "buyme");
  const header = "Recipient Name,Email,Phone,Amount (ILS),Send Date,Greeting";
  const rows = orders.map((o) => {
    const greeting = `יום הולדת שמח ${o.employee_name}! 🎉`;
    return [
      o.employee_name,
      o.employee_email ?? "",
      o.employee_phone ?? "",
      o.amount_ils.toString(),
      o.send_date,
      `"${greeting}"`,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

// ---------- Tools ----------

export const birthdaysPreviewTool = tool({
  name: "birthdays_preview",
  description:
    "מציג תצוגה מקדימה של כל הזמנות יום ההולדת לחודש מסוים (ברירת מחדל: החודש הנוכחי). מציג גם רשימת BuyMe ישראל וגם רשימת תזכורת חו״ל.",
  parameters: z.object({
    month: z
      .string()
      .nullable()
      .describe("YYYY-MM, למשל 2026-06. אם לא צוין — החודש הנוכחי."),
  }),
  execute: async ({ month }) => formatPreview(month ?? new Date().toISOString().slice(0, 7)),
});

export const birthdaysCreateOrdersTool = tool({
  name: "birthdays_create_orders",
  description:
    "יוצר הזמנות 'ממתינות לאישור' (status=pending) לכל עובדי ישראל שיום הולדתם בחודש הנתון. לא שולח כלום בפועל.",
  parameters: z.object({
    month: z.string().nullable().describe("YYYY-MM"),
  }),
  execute: async ({ month }) => {
    const ym = month ?? new Date().toISOString().slice(0, 7);
    const { created, skipped } = createOrdersForMonth(ym);
    return `נוצרו ${created} הזמנות חדשות, ${skipped} כבר היו קיימות לחודש ${ym}.`;
  },
});

export const birthdaysApproveTool = tool({
  name: "birthdays_approve_month",
  description:
    "מאשר את כל ההזמנות הממתינות לחודש מסוים. אחרי האישור הן עוברות ל־approved ומוכנות לשליחה ידנית ב־BuyMe.",
  parameters: z.object({
    month: z.string().describe("YYYY-MM"),
  }),
  execute: async ({ month }) => {
    const n = approveOrdersForMonth(month);
    return `אושרו ${n} הזמנות לחודש ${month}.`;
  },
});

export const birthdaysMarkSentTool = tool({
  name: "birthdays_mark_sent",
  description:
    "מסמן את כל ההזמנות המאושרות לחודש כ'נשלחו' (אחרי שהמשתמשת העלתה ל־BuyMe Business).",
  parameters: z.object({
    month: z.string().describe("YYYY-MM"),
  }),
  execute: async ({ month }) => {
    const n = markOrdersSentForMonth(month);
    return `${n} הזמנות סומנו כנשלחו לחודש ${month}.`;
  },
});

export const birthdaysSkipMonthTool = tool({
  name: "birthdays_skip_month",
  description: "מבטל את כל ההזמנות הממתינות לחודש (ללא שליחה).",
  parameters: z.object({
    month: z.string().describe("YYYY-MM"),
  }),
  execute: async ({ month }) => {
    const n = skipOrdersForMonth(month);
    return `${n} הזמנות בוטלו לחודש ${month}.`;
  },
});

export const employeeRemoveTool = tool({
  name: "employee_remove",
  description:
    "מסמן עובד כ'עזב' (לא יקבל יותר מתנות יום הולדת). חיפוש לפי שם — אם יש כמה התאמות, מחזיר אותן בלי למחוק.",
  parameters: z.object({
    name: z.string().describe("שם העובד (חלקי או מלא, עברית או אנגלית)"),
    departure_date: z
      .string()
      .describe("תאריך עזיבה ב־YYYY-MM-DD"),
  }),
  execute: async ({ name, departure_date }) => {
    const matches = findEmployeesByQuery(name);
    if (matches.length === 0) {
      return `לא מצאתי עובד בשם "${name}".`;
    }
    if (matches.length > 1) {
      const list = matches.map((m) => `#${m.id} ${m.name}`).join(", ");
      return `מצאתי כמה התאמות: ${list}. תני לי id מדויק (לדוגמה: "תורידי את עובד #${matches[0].id}").`;
    }
    const e = matches[0];
    markDeparted(e.id, departure_date);
    return `✓ ${e.name} סומן/ה כעזב/ה ב־${departure_date}.`;
  },
});

export const employeeRemoveByIdTool = tool({
  name: "employee_remove_by_id",
  description: "מסמן עובד לפי id מדויק כ'עזב'.",
  parameters: z.object({
    id: z.number().int(),
    departure_date: z.string().describe("YYYY-MM-DD"),
  }),
  execute: async ({ id, departure_date }) => {
    markDeparted(id, departure_date);
    return `✓ עובד #${id} סומן כעזב ב־${departure_date}.`;
  },
});

export const employeeFindTool = tool({
  name: "employee_find",
  description: "מחפש עובדים לפי שם (חלקי או מלא, עברית או אנגלית) או אימייל.",
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    const matches = findEmployeesByQuery(query);
    if (matches.length === 0) return `לא מצאתי תוצאות ל"${query}".`;
    return matches
      .map(
        (e) =>
          `#${e.id} ${e.name} | ${e.country ?? "?"} | יום הולדת ${e.birthday_md ?? "?"} | ${e.amount_ils}₪ ${e.channel}`,
      )
      .join("\n");
  },
});

export const birthdayTools = [
  birthdaysPreviewTool,
  birthdaysCreateOrdersTool,
  birthdaysApproveTool,
  birthdaysMarkSentTool,
  birthdaysSkipMonthTool,
  employeeFindTool,
  employeeRemoveTool,
  employeeRemoveByIdTool,
];
