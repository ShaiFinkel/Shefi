# Shefi — your personal assistant

**Shefi** helps you remember what you need to do. You talk to her on **Telegram**; she keeps your list somewhere safe (a file on your computer and/or **Airtable**).

## Phase 1 — Now: write her, she saves it

1. You open Telegram and message **Shefi** (your bot).
2. You write a task in plain language, e.g. `Call the caterer` or `Buy gift wrap | 2026-12-15` (optional due date: **title | YYYY-MM-DD**).
3. Shefi adds it to your to-do list and confirms.

**Setup:** [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) — use the **“Shefi only”** steps first.

## Phase 2 — Later: she pings you when it’s time

You want reminders based on **things you told her** (due dates, recurring stuff, maybe birthdays or office events).

That usually means:

- **Due dates** on tasks (you can already send `something | 2026-06-01`), **plus**
- A **reminder layer**: e.g. Telegram messages at the right time, or notifications from **Google Calendar**, or **Airtable** automations + a scheduler.

We have not built the automatic “ping” loop in code yet; when you’re ready, we can add a small **scheduler** (cron job or hosted worker) that reads tasks with due dates and messages you on Telegram, or connect calendar reminders. Same Shefi bot can send those messages.

## Office / HR extras (optional)

The rest of this repo (employees, equipment, holidays) is **optional** — only if you also run office ops from the same system. Shefi’s core is: **Telegram → tasks → reminders later.**
