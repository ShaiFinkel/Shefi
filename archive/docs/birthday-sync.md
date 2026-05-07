# Birthday and family dates → Google Calendar

Goal: recurring **all-day** events (e.g. “Birthday — Jane Doe”) so you get Google’s notifications without typing PII into event titles more than necessary.

## Option A — Make.com (no code)

1. **Trigger:** Airtable — Watch records (Employees table) or “When record matches condition” on schedule (daily).
2. **Logic:** For each employee with `Birthday` set, ensure a matching event exists for the current year. Simplest MVP: **monthly** scenario on the 1st that lists employees whose birthday falls in that month and creates Calendar events via **Google Calendar — Create an event**:
   - Summary: `Birthday — {{Full name}}`
   - All-day: yes
   - Start date: construct `YYYY-MM-DD` for this year from month/day of `Birthday` (use Make’s date functions).
3. **Kid birthdays:** duplicate module branch using `Kid 1 birthday` / `Kid 2 birthday` with titles like `Kid birthday — {{Full name}} family` (minimize child names in titles if you prefer internal notes only).

**Idempotency:** Either search Calendar first (Google Calendar — Search events) or store “last synced year” in Airtable to avoid duplicates.

## Option B — Airtable Automation + Calendar (limited)

Native Airtable automations cannot create Google Calendar events without a third-party action. Use Option A or C.

## Option C — Script (Node) with Google Calendar API

If you self-host later:

1. Enable **Google Calendar API** in a Google Cloud project; OAuth consent + credentials for a desktop or service account (Workspace domain-wide if company-owned).
2. Store refresh token locally; run a cron job that reads Airtable API (Employees) and upserts events.

This repo does not ship OAuth secrets; use Option A for MVP.

## Privacy

- Calendar titles: use **first name + last initial** if your org prefers less exposure on shared calendars.
- Restrict calendar visibility to yourself or a small ops group.

## Reminder timing

In Google Calendar settings, set default notifications for that calendar (e.g. 1 week + 1 day before all-day events). Adjust per your gifting lead time.
