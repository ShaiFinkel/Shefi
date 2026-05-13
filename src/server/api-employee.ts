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
} from "../db/auth.js";
import { sendEmail, magicLinkTemplate } from "../lib/email.js";
import { env } from "../lib/env.js";
import {
  createRequest,
  listRequests,
  type EquipmentRequestEnriched,
} from "../db/equipment.js";

// ===== Helpers =====

function getCookies(req: FastifyRequest): Record<string, string | undefined> {
  const header = req.headers.cookie ?? "";
  return cookie.parse(header);
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  // SameSite=Lax + HttpOnly + Secure-when-https. Path=/ so it's sent to /api/.
  const isHttps = (env.APP_PUBLIC_URL ?? "").startsWith("https://");
  const value = cookie.serialize(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  reply.header("Set-Cookie", value);
}

function clearSessionCookie(reply: FastifyReply): void {
  const isHttps = (env.APP_PUBLIC_URL ?? "").startsWith("https://");
  const value = cookie.serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isHttps,
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
    const link = `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/me/verify?token=${encodeURIComponent(tok.token)}`;
    const tpl = magicLinkTemplate({
      employeeName: employee.name_he ?? employee.name,
      link,
      ttlMinutes: Math.round(MAGIC_LINK_TTL_MS / 60000),
    });
    const result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });

    return {
      ok: true,
      sent: result.ok,
      // expose link in dev mode (no Resend configured) so the developer can copy it
      dev_link: env.RESEND_API_KEY ? undefined : link,
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
    setSessionCookie(reply, session.token);
    // Redirect into the app
    return reply.redirect(`${env.APP_PUBLIC_URL.replace(/\/$/, "")}/me`);
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
    clearSessionCookie(reply);
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
    try {
      return createRequest({
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
      });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // Catalog (read-only for employees — they pick from active items).
  app.get("/api/employee/catalog", { preHandler: requireEmployee }, async () => {
    const { listCatalog } = await import("../db/equipment.js");
    return listCatalog(false); // active only
  });
}
