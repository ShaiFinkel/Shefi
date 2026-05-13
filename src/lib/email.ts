// Thin wrapper around Resend.
// Falls back to console.log when RESEND_API_KEY is not set, so dev still works.
//
// Why Resend: simplest API, generous free tier (3K/month), HTML-friendly,
// no SMTP plumbing. Sign up at https://resend.com.

import { Resend } from "resend";
import { env } from "./env.js";

let client: Resend | null = null;
if (env.RESEND_API_KEY) {
  client = new Resend(env.RESEND_API_KEY);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!client) {
    // Dev-mode fallback: log the message so the developer can copy the link
    // straight from the console.
    console.log(
      `\n📧 [EMAIL — dev mode, no RESEND_API_KEY set]\n  to:      ${input.to}\n  subject: ${input.subject}\n  ---\n${input.text ?? stripHtml(input.html)}\n  ---\n`,
    );
    return { ok: true, id: "dev" };
  }

  try {
    const result = await client.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
    });
    if (result.error) {
      console.error("[email] resend error:", result.error);
      return { ok: false, error: result.error.message ?? String(result.error) };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] failed:", message);
    return { ok: false, error: message };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .trim();
}

// ===== Templates =====

export function magicLinkTemplate(input: {
  employeeName: string;
  link: string;
  ttlMinutes: number;
}): { subject: string; html: string; text: string } {
  const subject = `הקישור שלך לכניסה ל־Shefi & Co.`;
  const text = `שלום ${input.employeeName},

לחצי על הקישור הבא כדי להיכנס למערכת. הקישור בתוקף ל־${input.ttlMinutes} דקות וניתן לשימוש פעם אחת בלבד:

${input.link}

אם לא ביקשת להיכנס — אפשר להתעלם מהמייל.

— Shefi & Co.`;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0b0d12;font-family:'Assistant','Heebo',-apple-system,sans-serif;direction:rtl;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0d12;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:480px;width:100%;background:#141821;border:1px solid #1b212d;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;text-align:center;">
          <div style="display:inline-block;width:64px;height:64px;border-radius:16px;background:#7c5cff;color:white;font-size:32px;font-weight:bold;line-height:64px;margin-bottom:16px;">ש</div>
          <h1 style="margin:0;color:#e6e8ee;font-size:22px;font-weight:600;">Shefi &amp; Co.</h1>
          <p style="margin:6px 0 0;color:#a3aab8;font-size:14px;">כניסה למערכת</p>
        </td></tr>
        <tr><td style="padding:0 32px 16px;color:#e6e8ee;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">שלום ${escapeHtml(input.employeeName)},</p>
          <p style="margin:0 0 24px;color:#a3aab8;">לחצי על הכפתור כדי להיכנס. הקישור בתוקף ל־${input.ttlMinutes} דקות וניתן לשימוש פעם אחת.</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="${input.link}" style="display:inline-block;background:#7c5cff;color:white;text-decoration:none;font-weight:600;font-size:16px;padding:14px 32px;border-radius:10px;">כניסה למערכת ←</a>
        </td></tr>
        <tr><td style="padding:0 32px 24px;color:#a3aab8;font-size:12px;line-height:1.6;text-align:center;">
          <p style="margin:0 0 8px;">או העתיקי את הקישור הבא לדפדפן:</p>
          <p style="margin:0;word-break:break-all;color:#7c5cff;direction:ltr;text-align:left;background:#0b0d12;padding:8px;border-radius:6px;">${escapeHtml(input.link)}</p>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #1b212d;color:#a3aab8;font-size:12px;line-height:1.6;text-align:center;">
          לא ביקשת להיכנס? אפשר להתעלם מהמייל הזה.
        </td></tr>
      </table>
      <p style="color:#5a6172;font-size:11px;margin:16px 0 0;">Shefi &amp; Co. · Welfare Operations</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export function managerApprovalTemplate(input: {
  managerName: string;
  employeeName: string;
  itemName: string;
  quantity: number;
  justification: string | null;
  deliveryTo: "office" | "home" | null;
  deliveryAddress: string | null;
  approveLink: string;       // one-click approve URL
  rejectLink: string;        // opens reject form (asks for reason)
  portalLink: string;        // fallback: open the full portal
}): { subject: string; html: string; text: string } {
  const subject = `🔔 בקשת ציוד חדשה מ־${input.employeeName} ממתינה לאישורך`;
  const text = `שלום ${input.managerName},

${input.employeeName} הגיש/ה בקשת ציוד חדשה שדורשת את אישורך:

  פריט: ${input.itemName}
  כמות: ${input.quantity}
  ${input.justification ? `נימוק: ${input.justification}` : ""}
  ${input.deliveryTo === "home" ? `יעד: משלוח הביתה (${input.deliveryAddress ?? ""})` : input.deliveryTo === "office" ? "יעד: למשרד" : ""}

✓ אישור (קליק אחד מאשר ישירות):
${input.approveLink}

✕ דחייה (יפתח דף לציון סיבה):
${input.rejectLink}

לפרטים נוספים בפורטל המלא:
${input.portalLink}

— Shefi & Co.`;

  const deliveryHtml =
    input.deliveryTo === "home"
      ? `&nbsp;·&nbsp; <span style="color:#5cd6a8;">🏠 משלוח הביתה</span>`
      : input.deliveryTo === "office"
        ? `&nbsp;·&nbsp; 🏢 למשרד`
        : "";

  const addressBlock =
    input.deliveryTo === "home" && input.deliveryAddress
      ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #1b212d;font-size:12px;color:#a3aab8;line-height:1.6;"><span style="color:#5cd6a8;">🏠 כתובת:</span> ${escapeHtml(input.deliveryAddress)}</div>`
      : "";

  const justificationBlock = input.justification
    ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #1b212d;font-size:13px;color:#e6e8ee;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.justification)}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0d12;font-family:'Assistant','Heebo',-apple-system,sans-serif;direction:rtl;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0d12;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:#141821;border:1px solid #1b212d;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 32px 16px;border-bottom:1px solid #1b212d;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:44px;"><div style="width:44px;height:44px;border-radius:10px;background:#7c5cff;color:white;font-size:22px;font-weight:bold;line-height:44px;text-align:center;">ש</div></td>
            <td style="padding-right:12px;">
              <div style="color:#e6e8ee;font-size:16px;font-weight:600;">Shefi &amp; Co.</div>
              <div style="color:#a3aab8;font-size:12px;">בקשה ממתינה לאישורך</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:24px 32px 8px;color:#e6e8ee;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px;">שלום ${escapeHtml(input.managerName)},</p>
          <p style="margin:0 0 16px;color:#a3aab8;">
            <strong style="color:#e6e8ee;">${escapeHtml(input.employeeName)}</strong>
            הגיש/ה בקשת ציוד חדשה שדורשת את אישורך.
          </p>
        </td></tr>

        <tr><td style="padding:0 32px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background:#0b0d12;border:1px solid #1b212d;border-radius:10px;">
            <tr><td style="padding:16px;color:#e6e8ee;">
              <div style="font-size:16px;font-weight:600;margin-bottom:8px;">${escapeHtml(input.itemName)}</div>
              <div style="font-size:13px;color:#a3aab8;line-height:1.7;">
                כמות: <span style="color:#e6e8ee;">${input.quantity}</span>${deliveryHtml}
              </div>
              ${justificationBlock}
              ${addressBlock}
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td style="padding-left:6px;width:50%;">
              <a href="${input.approveLink}" style="display:block;background:#5cd6a8;color:#0b0d12;text-decoration:none;font-weight:700;font-size:15px;padding:14px 12px;border-radius:10px;text-align:center;">✓ אישור</a>
            </td>
            <td style="padding-right:6px;width:50%;">
              <a href="${input.rejectLink}" style="display:block;background:#ff7c5c;color:#0b0d12;text-decoration:none;font-weight:700;font-size:15px;padding:14px 12px;border-radius:10px;text-align:center;">✕ דחייה</a>
            </td>
          </tr></table>
          <p style="margin:10px 0 0;text-align:center;font-size:11px;color:#a3aab8;">
            "אישור" — מאשר מיד בלחיצה אחת.<br/>
            "דחייה" — יפתח דף קצר לציון הסיבה.
          </p>
        </td></tr>

        <tr><td style="padding:0 32px 28px;text-align:center;">
          <a href="${input.portalLink}" style="display:inline-block;color:#7c5cff;text-decoration:none;font-size:13px;border-bottom:1px dotted #7c5cff;padding-bottom:1px;">לפתיחה בפורטל המלא →</a>
        </td></tr>
      </table>
      <p style="color:#5a6172;font-size:11px;margin:16px 0 0;">Shefi &amp; Co. · Welfare Operations</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
