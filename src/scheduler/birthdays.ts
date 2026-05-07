import cron from "node-cron";
import type { Bot } from "grammy";
import { InlineKeyboard, InputFile } from "grammy";
import { env } from "../lib/env.js";
import { eventBus } from "../server/events.js";
import {
  approveOrdersForMonth,
  listOrdersForMonth,
  markOrdersSentForMonth,
  skipOrdersForMonth,
} from "../db/employees.js";
import {
  buyMeCsvForMonth,
  createOrdersForMonth,
  formatPreview,
} from "../agents/ops/birthdays-tools.js";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
}

async function broadcastToAllowed(bot: Bot, text: string, extra?: Parameters<Bot["api"]["sendMessage"]>[2]) {
  for (const userId of env.ALLOWED_USER_IDS) {
    try {
      await bot.api.sendMessage(userId, text, extra);
    } catch (err) {
      console.error(`שליחה ל־${userId} נכשלה:`, err);
    }
  }
}

export async function runMonthlyBirthdayPreview(bot: Bot, month?: string): Promise<void> {
  const ym = month ?? currentMonth();
  console.log(`[cron] monthly birthday preview for ${ym}`);

  const { created } = createOrdersForMonth(ym);
  const preview = formatPreview(ym);

  const orders = listOrdersForMonth(ym);
  const pending = orders.filter((o) => o.status === "pending");

  const text = [
    preview,
    "",
    pending.length > 0
      ? `🟡 ${pending.length} הזמנות ממתינות לאישור (חדשות החודש: ${created}).`
      : "אין הזמנות ממתינות.",
  ].join("\n");

  const keyboard = new InlineKeyboard()
    .text("✅ אשר הכל", `bday:approve:${ym}`)
    .text("✗ בטל", `bday:skip:${ym}`)
    .row()
    .text("📥 הורד CSV ל־BuyMe", `bday:csv:${ym}`)
    .text("✓ סומן כנשלח", `bday:sent:${ym}`);

  await broadcastToAllowed(bot, text, {
    reply_markup: keyboard,
  });

  eventBus.emitEvent({
    agent: "Yael",
    kind: "system",
    content: `הצגתי תצוגה מקדימה לחודש ${ym}: ${pending.length} הזמנות ממתינות.`,
    meta: { month: ym, pending: pending.length },
  });
}

export function registerBirthdayCallbacks(bot: Bot): void {
  bot.callbackQuery(/^bday:(approve|skip|csv|sent):(\d{4}-\d{2})$/, async (ctx) => {
    const action = ctx.match[1];
    const month = ctx.match[2];

    try {
      if (action === "approve") {
        const n = approveOrdersForMonth(month);
        await ctx.answerCallbackQuery(`✅ אושרו ${n}`);
        await ctx.reply(
          `✅ אושרו ${n} הזמנות לחודש ${month}.\nעכשיו לחצי "📥 הורד CSV" כדי לקבל קובץ ל־BuyMe Business.`,
        );
        eventBus.emitEvent({
          agent: "Yael",
          kind: "system",
          content: `${n} הזמנות אושרו ע״י ה־CEO לחודש ${month}.`,
        });
      } else if (action === "skip") {
        const n = skipOrdersForMonth(month);
        await ctx.answerCallbackQuery(`✗ בוטלו ${n}`);
        await ctx.reply(`✗ ${n} הזמנות בוטלו לחודש ${month}.`);
      } else if (action === "csv") {
        const csv = buyMeCsvForMonth(month);
        if (!csv.split("\n").slice(1).filter((l) => l.trim()).length) {
          await ctx.answerCallbackQuery("אין הזמנות מאושרות");
          await ctx.reply(`אין הזמנות מאושרות לייצוא לחודש ${month}.`);
          return;
        }
        await ctx.answerCallbackQuery("שולחת CSV…");
        const buf = Buffer.from(csv, "utf-8");
        await ctx.replyWithDocument(new InputFile(buf, `buyme-${month}.csv`), {
          caption: [
            `📥 קובץ BuyMe Business לחודש ${month}.`,
            "תעלי אותו ל־BuyMe Business → Bulk Order, ובדקי שהתאריכים שמורים.",
            "אחרי שהשליחה תוזמנה — לחצי 'סומן כנשלח' או כתבי לי 'נשלח'.",
          ].join("\n"),
        });
      } else if (action === "sent") {
        const n = markOrdersSentForMonth(month);
        await ctx.answerCallbackQuery(`✓ ${n} סומנו כנשלחו`);
        await ctx.reply(`✓ ${n} הזמנות סומנו כנשלחו לחודש ${month}.`);
      }
    } catch (err) {
      console.error("birthday callback error:", err);
      await ctx.answerCallbackQuery("שגיאה");
    }
  });
}

export function startBirthdayScheduler(bot: Bot): void {
  // 1st of every month at 09:00 → preview + pending approval
  cron.schedule(
    "0 9 1 * *",
    () => {
      runMonthlyBirthdayPreview(bot).catch((err) =>
        console.error("monthly birthday preview failed:", err),
      );
    },
    { timezone: env.TZ },
  );
  console.log(`[scheduler] birthdays cron active (1st of month, 09:00 ${env.TZ}).`);
}
