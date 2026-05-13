// Public-facing API for the employee portal (PWA).
//
// All endpoints under /api/auth/* and /api/employee/* live here.
// Admin endpoints (/api/...) stay in api-dashboard.ts.

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as cookie from "cookie";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  MAGIC_LINK_TTL_MS,
  consumeEmailToken,
  createEmailToken,
  createSession,
  deleteSession,
  findEmployeeByEmail,
  findSessionWithEmployee,
  createApprovalTokens,
  findApprovalToken,
  consumeApprovalToken,
} from "../db/auth.js";
import { sendEmail, magicLinkTemplate, managerApprovalTemplate } from "../lib/email.js";
import { env } from "../lib/env.js";
import {
  createRequest,
  getRequest,
  listPendingForManager,
  listRequests,
  managerApprove,
  reject as rejectRequest,
  type EquipmentRequestEnriched,
} from "../db/equipment.js";
import { getEmployeeById, getManagerOf, listDirectReports } from "../db/employees.js";

// ===== Helpers =====

function getCookies(req: FastifyRequest): Record<string, string | undefined> {
  const header = req.headers.cookie ?? "";
  return cookie.parse(header);
}

function isRequestSecure(req: FastifyRequest): boolean {
  // Trust the actual scheme Fastify sees, plus the X-Forwarded-Proto header
  // that Cloudflare Tunnel / nginx-style proxies set. Without this, cookies
  // marked "secure" would never be sent back over a tunnel that terminates
  // TLS at the edge.
  if ((req.protocol ?? "").startsWith("https")) return true;
  const xfp = req.headers["x-forwarded-proto"];
  return typeof xfp === "string" && xfp.split(",")[0].trim() === "https";
}

function setSessionCookie(req: FastifyRequest, reply: FastifyReply, token: string): void {
  const value = cookie.serialize(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isRequestSecure(req),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  reply.header("Set-Cookie", value);
}

function clearSessionCookie(req: FastifyRequest, reply: FastifyReply): void {
  const value = cookie.serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isRequestSecure(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  reply.header("Set-Cookie", value);
}

/**
 * Authenticates the request using the session cookie.
 * Returns the session+employee or null. Does NOT send any HTTP response.
 */
export function authenticateEmployee(req: FastifyRequest):
  | ReturnType<typeof findSessionWithEmployee>
  | null {
  const cookies = getCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return findSessionWithEmployee(token);
}

/**
 * Use as preHandler. Returns 401 if there's no valid session.
 */
export async function requireEmployee(req: FastifyRequest, reply: FastifyReply) {
  const auth = authenticateEmployee(req);
  if (!auth) {
    return reply.code(401).send({ error: "not_authenticated" });
  }
  // Stash on request for downstream handlers
  (req as FastifyRequest & { employee: typeof auth }).employee = auth;
}

// ===== Routes =====

export async function registerEmployeeRoutes(app: FastifyInstance): Promise<void> {
  // ---------- Auth ----------

  // Step 1: employee enters email -> we email them a magic link.
  // Always returns 200 even if the email isn't recognized (anti-enumeration).
  app.post("/api/auth/request-magic-link", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string };
    const email = body.email?.trim();
    if (!email || !/.+@.+\..+/.test(email)) {
      return reply.code(400).send({ error: "invalid_email" });
    }

    const employee = findEmployeeByEmail(email);
    if (!employee) {
      // Don't leak whether the email exists; pretend we sent it.
      return { ok: true, sent: true };
    }

    const tok = createEmailToken({
      employee_id: employee.id,
      email,
      ip: (req.ip ?? "").slice(0, 64),
    });
    const verifyPath = `/api/auth/verify?token=${encodeURIComponent(tok.token)}`;
    // Absolute URL for the email (must work from anyone's inbox).
    const linkAbsolute = `${env.APP_PUBLIC_URL.replace(/\/$/, "")}${verifyPath}`;
    // Relative URL for the in-page dev fallback so it follows whatever host
    // the developer is currently using (localhost / Tailscale / cloudflared).
    const linkRelative = verifyPath;
    const tpl = magicLinkTemplate({
      employeeName: employee.name_he ?? employee.name,
      link: linkAbsolute,
      ttlMinutes: Math.round(MAGIC_LINK_TTL_MS / 60000),
    });
    const result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });

    return {
      ok: true,
      sent: result.ok,
      // expose link in dev mode (no Resend configured) so the developer can copy it
      dev_link: env.RESEND_API_KEY ? undefined : linkRelative,
    };
  });

  // Step 2: employee clicks link -> we exchange token for a session cookie.
  app.get("/api/auth/verify", async (req, reply) => {
    const q = req.query as { token?: string };
    const token = q.token?.trim();
    if (!token) return reply.code(400).send({ error: "missing_token" });

    const used = consumeEmailToken(token);
    if (!used) {
      return reply.code(400).send({ error: "invalid_or_expired" });
    }

    const session = createSession({
      employee_id: used.employee_id,
      user_agent: (req.headers["user-agent"] ?? "").slice(0, 240),
    });
    setSessionCookie(req, reply, session.token);
    // Relative redirect so the browser stays on whatever host it came from
    // (localhost / Tailscale IP / cloudflared subdomain). Cookie was set on
    // this same host, so this guarantees the next request carries it.
    return reply.redirect("/me");
  });

  // Step 3: who am I? Used by the PWA on every load.
  app.get("/api/auth/me", async (req, reply) => {
    const auth = authenticateEmployee(req);
    if (!auth) return reply.code(401).send({ error: "not_authenticated" });
    const { employee } = auth;
    // Whitelist what we expose — never leak salary etc. to the employee themselves
    return {
      id: employee.id,
      name: employee.name,
      name_he: employee.name_he,
      email: employee.email,
      phone: employee.phone,
      department: employee.department,
      position: employee.position,
      manager_name: employee.manager_name,
      address: employee.address,
      birthday_md: employee.birthday_md,
    };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const cookies = getCookies(req);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) deleteSession(token);
    clearSessionCookie(req, reply);
    return { ok: true };
  });

  // ---------- Employee data ----------

  // List MY equipment requests (history page).
  app.get("/api/employee/requests", { preHandler: requireEmployee }, async (req) => {
    const employee = (req as FastifyRequest & {
      employee: NonNullable<ReturnType<typeof authenticateEmployee>>;
    }).employee.employee;
    const rows: EquipmentRequestEnriched[] = listRequests({
      employee_id: employee.id,
      status: "all",
    });
    return rows;
  });

  // Submit a NEW equipment request (employee_id is derived from session — never trust the body).
  app.post("/api/employee/requests", { preHandler: requireEmployee }, async (req, reply) => {
    const employee = (req as FastifyRequest & {
      employee: NonNullable<ReturnType<typeof authenticateEmployee>>;
    }).employee.employee;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!body.catalog_id && !body.custom_name) {
      return reply.code(400).send({ error: "catalog_id or custom_name required" });
    }

    // Auto-assign the manager so the approval routes to the right person.
    // Falls back to NULL when the employee has no manager in the org chart
    // (e.g., the GM herself) — those requests will surface in CEO's queue.
    const manager = getManagerOf(employee);

    let request;
    try {
      request = createRequest({
        employee_id: employee.id, // <-- enforced server-side
        catalog_id: typeof body.catalog_id === "number" ? body.catalog_id : null,
        custom_name: typeof body.custom_name === "string" ? body.custom_name : null,
        quantity: typeof body.quantity === "number" ? body.quantity : 1,
        justification: typeof body.justification === "string" ? body.justification : null,
        delivery_to:
          body.delivery_to === "home" || body.delivery_to === "office"
            ? body.delivery_to
            : null,
        delivery_address:
          typeof body.delivery_address === "string" ? body.delivery_address : null,
        manager_employee_id: manager?.id ?? null,
      });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }

    // Fire-and-forget email to the manager (don't block the response on it).
    if (manager?.email) {
      const itemName =
        typeof body.catalog_id === "number" && request.catalog_id
          ? // best-effort lookup; falls back to custom_name if missing
            (await import("../db/equipment.js"))
              .getCatalogItem(request.catalog_id)?.name ?? request.custom_name ?? "פריט"
          : request.custom_name ?? "פריט";

      // Issue one-shot tokens so the manager can approve / reject directly
      // from the email without ever logging in.
      const tokens = createApprovalTokens({
        request_id: request.id,
        manager_employee_id: manager.id,
      });
      const base = env.APP_PUBLIC_URL.replace(/\/$/, "");
      const tpl = managerApprovalTemplate({
        managerName: manager.name_he ?? manager.name,
        employeeName: employee.name_he ?? employee.name,
        itemName,
        quantity: request.quantity,
        justification: request.justification,
        deliveryTo: request.delivery_to,
        deliveryAddress: request.delivery_address,
        approveLink: `${base}/api/approval/act?token=${encodeURIComponent(tokens.approve)}`,
        rejectLink: `${base}/api/approval/act?token=${encodeURIComponent(tokens.reject)}`,
        portalLink: `${base}/me/approvals`,
      });
      sendEmail({ to: manager.email, subject: tpl.subject, html: tpl.html, text: tpl.text }).catch(
        (err) => console.error("[employee] manager email failed:", err),
      );
    } else if (manager) {
      console.warn(
        `[employee] request #${request.id}: manager ${manager.name} has no email — no notification sent`,
      );
    } else {
      console.warn(
        `[employee] request #${request.id}: no manager resolved for ${employee.name} — request goes to CEO queue`,
      );
    }

    return request;
  });

  // ===== Manager approvals =====

  // List requests waiting for the current user (acting as a manager).
  app.get(
    "/api/employee/pending-approvals",
    { preHandler: requireEmployee },
    async (req) => {
      const employee = (req as FastifyRequest & {
        employee: NonNullable<ReturnType<typeof authenticateEmployee>>;
      }).employee.employee;
      return listPendingForManager(employee.id);
    },
  );

  // Approve as the assigned manager.
  app.post(
    "/api/employee/requests/:id/manager-approve",
    { preHandler: requireEmployee },
    async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const employee = (req as FastifyRequest & {
        employee: NonNullable<ReturnType<typeof authenticateEmployee>>;
      }).employee.employee;
      const r = getRequest(id);
      if (!r) return reply.code(404).send({ error: "not_found" });
      if (r.manager_employee_id !== employee.id) {
        return reply.code(403).send({ error: "not_your_request" });
      }
      const updated = managerApprove(id, employee.name_he ?? employee.name);
      if (!updated) return reply.code(409).send({ error: "wrong_status" });
      return updated;
    },
  );

  // Reject as the assigned manager.
  app.post(
    "/api/employee/requests/:id/manager-reject",
    { preHandler: requireEmployee },
    async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      const employee = (req as FastifyRequest & {
        employee: NonNullable<ReturnType<typeof authenticateEmployee>>;
      }).employee.employee;
      const body = (req.body ?? {}) as { reason?: string };
      if (!body.reason?.trim()) {
        return reply.code(400).send({ error: "reason_required" });
      }
      const r = getRequest(id);
      if (!r) return reply.code(404).send({ error: "not_found" });
      if (r.manager_employee_id !== employee.id) {
        return reply.code(403).send({ error: "not_your_request" });
      }
      const updated = rejectRequest(id, employee.name_he ?? employee.name, body.reason.trim());
      if (!updated) return reply.code(409).send({ error: "wrong_status" });
      return updated;
    },
  );

  // Quick fact: am I a manager? (used to show/hide the Approvals tab).
  app.get(
    "/api/employee/is-manager",
    { preHandler: requireEmployee },
    async (req) => {
      const employee = (req as FastifyRequest & {
        employee: NonNullable<ReturnType<typeof authenticateEmployee>>;
      }).employee.employee;
      const reports = listDirectReports(employee);
      const pending = listPendingForManager(employee.id);
      return {
        is_manager: reports.length > 0,
        reports_count: reports.length,
        pending_count: pending.length,
      };
    },
  );

  // Catalog (read-only for employees — they pick from active items).
  app.get("/api/employee/catalog", { preHandler: requireEmployee }, async () => {
    const { listCatalog } = await import("../db/equipment.js");
    return listCatalog(false); // active only
  });

  // ===== One-click email approval (no login required) =====
  //
  // The manager gets an email with two action-specific URLs. Each URL embeds
  // a single-use token that already encodes the request_id, the action and
  // the authorized manager — so we don't need a session here.
  //
  //   GET  /api/approval/act?token=<approve>   -> consume + approve + show OK page
  //   GET  /api/approval/act?token=<reject>    -> render small reject form (no consume)
  //   POST /api/approval/reject                -> consume + reject + show OK page
  //
  // These routes return inline HTML pages, since they're opened from the inbox
  // in a fresh browser tab.

  app.get("/api/approval/act", async (req, reply) => {
    const q = req.query as { token?: string };
    const token = q.token?.trim() ?? "";
    const row = findApprovalToken(token);
    if (!row) {
      return reply.code(400).type("text/html").send(approvalErrorPage("הקישור לא תקף או פג תוקפו."));
    }
    if (row.used_at) {
      return reply
        .code(409)
        .type("text/html")
        .send(approvalErrorPage("כבר השתמשת בקישור הזה."));
    }
    const reqRow = getRequest(row.request_id);
    if (!reqRow) {
      return reply.code(404).type("text/html").send(approvalErrorPage("הבקשה לא נמצאה."));
    }
    if (reqRow.status !== "pending") {
      return reply
        .code(409)
        .type("text/html")
        .send(approvalErrorPage(`הבקשה כבר במצב "${statusLabel(reqRow.status)}" — לא ניתן לפעול עליה.`));
    }
    const manager = getEmployeeById(row.manager_employee_id);
    const itemName = reqRow.catalog_name ?? reqRow.custom_name ?? "פריט";
    const employeeName = reqRow.employee_name ?? "עובד/ת";

    if (row.action === "approve") {
      // Single click → instant approval.
      consumeApprovalToken({
        token,
        ip: (req.ip ?? "").slice(0, 64),
      });
      managerApprove(reqRow.id, manager?.name_he ?? manager?.name ?? "manager-via-email");
      return reply.type("text/html").send(
        approvalSuccessPage({
          title: "✓ הבקשה אושרה",
          subtitle: `העברנו אותה לאישור הבא בתהליך.`,
          itemName,
          employeeName,
          quantity: reqRow.quantity,
          accent: "#5cd6a8",
        }),
      );
    }

    // action === "reject" → show a small page asking for the reason.
    return reply.type("text/html").send(
      approvalRejectFormPage({
        token,
        itemName,
        employeeName,
        quantity: reqRow.quantity,
        justification: reqRow.justification,
      }),
    );
  });

  app.post("/api/approval/reject", async (req, reply) => {
    // Accept either form-encoded (from our own HTML form) or JSON.
    const body = (req.body ?? {}) as { token?: string; reason?: string };
    const token = body.token?.trim() ?? "";
    const reason = body.reason?.trim() ?? "";
    if (!token) {
      return reply.code(400).type("text/html").send(approvalErrorPage("חסר טוקן."));
    }
    if (!reason) {
      return reply.code(400).type("text/html").send(approvalErrorPage("חובה לציין סיבת דחייה."));
    }
    const row = findApprovalToken(token);
    if (!row || row.action !== "reject") {
      return reply.code(400).type("text/html").send(approvalErrorPage("הקישור לא תקף."));
    }
    if (row.used_at) {
      return reply.code(409).type("text/html").send(approvalErrorPage("כבר השתמשת בקישור הזה."));
    }
    const reqRow = getRequest(row.request_id);
    if (!reqRow) {
      return reply.code(404).type("text/html").send(approvalErrorPage("הבקשה לא נמצאה."));
    }
    if (reqRow.status !== "pending") {
      return reply
        .code(409)
        .type("text/html")
        .send(approvalErrorPage(`הבקשה כבר במצב "${statusLabel(reqRow.status)}".`));
    }
    consumeApprovalToken({
      token,
      ip: (req.ip ?? "").slice(0, 64),
      reason,
    });
    const manager = getEmployeeById(row.manager_employee_id);
    rejectRequest(reqRow.id, manager?.name_he ?? manager?.name ?? "manager-via-email", reason);
    const itemName = reqRow.catalog_name ?? reqRow.custom_name ?? "פריט";
    const employeeName = reqRow.employee_name ?? "עובד/ת";
    return reply.type("text/html").send(
      approvalSuccessPage({
        title: "✕ הבקשה נדחתה",
        subtitle: `הסיבה תועברה לעובד/ת ולמערכת.`,
        itemName,
        employeeName,
        quantity: reqRow.quantity,
        accent: "#ff7c5c",
        extra: `<div style="margin-top:14px;padding:12px;background:#0b0d12;border:1px solid #1b212d;border-radius:10px;font-size:13px;color:#a3aab8;text-align:right;"><span style="color:#ff7c5c;">סיבה:</span> ${escapeHtmlInline(reason)}</div>`,
      }),
    );
  });
}

// ===== HTML page helpers (rendered server-side for /api/approval/*) =====

function escapeHtmlInline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "ממתין למנהל";
    case "manager_approved":
      return "אושר ע״י מנהל";
    case "exec_approved":
      return "אושר סופית";
    case "rejected":
      return "נדחה";
    case "ordered":
      return "הוזמן";
    case "received":
      return "התקבל";
    default:
      return s;
  }
}

function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtmlInline(title)}</title><style>
  body{margin:0;font-family:'Assistant','Heebo',-apple-system,BlinkMacSystemFont,sans-serif;background:#0b0d12;color:#e6e8ee;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;direction:rtl;}
  .card{max-width:480px;width:100%;background:#141821;border:1px solid #1b212d;border-radius:16px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,.4);}
  h1{margin:0 0 8px;font-size:24px;font-weight:700;}
  .sub{margin:0 0 20px;color:#a3aab8;font-size:14px;}
  .meta{background:#0b0d12;border:1px solid #1b212d;border-radius:10px;padding:14px;margin:14px 0;font-size:14px;line-height:1.7;}
  .meta strong{color:#e6e8ee;}
  .meta .dim{color:#a3aab8;}
  textarea{width:100%;box-sizing:border-box;background:#0b0d12;color:#e6e8ee;border:1px solid #1b212d;border-radius:10px;padding:12px;font-family:inherit;font-size:14px;min-height:90px;resize:vertical;direction:rtl;}
  textarea:focus{outline:none;border-color:#7c5cff;}
  button{display:block;width:100%;margin-top:14px;padding:14px;border-radius:10px;border:0;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;}
  .btn-reject{background:#ff7c5c;color:#0b0d12;}
  .btn-reject:hover{filter:brightness(1.05);}
  .footer{margin-top:18px;text-align:center;color:#5a6172;font-size:11px;}
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:18px;}
  .brand-mark{width:36px;height:36px;border-radius:8px;background:#7c5cff;color:white;font-weight:700;font-size:18px;line-height:36px;text-align:center;}
  .brand-name{font-size:14px;color:#a3aab8;}
</style></head><body><div class="card"><div class="brand"><div class="brand-mark">ש</div><div class="brand-name">Shefi &amp; Co. · אישור בקשות</div></div>${body}<div class="footer">הקישור חד-פעמי ויפוג בעוד 30 יום.</div></div></body></html>`;
}

function approvalErrorPage(msg: string): string {
  return htmlShell(
    "שגיאה",
    `<h1 style="color:#ff7c5c;">לא ניתן להשלים את הפעולה</h1><p class="sub">${escapeHtmlInline(msg)}</p>`,
  );
}

function approvalSuccessPage(input: {
  title: string;
  subtitle: string;
  itemName: string;
  employeeName: string;
  quantity: number;
  accent: string;
  extra?: string;
}): string {
  return htmlShell(
    input.title,
    `<h1 style="color:${input.accent};">${escapeHtmlInline(input.title)}</h1>
     <p class="sub">${escapeHtmlInline(input.subtitle)}</p>
     <div class="meta">
       <div><span class="dim">פריט:</span> <strong>${escapeHtmlInline(input.itemName)}</strong></div>
       <div><span class="dim">עובד/ת:</span> ${escapeHtmlInline(input.employeeName)}</div>
       <div><span class="dim">כמות:</span> ${input.quantity}</div>
     </div>
     ${input.extra ?? ""}`,
  );
}

function approvalRejectFormPage(input: {
  token: string;
  itemName: string;
  employeeName: string;
  quantity: number;
  justification: string | null;
}): string {
  const justBlock = input.justification
    ? `<div class="meta"><span class="dim">נימוק העובד/ת:</span><br/>${escapeHtmlInline(input.justification)}</div>`
    : "";
  return htmlShell(
    "דחיית בקשה",
    `<h1 style="color:#ff7c5c;">דחיית בקשה</h1>
     <p class="sub">סיבת הדחייה תיראה לעובד/ת ותתועד במערכת.</p>
     <div class="meta">
       <div><span class="dim">פריט:</span> <strong>${escapeHtmlInline(input.itemName)}</strong></div>
       <div><span class="dim">עובד/ת:</span> ${escapeHtmlInline(input.employeeName)}</div>
       <div><span class="dim">כמות:</span> ${input.quantity}</div>
     </div>
     ${justBlock}
     <form method="POST" action="/api/approval/reject">
       <input type="hidden" name="token" value="${escapeHtmlInline(input.token)}"/>
       <textarea name="reason" placeholder="לדוגמה: כבר רכשנו פריט דומה לעובד/ת בחודש שעבר" required minlength="3" maxlength="500"></textarea>
       <button type="submit" class="btn-reject">שליחת דחייה</button>
     </form>`,
  );
}
