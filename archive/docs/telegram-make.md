# Telegram → Tasks (Make.com / Zapier) and local bot

You can capture tasks in two ways:

1. **This repo’s Telegram bot** ([../telegram-bot/README.md](../telegram-bot/README.md)) — runs on your machine or a host; writes to Airtable and/or a local JSONL file.
2. **Make.com** (or Zapier) — no server to maintain; same Airtable `Tasks` table.

## Make.com scenario (recommended if you avoid code)

### Prerequisites

- Airtable base with [airtable-schema.md](./airtable-schema.md) `Tasks` table.
- Airtable **Personal Access Token** (create in Airtable → Developer hub) with access to this base.
- Telegram bot token from [@BotFather](https://t.me/BotFather).

### Modules

1. **Telegram Bot — Watch updates** (or “New message”) — select your bot connection; restrict to your chat if the module allows filtering by `from.id`.
2. **Router** (optional) — ignore commands like `/start` if empty body.
3. **Airtable — Create a record**
   - Base: your Office Ops base
   - Table: `Tasks`
   - Fields:
     - **Title** = `{{1.text}}` (first module’s message text)
     - **Details** = empty or same as title
     - **Source** = `telegram`
     - **Status** = `Todo`
     - **Priority** = `P3`
4. **Telegram Bot — Send a message** (optional): reply “Added: …” to confirm.

### Security

- In Make, use a **Telegram connection** only you control.
- Add a **filter** after the trigger: `from.id` equals your numeric Telegram user ID (get it by messaging [@userinfobot](https://t.me/userinfobot) or logging the first bundle).

### Zapier equivalent

Trigger: **Telegram — New Message** (if available in your Zapier plan) or **Webhooks by Zapier** if you use the repo bot to POST to Zapier. Action: **Airtable — Create Record** with the same field mapping.

## Parsing due dates

The repo bot accepts **`Task title | YYYY-MM-DD`** (see [telegram-bot/README.md](../telegram-bot/README.md)). In Make.com, add a **Tools → Set variable** or **Text parser** step: if the message matches `*|*-*-*`, split and map the date segment to Airtable **Due date** and the rest to **Title**.
