import Fastify from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { eventBus } from "./events.js";
import { AGENTS } from "../agents/registry.js";
import {
  listDevTasks,
  listProposals,
  getProposal,
  recordApproval,
  setDevTaskStatus,
  setProposalStatus,
} from "../dev/proposals.js";
import { mergeProposalBranch } from "../dev/git.js";
import { runFromCEO } from "../agents/runner.js";
import { registerDashboardRoutes } from "./api-dashboard.js";
import { registerEmployeeRoutes } from "./api-employee.js";
import { cleanupExpiredAuth } from "../db/auth.js";
import { requireAdmin, isAdminEnabled } from "./admin-guard.js";

const FRONTEND_DIST = resolve(process.cwd(), "frontend/dist");

export async function startServer(port = 3000) {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: true,
    credentials: true, // needed for the session cookie on the employee PWA
  });
  await app.register(websocket);
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB cap per quote file
  });

  // Global admin guard — only active when ADMIN_TOKEN is set in .env.
  // Protects every /api/* route EXCEPT /api/auth/* and /api/employee/* (which
  // have their own session-based auth) and /api/health (status check).
  if (isAdminEnabled()) {
    app.addHook("onRequest", async (req, reply) => {
      const url = req.url.split("?")[0];
      if (!url.startsWith("/api/")) return;
      if (url === "/api/health") return;
      if (url.startsWith("/api/auth/")) return;
      if (url.startsWith("/api/employee/")) return;
      // Static-ish file under /api/equipment/quotes/ — also gated, since quotes can be sensitive
      return requireAdmin(req, reply);
    });
    console.log("✓ admin guard enabled (ADMIN_TOKEN required for management endpoints)");
  } else {
    console.log("⚠ admin guard disabled (ADMIN_TOKEN empty in .env — open access on your network)");
  }

  await registerDashboardRoutes(app);
  await registerEmployeeRoutes(app);

  // Periodic cleanup of expired magic-link tokens & sessions (best-effort).
  // 6h cadence is plenty given TTLs are 30min / 30days.
  setInterval(() => {
    try {
      const r = cleanupExpiredAuth();
      if (r.tokens || r.sessions) {
        console.log(`[auth] cleaned ${r.tokens} tokens, ${r.sessions} sessions`);
      }
    } catch (err) {
      console.error("[auth] cleanup failed:", err);
    }
  }, 6 * 60 * 60 * 1000).unref();

  // ===== REST =====
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/agents", async () => AGENTS);

  app.get("/api/events", async (req) => {
    const q = req.query as { since?: string; limit?: string };
    if (q.since !== undefined) {
      return eventBus.since(Number(q.since), Number(q.limit ?? 500));
    }
    return eventBus.recent(Number(q.limit ?? 200));
  });

  app.get("/api/dev-tasks", async () => listDevTasks());

  app.get("/api/proposals", async (req) => {
    const q = req.query as { status?: string };
    return listProposals(q.status);
  });

  app.get("/api/proposals/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const proposal = getProposal(id);
    if (!proposal) return reply.code(404).send({ error: "not found" });
    return proposal;
  });

  app.post("/api/proposals/:id/approve", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { comment?: string };
    const proposal = getProposal(id);
    if (!proposal) return reply.code(404).send({ error: "not found" });
    if (proposal.status !== "ready") {
      return reply.code(400).send({ error: `status is ${proposal.status}` });
    }
    try {
      await mergeProposalBranch(proposal.branch);
      setProposalStatus(id, "merged");
      if (proposal.dev_task_id) setDevTaskStatus(proposal.dev_task_id, "merged");
      recordApproval(id, "approve", body.comment ?? null);
      eventBus.emitEvent({
        agent: "CEO",
        kind: "system",
        content: `אושר ומוזג: proposal #${id} (${proposal.branch})`,
        target_agent: "Noam",
      });
      return { ok: true };
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/proposals/:id/reject", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { comment?: string };
    const proposal = getProposal(id);
    if (!proposal) return reply.code(404).send({ error: "not found" });
    setProposalStatus(id, "rejected");
    recordApproval(id, "reject", body.comment ?? null);
    eventBus.emitEvent({
      agent: "CEO",
      kind: "system",
      content: `נדחה: proposal #${id}. ${body.comment ?? ""}`.trim(),
      target_agent: "Noam",
    });
    return { ok: true };
  });

  app.post("/api/chat", async (req, reply) => {
    const body = req.body as { message: string; target?: "Shefi" | "Noam" };
    if (!body.message?.trim()) {
      return reply.code(400).send({ error: "message required" });
    }
    const target = body.target ?? "Shefi";
    eventBus.emitEvent({
      agent: "CEO",
      kind: "message",
      content: body.message,
      target_agent: target,
    });
    runFromCEO(body.message, target).catch((err) => {
      console.error("chat run failed:", err);
    });
    return { ok: true };
  });

  // ===== WebSocket =====
  app.register(async (instance) => {
    instance.get("/ws", { websocket: true }, (socket) => {
      const recent = eventBus.recent(200);
      socket.send(JSON.stringify({ type: "snapshot", events: recent }));

      const onEvent = (e: unknown) => {
        try {
          socket.send(JSON.stringify({ type: "event", event: e }));
        } catch {
          // ignore broken pipe
        }
      };
      eventBus.on("event", onEvent);
      socket.on("close", () => eventBus.off("event", onEvent));
    });
  });

  // ===== Static frontend =====
  if (existsSync(FRONTEND_DIST)) {
    await app.register(fastifyStatic, {
      root: FRONTEND_DIST,
      prefix: "/",
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/ws")) {
        return reply.code(404).send({ error: "not found" });
      }
      return reply.sendFile("index.html");
    });
  } else {
    app.get("/", async () =>
      `<h1>Shefi & Co. Dashboard</h1>
       <p>הפרונטאנד עוד לא נבנה. הרץ <code>npm run frontend:build</code>.</p>
       <p>API פעיל ב־<code>/api/health</code>.</p>`,
    );
  }

  // Bind to 0.0.0.0 so Tailscale + LAN devices can reach the dashboard.
  // (Tailscale traffic is wireguard-encrypted; only your tailnet sees this.)
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`✓ דשבורד פעיל ב־http://localhost:${port} ובכל הרשת על פורט ${port}`);
  return app;
}
