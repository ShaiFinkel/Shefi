import { useEffect, useRef } from "react";
import type { AgentEvent, AgentInfo } from "../types";
import { agentColor, agentDisplay, timeAgo } from "../utils";

interface Props {
  events: AgentEvent[];
  agents: AgentInfo[];
}

export function Timeline({ events, agents }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [events.length]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
      {events.length === 0 && (
        <div className="text-center text-ink2 py-12">
          עדיין אין שיחות. שלחי הודעה לבוט בטלגרם או דרך שורת הקלט למטה.
        </div>
      )}
      {events.map((e) => (
        <EventRow key={e.id} event={e} agents={agents} />
      ))}
    </div>
  );
}

function EventRow({ event, agents }: { event: AgentEvent; agents: AgentInfo[] }) {
  const color = agentColor(event.agent, agents);
  const isCEO = event.agent === "CEO";
  const isHandoff = event.kind === "handoff";
  const isTool = event.kind === "tool_call" || event.kind === "tool_result";
  const isSystem = event.kind === "system";

  return (
    <div className="flex gap-3 items-start group">
      <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
        style={{ background: color + "33", color }}>
        {agentDisplay(event.agent, agents).slice(0, 1)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-ink2">
          <span className="font-semibold" style={{ color }}>
            {agentDisplay(event.agent, agents)}
          </span>
          {event.target_agent && (
            <>
              <span>→</span>
              <span style={{ color: agentColor(event.target_agent, agents) }}>
                {agentDisplay(event.target_agent, agents)}
              </span>
            </>
          )}
          <span className="text-ink2/60">·</span>
          <KindBadge kind={event.kind} />
          <span className="text-ink2/60">·</span>
          <span>{timeAgo(event.ts)}</span>
        </div>
        <div
          className={`mt-0.5 text-sm whitespace-pre-wrap break-words leading-relaxed ${
            isTool || isSystem ? "code text-ink2" : isCEO ? "text-ceo" : ""
          } ${isHandoff ? "italic text-ink2" : ""}`}
        >
          {event.content}
        </div>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; color: string }> = {
    message: { label: "הודעה", color: "#a3aab8" },
    tool_call: { label: "כלי", color: "#7c5cff" },
    tool_result: { label: "תוצאה", color: "#5cd6a8" },
    handoff: { label: "העברה", color: "#ffc857" },
    system: { label: "מערכת", color: "#a3aab8" },
  };
  const m = map[kind] ?? { label: kind, color: "#a3aab8" };
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded"
      style={{ background: m.color + "22", color: m.color }}
    >
      {m.label}
    </span>
  );
}
