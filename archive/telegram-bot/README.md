# Shefi — Telegram bot

**Shefi** reads what you send on Telegram and turns it into a task: a row in your Airtable **Tasks** table, or a line in `data/tasks.jsonl` if Airtable is not configured yet.

See **[docs/shefi.md](../docs/shefi.md)** for the big picture.

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather), copy the token.
2. Get your numeric user ID from [@userinfobot](https://t.me/userinfobot).
3. Copy `.env.example` to `.env` and set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_IDS` (comma-separated if multiple admins).
4. In [Airtable Developer Hub](https://airtable.com/create/tokens), create a token with `data.records:read` and `data.records:write` for your base.
5. Set `AIRTABLE_BASE_ID` (from API docs URL or base settings) and optionally adjust table/field names to match [docs/airtable-schema.md](../docs/airtable-schema.md).

## Run

```bash
cd telegram-bot
npm install
npm start
```

Keep the process running (your laptop, or a host like Railway/Fly.io). Long polling works anywhere outbound HTTPS is allowed.

## Behavior

- Any text message from an allowed user creates a task with **Title** = message text, **Source** = `telegram`, **Status** = `Todo`, **Priority** = `P3`.
- Optional: `Order swag | 2026-05-15` sets **Title** to `Order swag` and **Due date** to `2026-05-15` (field name configurable via `FIELD_DUE_DATE` in `.env`).
- A line is always appended to `data/tasks.jsonl` for backup (gitignored).
- Unauthorized users get “Unauthorized.”

## Make.com alternative

See [docs/telegram-make.md](../docs/telegram-make.md) if you prefer no server.
