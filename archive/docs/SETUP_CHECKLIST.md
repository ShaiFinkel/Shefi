# Setup checklist (do in order)

Only **you** can complete cloud steps (Airtable, Google). This repo already contains the bot code and docs.

## Shefi only — personal tasks (start here)

Use this if you just want **Telegram → to-do list** ([shefi.md](./shefi.md)).

- [ ] **Telegram bot:** In Telegram, talk to [@BotFather](https://t.me/BotFather) → `/newbot` → name it **Shefi** (or any name) → copy the **token**.
- [ ] **Your user id:** Message [@userinfobot](https://t.me/userinfobot) → copy your **Id**.
- [ ] **Run the bot:** In `telegram-bot/`, copy `.env.example` to `.env`, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_IDS`, then `npm install` and `npm start`.

### Step 3 in plain English (the `.env` file)

Think of `.env` as a **sticky note** only Shefi’s program reads.

1. Open the folder **`telegram-bot`** on your computer (inside the Shefi project).
2. Find the file **`.env.example`**. **Duplicate it** and rename the copy to **`.env`** (exactly that name, with the dot at the start).
3. Open **`.env`** in a text editor.
4. After `TELEGRAM_BOT_TOKEN=`, paste the **long secret** from BotFather (no spaces).
5. After `TELEGRAM_ALLOWED_USER_IDS=`, paste **your number** from userinfobot (only digits; if several people, separate with commas).
6. Open **Terminal** (or Cursor’s terminal), go into that folder: `cd telegram-bot`, then run **`npm install`** once, then **`npm start`**.
7. Leave that window **open** while you use Shefi — closing it stops her.

- [ ] **Try it (see below):** Open your bot in Telegram and send a test message.
- [ ] **Optional — Airtable:** Create a base with a **Tasks** table (see [airtable-schema.md](./airtable-schema.md), table **Tasks** only is enough). Add token + base id to `.env` so tasks sync to the cloud.

### Step 4 in plain English

1. On your phone or computer, open **Telegram**.
2. Find **your bot** (the same name you gave BotFather, e.g. Shefi).
3. Tap **Start** or type **`/start`** once.
4. Type any sentence, like: `Remind me to call Dana`.
5. **If it worked:** the bot answers you (something like “Got it — added…”).
6. **Where did it go?** On the computer where you ran `npm start`, Shefi also writes one line into a small log file: `telegram-bot/data/tasks.jsonl`. You don’t have to open that file unless you’re curious — the important part is that she replied.

Skip sections 2–6 below until you need calendars, birthdays, or WhatsApp.

---

## 1. Airtable base (full office ops)

- [ ] Create a base **Office Ops**.
- [ ] Add tables and fields from [airtable-schema.md](./airtable-schema.md) (`Employees`, `Equipment`, `Tasks`; optional `Planning`).
- [ ] Add single-select options exactly as documented (e.g. **Status**, **Source**, **Priority**).
- [ ] Optional: import empty rows using CSV headers in [data/templates/](../data/templates/).
- [ ] Create a **Personal Access Token** (Airtable → Developer hub) with read/write on this base.

## 2. Google Calendar

- [ ] Add regional holidays: Israel, United States, Australia ([google-calendar-holidays.md](./google-calendar-holidays.md)).
- [ ] Create calendar **Office ops — planning** and add recurring **planning** events with lead times (or drive them from the `Planning` table + manual review).

## 3. Telegram bot (this repo)

- [ ] In Telegram: `/newbot` with [@BotFather](https://t.me/BotFather); copy the token.
- [ ] Get your user id from [@userinfobot](https://t.me/userinfobot).
- [ ] `cd telegram-bot && cp .env.example .env` and fill `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`, and Airtable variables.
- [ ] Run `npm install` (once) and `npm start`.
- [ ] Message the bot: a short task, then try `Task title | 2026-12-01` to confirm **Due date** fills in Airtable.

## 4. Birthdays on the calendar

- [ ] Follow [birthday-sync.md](./birthday-sync.md) (Make.com recommended for no-code).

## 5. Privacy and access

- [ ] Walk through [privacy-and-security.md](./privacy-and-security.md) with HR/legal if needed.
- [ ] Enable 2FA on Airtable and Google.

## 6. WhatsApp (later)

- [ ] [whatsapp-roadmap.md](./whatsapp-roadmap.md) when you are ready for Meta Business + a BSP.

## Alternative: no server

- [ ] Use [telegram-make.md](./telegram-make.md) to send Telegram messages straight to Airtable via Make.com (add the same `Title` / optional due-date parsing in a Make text parser if you need it).
