import cron from "node-cron";
import { run, user } from "@openai/agents";
import type { Bot } from "grammy";
import { mira } from "../agents/mira.js";
import { env } from "../lib/env.js";
import {
  pendingRemindersDue,
  markReminderSent,
  getItem,
} from "../db/client.js";

async function broadcastToAllowed(bot: Bot, text: string) {
  for (const userId of env.ALLOWED_USER_IDS) {
    try {
      await bot.api.sendMessage(userId, text);
    } catch (err) {
      console.error(`שליחה ל־${userId} נכשלה:`, err);
    }
  }
}

async function buildDigest(kind: "morning" | "evening"): Promise<string> {
  try {
    const prompt =
      kind === "morning"
        ? "בני דייג'סט בוקר עם build_digest(morning). שלחי לי את הטקסט המלא."
        : "בני סיכום ערב עם build_digest(evening). שלחי לי את הטקסט המלא.";
    const result = await run(mira, [user(prompt)]);
    return result.finalOutput?.trim() || "(אין מה לדווח)";
  } catch (err) {
    console.error("שגיאה בבניית דייג'סט:", err);
    return "שגיאה בבניית הדייג'סט.";
  }
}

export function startScheduler(bot: Bot) {
  // Morning digest — 08:00
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("[cron] morning digest");
      const text = await buildDigest("morning");
      await broadcastToAllowed(bot, text);
    },
    { timezone: env.TZ },
  );

  // Evening digest — 18:00
  cron.schedule(
    "0 18 * * *",
    async () => {
      console.log("[cron] evening digest");
      const text = await buildDigest("evening");
      await broadcastToAllowed(bot, text);
    },
    { timezone: env.TZ },
  );

  // Reminders check — every minute
  cron.schedule(
    "* * * * *",
    async () => {
      const nowIso = new Date().toISOString();
      const due = pendingRemindersDue(nowIso);
      for (const r of due) {
        const item = r.item_id ? getItem(r.item_id) : null;
        const lines: string[] = ["🔔 תזכורת"];
        if (r.message) lines.push(r.message);
        if (item) {
          lines.push(`#${item.id} ${item.title}`);
          if (item.due_date) lines.push(`יעד: ${item.due_date}`);
        }
        await broadcastToAllowed(bot, lines.join("\n"));
        markReminderSent(r.id);
      }
    },
    { timezone: env.TZ },
  );

  console.log(`[scheduler] התחיל. אזור זמן: ${env.TZ}`);
}
