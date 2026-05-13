// Optional admin guard for the CEO dashboard.
//
// Behavior:
//   - If env.ADMIN_TOKEN is empty -> guard is OFF (full open access on the LAN).
//     This keeps the dev experience zero-friction.
//   - If env.ADMIN_TOKEN is set    -> every request to a guarded route must
//     present the matching token in either:
//       a) X-Admin-Token: <token>      (preferred — set by the dashboard SPA)
//       b) ?admin_token=<token>        (fallback — useful for one-off curl)
//
// Apply to selected routes via `{ preHandler: requireAdmin }` (you can also
// register it as a global hook scoped to certain prefixes).

import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../lib/env.js";

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!env.ADMIN_TOKEN) return; // guard disabled
  const headerToken = (req.headers["x-admin-token"] as string | undefined) ?? "";
  const queryToken = (req.query as { admin_token?: string } | undefined)?.admin_token ?? "";
  const provided = headerToken || queryToken;
  if (provided !== env.ADMIN_TOKEN) {
    return reply.code(401).send({ error: "admin_token_required" });
  }
}

// Public helper so the frontend can show "Sign in as admin" when needed.
export function isAdminEnabled(): boolean {
  return !!env.ADMIN_TOKEN;
}
