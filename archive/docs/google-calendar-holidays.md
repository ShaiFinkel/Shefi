# Google Calendar: multi-country holidays and planning lead times

Use **one primary Google account** (or your work Google Workspace if policy allows) for the “office ops” calendar layer.

## 1. Subscribe to holiday calendars (Israel, United States, Australia)

In **Google Calendar** (web: [calendar.google.com](https://calendar.google.com)):

1. Left sidebar → **Other calendars** → **+** → **Browse calendars of interest**.
2. Under **Regional holidays**, add:
   - **Holidays in Israel**
   - **Holidays in United States**
   - **Holidays in Australia**
3. Optionally toggle **Jewish holidays** (if listed in your region’s “Religious holidays” section) for visibility alongside civil calendars—verify dates against your org’s practice.

These subscriptions update automatically each year. You do not maintain holiday logic by hand at MVP.

### Optional: iCal URLs (advanced)

If you need a secondary calendar app, Google’s subscribed calendars sync to mobile apps signed into the same account. Third-party iCal feeds for holidays exist but vary by maintainer; prefer Google’s built-in regional feeds for reliability.

## 2. Planning reminders (“start early”)

Public holidays only show **the day itself**. Operational work (ordering gifts, booking venues, catering lead times) needs **separate events** *before* the holiday.

### Recommended pattern

1. Create a dedicated calendar, e.g. **Office ops — planning** (color distinct from holidays).
2. For each recurring need, add **recurring events** with reminders:
   - Example: **Plan Rosh Hashanah gifts — start** → 6 weeks before (set first occurrence, then repeat yearly; adjust if Hebrew calendar alignment matters for your process).
   - Example: **US Thanksgiving team lunch — book venue** → 8 weeks before US Thanksgiving week.

### Lead-time table (tweak in Airtable if you want)

You can mirror this in Airtable as a small **Planning templates** table (optional): Event name, Region, Lead time (days), Notes—then review quarterly and create/update Google events. For MVP, manual recurring events in **Office ops — planning** are enough.

## 3. Notifications

Per calendar, set default **notification** (e.g. 1 week + 1 day before) on planning events. Keep holiday calendars as **all-day** visibility only if alerts would be noisy; rely on **Office ops — planning** for actionable pings.

## 4. Sharing

Share **Office ops — planning** with anyone who helps execute; keep **Employees** PII out of Google Calendar event descriptions—use links to Airtable or internal docs with access control.
