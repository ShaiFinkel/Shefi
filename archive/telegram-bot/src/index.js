import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Telegraf } from "telegraf";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const JSONL_PATH = path.join(DATA_DIR, "tasks.jsonl");

function required(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

function parseAllowedIds() {
  const raw = required("TELEGRAM_ALLOWED_USER_IDS");
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
  );
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function appendLocalTask(payload) {
  ensureDataDir();
  fs.appendFileSync(JSONL_PATH, JSON.stringify(payload) + "\n", "utf8");
}

/** Parses `Task title | YYYY-MM-DD` — due date is optional; use last segment as date if it matches ISO date. */
function parseTaskLine(raw) {
  const trimmed = raw.trim();
  const parts = trimmed.split("|").map((s) => s.trim());
  if (parts.length < 2) {
    return { title: trimmed, dueDate: null };
  }
  const last = parts[parts.length - 1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(last)) {
    const dueDate = last;
    const title = parts.slice(0, -1).join(" | ").trim();
    return { title: title || trimmed, dueDate };
  }
  return { title: trimmed, dueDate: null };
}

async function createAirtableTask({ title, dueDate, messageId }) {
  const key = process.env.AIRTABLE_API_KEY;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TASKS_TABLE || "Tasks";
  if (!key || !base) {
    return { ok: false, skipped: true };
  }

  const fieldTitle = process.env.FIELD_TITLE || "Title";
  const fieldDetails = process.env.FIELD_DETAILS || "Details";
  const fieldStatus = process.env.FIELD_STATUS || "Status";
  const fieldPriority = process.env.FIELD_PRIORITY || "Priority";
  const fieldSource = process.env.FIELD_SOURCE || "Source";
  const fieldTelegramId = process.env.FIELD_TELEGRAM_MESSAGE_ID || "Telegram message id";
  const fieldDueDate = process.env.FIELD_DUE_DATE || "Due date";

  const defaultStatus = process.env.DEFAULT_STATUS || "Todo";
  const defaultPriority = process.env.DEFAULT_PRIORITY || "P3";
  const sourceValue = process.env.SOURCE_VALUE || "telegram";

  const fields = {
    [fieldTitle]: title,
    [fieldDetails]: "",
    [fieldStatus]: defaultStatus,
    [fieldPriority]: defaultPriority,
    [fieldSource]: sourceValue,
  };
  if (dueDate) {
    fields[fieldDueDate] = dueDate;
  }
  if (fieldTelegramId && messageId != null) {
    fields[fieldTelegramId] = String(messageId);
  }

  const url = `https://api.airtable.com/v0/${encodeURIComponent(base)}/${encodeURIComponent(table)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${res.status}: ${text}`);
  }
  return { ok: true, record: await res.json() };
}

const SHEFI = "Shefi";

const allowedIds = parseAllowedIds();
const token = required("TELEGRAM_BOT_TOKEN");
const bot = new Telegraf(token);

bot.start((ctx) => {
  ctx.reply(
    `Hi — I'm ${SHEFI}.\n\nSend me any message and I'll add it to your to-do list.\n\nOptional due date:\nTask name | YYYY-MM-DD\nExample: Order cake | 2026-06-10\n\n(I save to your list in Airtable if you set that up, and always keep a backup log on the machine running the bot.)`
  );
});

bot.help((ctx) => {
  ctx.reply(
    `${SHEFI} — your task helper\n\nSend text → new task.\nDue date: Title | YYYY-MM-DD\nExample: Call venue | 2026-05-01`
  );
});

bot.on("text", async (ctx) => {
  const uid = ctx.from?.id;
  if (uid == null || !allowedIds.has(Number(uid))) {
    await ctx.reply(`${SHEFI}: I only take tasks from you — this account isn't allowed.`);
    return;
  }

  const raw = ctx.message.text.trim();
  if (!raw) {
    return;
  }

  const { title, dueDate } = parseTaskLine(raw);
  if (!title) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    telegramUserId: uid,
    messageId: ctx.message.message_id,
    title,
    dueDate: dueDate || undefined,
  };

  try {
    const result = await createAirtableTask({
      title,
      dueDate,
      messageId: ctx.message.message_id,
    });

    if (result.skipped) {
      appendLocalTask({ ...payload, airtable: "skipped" });
      const when = dueDate ? ` (due ${dueDate})` : "";
      await ctx.reply(
        `${SHEFI}: Saved on this device only. Add AIRTABLE_API_KEY + AIRTABLE_BASE_ID in .env to sync to the cloud.\n\nAdded: ${title}${when}`
      );
      return;
    }

    appendLocalTask({ ...payload, airtable: "ok" });
    const when = dueDate ? ` — due ${dueDate}` : "";
    await ctx.reply(`${SHEFI}: Got it — added: ${title}${when}`);
  } catch (e) {
    console.error(e);
    appendLocalTask({ ...payload, error: String(e.message || e) });
    await ctx.reply(
      `${SHEFI}: I saved it on this device, but the cloud sync failed: ${e.message}`
    );
  }
});

bot.launch().then(() =>
  console.log(`${SHEFI} is running — open Telegram and send /start`)
);
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
