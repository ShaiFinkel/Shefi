# Task inbox decision

## Single source of truth: **Airtable — Tasks table**

All todos live in the **Tasks** table in your Office Ops base (see [airtable-schema.md](./airtable-schema.md)). Nothing is duplicated in Todoist or Microsoft To Do for the MVP, so automations (Telegram, future WhatsApp) have one place to write.

**Why Airtable only**

- Same tool as employees and equipment; you can link tasks to people and assets.
- One automation target for Telegram/Make/Zapier.
- You can add a synced view to Todoist later if you want a separate UI; keep Airtable authoritative until then.

## Naming conventions

| Field / use | Convention | Example |
|-------------|------------|---------|
| **Title** | Imperative, short; optional context in Details | `Order Purim gifts for TLV office` |
| **Status** | One of the single-select values (do not invent ad-hoc text) | `Todo`, `In progress`, `Done`, `Blocked` |
| **Priority** | `P1` (this week), `P2` (this month), `P3` (backlog) | `P2` |
| **Source** | How the row was created | `telegram`, `manual`, `automation`; add `whatsapp` when you enable it ([whatsapp-roadmap.md](./whatsapp-roadmap.md)) |
| **Related employee** | Link when the task is about one person | Link field |
| **Related equipment** | Link when follow-up is about a specific asset | Link field |
| **Due date** | Date-only unless a specific time matters | `2026-04-20` |

## Telegram messages → Tasks

- **Default:** entire message becomes **Title**.
- **Due date:** `Task title | YYYY-MM-DD` (implemented in [telegram-bot/src/index.js](../telegram-bot/src/index.js)); same pattern can be replicated in Make.com ([telegram-make.md](./telegram-make.md)).

## Review rhythm

- **Weekly:** filter `Status != Done` and `Due date` in the next 14 days.
- **Monthly:** archive or mark **Done** for completed operational tasks; keep equipment-linked rows for audit if needed.
