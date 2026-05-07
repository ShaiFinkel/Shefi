# WhatsApp roadmap (after Telegram)

Telegram is implemented first ([telegram-bot/](../telegram-bot/), [telegram-make.md](./telegram-make.md)). WhatsApp uses the **same task shape** (webhook → create row in `Tasks`).

## What you need for WhatsApp Business Platform

1. **Meta Business Portfolio** and **Business Verification** (can take days/weeks).
2. A **phone number** not already on consumer WhatsApp (or migration per Meta rules).
3. **WhatsApp Business Platform** access via:
   - **Meta Cloud API** (hosted by Meta), or
   - A **BSP** (Business Solution Provider) such as Twilio, 360dialog, MessageBird, etc.

## Mirror Telegram behavior

| Step | Telegram (current) | WhatsApp (later) |
|------|--------------------|------------------|
| Inbound message | Telegraf long poll or Make Telegram trigger | Webhook POST from Meta/Twilio with `from` + `text` |
| Auth | Allow-list Telegram user IDs | Allow-list WhatsApp **E.164** numbers in your automation or app |
| Outbound confirm | `ctx.reply(...)` | Send template or session message per Meta policy (templates required for proactive msgs outside 24h window) |
| Task row | Airtable **Tasks** same fields | Identical Airtable POST |

## Implementation notes

- **Make.com / Zapier:** add a **WhatsApp** trigger module from your BSP when available; map `message text` → Airtable **Title**, **Source** = `whatsapp` (add this option to your Airtable `Source` single-select).
- **Custom code:** one small HTTPS endpoint that verifies Meta’s `X-Hub-Signature-256`, parses JSON, dedupes by `wamid`, calls Airtable API — same pattern as the Telegram bot’s `createAirtableTask` logic.

## Compliance

WhatsApp has **commerce and messaging policies**; internal employee-assistant use still requires correct registration and user opt-in where applicable. Review Meta’s docs when you enable the number.

## Suggested order

1. Stabilize Telegram + Airtable workflows.
2. Complete Business Verification.
3. Connect BSP → Make or custom webhook → same **Tasks** table.
4. Add `whatsapp` to **Source** in Airtable and update docs.
