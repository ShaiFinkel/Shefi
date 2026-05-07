# Airtable base: Office Ops

Create one base (e.g. **Office Ops**) with three core linked tables plus an optional **Planning** table. Use these field types so automations and the Telegram bot match [task-inbox.md](./task-inbox.md).

## 1. Table: `Employees`

| Field name | Type | Notes |
|------------|------|--------|
| Full name | Single line text | Primary field |
| Work email | Email | |
| Personal email | Email | Optional; gifts/shipping |
| Phone | Phone number | |
| Address line 1 | Single line text | |
| Address line 2 | Single line text | Optional |
| City | Single line text | |
| State / region | Single line text | Optional |
| Postal code | Single line text | |
| Country | Single select | e.g. IL, US, AU, other |
| Birthday | Date | Employee |
| Work anniversary | Date | Optional |
| Partner name | Single line text | Optional |
| Kids notes | Long text | Names, ages; minimize per [privacy-and-security.md](./privacy-and-security.md) |
| Kid 1 birthday | Date | Optional |
| Kid 2 birthday | Date | Optional |
| Dietary | Long text | |
| Shirt size | Single line text | |
| Gifting notes | Long text | |
| Manager | Single line text or Link | If you use another Employees link, use self-referential carefully |
| Team | Single line text | |
| Location | Single select | e.g. TLV, US remote, Sydney |
| Equipment | Link to `Equipment` | Allow linking to multiple records |
| Tasks | Link to `Tasks` | Allow linking to multiple records |
| Created | Created time | |
| Last modified | Last modified time | |

## 2. Table: `Equipment`

| Field name | Type | Notes |
|------------|------|--------|
| Asset label | Single line text | Primary field; e.g. `Laptop — Jane Doe 2025` |
| Employee | Link to `Employees` | Required |
| Category | Single select | Laptop, Monitor, Headset, Dock, Other |
| Serial number | Single line text | Unique when present |
| Vendor | Single line text | |
| Order ID | Single line text | |
| Invoice | Attachments | PDF/images |
| Invoice link | URL | Optional; if stored in Google Drive |
| Status | Single select | Ordered, Shipped, Delivered, Returned |
| Date ordered | Date | |
| Date delivered | Date | |
| Notes | Long text | |
| Tasks | Link to `Tasks` | Optional follow-ups |

## 3. Table: `Tasks`

| Field name | Type | Notes |
|------------|------|--------|
| Title | Single line text | Primary field |
| Details | Long text | |
| Due date | Date | |
| Status | Single select | Todo, In progress, Done, Blocked |
| Priority | Single select | P1, P2, P3 |
| Source | Single select | manual, telegram, automation, whatsapp (add when you enable WhatsApp) |
| Related employee | Link to `Employees` | Optional |
| Related equipment | Link to `Equipment` | Optional |
| Telegram message id | Single line text | Optional; for idempotency/debug |
| Created | Created time | |

## 4. Table: `Planning` (optional — “plan ahead” lead times)

Use this to remember **how many days before** an event type you want to start work. You still create the actual reminder events in Google Calendar ([google-calendar-holidays.md](./google-calendar-holidays.md)); this table keeps your lead-time rules consistent.

| Field name | Type | Notes |
|------------|------|--------|
| Event name | Single line text | Primary field; e.g. `Rosh Hashanah gifts` |
| Region | Single select | IL, US, AU, Global |
| Lead time days | Number | Days **before** the event/holiday to start planning |
| Notes | Long text | Vendor, budget link, etc. |
| Active | Checkbox | Uncheck to retire without deleting |

## Views (recommended)

- **Employees — Birthdays this month**: filter `Birthday` where month = current month.
- **Equipment — Open orders**: `Status` is Ordered or Shipped.
- **Tasks — My week**: `Status` not Done, `Due date` within next 7 days.
- **Tasks — Telegram**: filter `Source` = telegram.
- **Planning — Active**: filter `Active` is checked.

## API use

The Telegram bot can create rows in `Tasks` via the Airtable REST API using a Personal Access Token with `data.records:write` on this base. Table names and field names must match what you configure in `telegram-bot/.env` (see that folder’s README).
