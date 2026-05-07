import Fastify from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
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

const FRONTEND_DIST = resolve(process.cwd(), "frontend/dist");

export async function startServer(port = 3000) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  await registerDashboardRoutes(app);

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

  await app.listen({ port, host: "127.0.0.1" });
  console.log(`✓ דשבורד פעיל ב־http://localhost:${port}`);
  return app;
}
