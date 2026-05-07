import { Runner, user } from "@openai/agents";
import type { Agent } from "@openai/agents";
import { eventBus } from "../server/events.js";
import { shefi } from "./shefi.js";

const ENTRY_AGENTS: Record<string, Agent<any, any>> = {
  Shefi: shefi,
};

let noamLazy: Agent<any, any> | null = null;
async function getNoam(): Promise<Agent<any, any>> {
  if (!noamLazy) {
    const { noam } = await import("./dev/noam.js");
    noamLazy = noam;
  }
  return noamLazy;
}

function createInstrumentedRunner(): Runner {
  const runner = new Runner();

  runner.on("agent_start", (_ctx, agent) => {
    eventBus.emitEvent({
      agent: agent.name,
      kind: "system",
      content: `מתחילה לעבוד`,
    });
  });

  runner.on("agent_handoff", (_ctx, fromAgent, toAgent) => {
    eventBus.emitEvent({
      agent: fromAgent.name,
      kind: "handoff",
      content: `מעבירה ל־${toAgent.name}`,
      target_agent: toAgent.name,
    });
  });

  runner.on("agent_tool_start", (_ctx, agent, tool, details) => {
    const call = details.toolCall as { arguments?: string };
    let args = "";
    try {
      const raw = call.arguments ?? "{}";
      args = JSON.stringify(JSON.parse(raw));
    } catch {
      args = call.arguments ?? "";
    }
    eventBus.emitEvent({
      agent: agent.name,
      kind: "tool_call",
      content: `${tool.name}(${args})`,
      meta: { tool: tool.name, args },
    });
  });

  runner.on("agent_tool_end", (_ctx, agent, tool, result) => {
    const trimmed = String(result).slice(0, 500);
    eventBus.emitEvent({
      agent: agent.name,
      kind: "tool_result",
      content: `${tool.name} → ${trimmed}`,
      meta: { tool: tool.name },
    });
  });

  runner.on("agent_end", (_ctx, agent, output) => {
    if (output && output.trim()) {
      eventBus.emitEvent({
        agent: agent.name,
        kind: "message",
        content: output,
      });
    }
  });

  return runner;
}

const runner = createInstrumentedRunner();

export async function runFromCEO(
  message: string,
  target: "Shefi" | "Noam" = "Shefi",
): Promise<string> {
  const entryAgent =
    target === "Noam" ? await getNoam() : ENTRY_AGENTS[target] ?? shefi;
  const result = await runner.run(entryAgent, [user(message)]);
  return result.finalOutput?.trim() || "";
}
