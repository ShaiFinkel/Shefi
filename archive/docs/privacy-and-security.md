# Privacy and security checklist (employee PII)

Use this when standing up Airtable, Google Calendar, Telegram, and backups. **Not legal advice** — confirm with HR/legal for Israel, US, AU, and any other regions where employees reside.

## Data minimization

- [ ] Store only fields you **need** for shipping, gifts, and ops (see [airtable-schema.md](./airtable-schema.md)).
- [ ] **Kids’ data** — justify each field; consider storing only “has kids / ages bracket” if full names/dates are not required.
- [ ] Separate **work** vs **personal** email usage in your process documentation.

## Access control

- [ ] **Airtable:** smallest base access; 2FA on the account; Personal Access Tokens scoped to one base and rotated if leaked.
- [ ] **Google:** 2FA; calendar shared only with people who must see planning events.
- [ ] **Telegram bot:** `TELEGRAM_ALLOWED_USER_IDS` in [telegram-bot/.env.example](../telegram-bot/.env.example) so random users cannot create tasks.
- [ ] **Make/Zapier:** workspace login secured; minimum connector permissions.

## Retention and deletion

- [ ] Define how long you keep **home addresses** and **phone numbers** after offboarding.
- [ ] Process for **deleting** or **anonymizing** Airtable rows when HR confirms departure.

## Invoices and files

- [ ] Store invoice PDFs in **Google Drive** (or company-approved DMS) with restricted folders; link from Airtable **Invoice link** rather than wide sharing.
- [ ] Naming: `Vendor_OrderID_Lastname.pdf` — avoid full employee dossiers in filenames if not needed.

## Transport

- [ ] HTTPS only (Airtable API, Google APIs, Telegram API).
- [ ] Never commit `.env`, tokens, or exports to git (see [telegram-bot/.gitignore](../telegram-bot/.gitignore)).

## Incident response

- [ ] If a token leaks: revoke in Airtable/Google/Telegram immediately; rotate keys; review automation logs.

## Review cadence

- **Quarterly:** who has access to the base?
- **Annually:** field list still justified?
