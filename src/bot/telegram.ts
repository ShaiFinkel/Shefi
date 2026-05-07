import { Bot, GrammyError, HttpError } from "grammy";
import { env } from "../lib/env.js";
import { runFromCEO } from "../agents/runner.js";
import { eventBus } from "../server/events.js";
import { transcribeTelegramVoice } from "./voice.js";
import {
  closeItem,
  listItemsForToday,
  listOpenItems,
} from "../db/client.js";
import {
  registerBirthdayCallbacks,
  runMonthlyBirthdayPreview,
} from "../scheduler/birthdays.js";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// ===== Allowlist guard =====
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId || !env.ALLOWED_USER_IDS.has(userId)) {
    if (userId) {
      console.warn(
        `דחיתי משתמש לא מורשה: ${userId} (${ctx.from?.username ?? "—"})`,
      );
      await ctx.reply("מצטערת, את הבוט הזה לא מכירה את המשתמש הזה.");
    }
    return;
  }
  await next();
});

// ===== Commands =====

bot.command("start", async (ctx) => {
  await ctx.reply(
    [
      "שלום! אני שפי, ה־Chief of Staff שלך.",
      "",
      "כתבי לי כל דבר שעולה לראש — משימה, רעיון, או הערה — ואני אעביר ליד הנכונה בצוות.",
      "אפשר גם לשלוח הקלטה קולית.",
      "",
      "פקודות:",
      "  /today — מה היום",
      "  /open — כל המשימות הפתוחות",
      "  /done <id> — סגירת משימה",
    ].join("\n"),
  );
});

bot.command("today", async (ctx) => {
  const items = listItemsForToday();
  if (items.length === 0) {
    await ctx.reply("אין משימות פתוחות להיום. נשמה.");
    return;
  }
  const lines = items.map((it) => {
    const due = it.due_date ? ` | יעד: ${it.due_date}` : "";
    const prio = it.priority ? ` [${it.priority}]` : "";
    return `#${it.id}${prio} ${it.title}${due}`;
  });
  await ctx.reply(`להיום (${items.length}):\n` + lines.join("\n"));
});

bot.command("open", async (ctx) => {
  const items = listOpenItems(50);
  if (items.length === 0) {
    await ctx.reply("אין פריטים פתוחים.");
    return;
  }
  const lines = items.map((it) => {
    const due = it.due_date ? ` | ${it.due_date}` : "";
    const prio = it.priority ? ` [${it.priority}]` : "";
    return `#${it.id}${prio} ${it.title}${due}`;
  });
  await ctx.reply(`פתוחות (${items.length}):\n` + lines.join("\n"));
});

bot.command("birthdays", async (ctx) => {
  const arg = ctx.match.trim();
  const month = /^\d{4}-\d{2}$/.test(arg)
    ? arg
    : new Date().toISOString().slice(0, 7);
  await ctx.replyWithChatAction("typing");
  try {
    await runMonthlyBirthdayPreview(bot, month);
  } catch (err) {
    console.error("birthdays preview error:", err);
    await ctx.reply("שגיאה ביצירת תצוגה מקדימה.");
  }
});

registerBirthdayCallbacks(bot);

bot.command("done", async (ctx) => {
  const arg = ctx.match.trim();
  const id = Number(arg);
  if (!Number.isFinite(id) || id <= 0) {
    await ctx.reply("שימוש: /done <id>  — לדוגמה: /done 12");
    return;
  }
  const item = closeItem(id);
  if (!item) {
    await ctx.reply(`לא מצאתי משימה פתוחה עם id=${id}`);
    return;
  }
  await ctx.reply(`✓ נסגר: #${item.id} ${item.title}`);
});

// ===== Free-form text =====

async function handleUserMessage(ctx: typeof bot extends Bot<infer C> ? C : never, text: string) {
  if (!text.trim()) return;
  await ctx.replyWithChatAction("typing");
  eventBus.emitEvent({
    agent: "CEO",
    kind: "message",
    content: text,
    target_agent: "Shefi",
    meta: { source: "telegram" },
  });
  try {
    const reply = await runFromCEO(text, "Shefi");
    await ctx.reply(reply || "✓");
  } catch (err) {
    console.error("שגיאה בריצת הסוכן:", err);
    await ctx.reply("משהו השתבש. נסי שוב בעוד רגע.");
  }
}

bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return; // commands handled above
  await handleUserMessage(ctx, ctx.message.text);
});

bot.on(["message:voice", "message:audio"], async (ctx) => {
  await ctx.replyWithChatAction("typing");
  try {
    const transcript = await transcribeTelegramVoice(ctx);
    if (!transcript) {
      await ctx.reply("לא הצלחתי לתמלל את ההקלטה.");
      return;
    }
    await ctx.reply(`🎙️ "${transcript}"`);
    await handleUserMessage(ctx, transcript);
  } catch (err) {
    console.error("שגיאה בתמלול:", err);
    await ctx.reply("שגיאה בתמלול ההקלטה.");
  }
});

// ===== Error handling =====

bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Telegram API error:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Network error:", e);
  } else {
    console.error("Unexpected error:", e);
  }
});
