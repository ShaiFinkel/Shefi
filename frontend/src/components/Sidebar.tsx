import type { AgentEvent, AgentInfo } from "../types";
import { divisionColor, divisionLabel } from "../utils";

interface Props {
  agents: AgentInfo[];
  events: AgentEvent[];
  filterAgent: string | null;
  setFilterAgent: (a: string | null) => void;
  filterDivision: string | null;
  setFilterDivision: (d: string | null) => void;
  showProposals: boolean;
  setShowProposals: (v: boolean) => void;
  pendingCount: number;
  wsState: "connecting" | "open" | "closed";
}

export function Sidebar({
  agents,
  events,
  filterAgent,
  setFilterAgent,
  filterDivision,
  setFilterDivision,
  showProposals,
  setShowProposals,
  pendingCount,
  wsState,
}: Props) {
  const lastByAgent = new Map<string, number>();
  for (const e of events) {
    const t = new Date(e.ts + "Z").getTime();
    if (!lastByAgent.has(e.agent) || lastByAgent.get(e.agent)! < t) {
      lastByAgent.set(e.agent, t);
    }
  }

  function isActive(key: string): boolean {
    const last = lastByAgent.get(key);
    return !!last && Date.now() - last < 60_000;
  }

  const divisions: Array<"ops" | "dev" | "knowledge"> = [
    "ops",
    "dev",
    "knowledge",
  ];

  return (
    <aside className="w-72 bg-panel border-l border-panel2 flex flex-col">
      <div className="px-5 py-4 border-b border-panel2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <div>
            <div className="font-semibold text-base">Shefi & Co.</div>
            <div className="text-[11px] text-ink2 flex items-center gap-1.5">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  wsState === "open"
                    ? "bg-knowledge"
                    : wsState === "connecting"
                      ? "bg-ceo"
                      : "bg-dev"
                }`}
              />
              {wsState === "open"
                ? "מחובר בזמן אמת"
                : wsState === "connecting"
                  ? "מתחבר…"
                  : "מנותק"}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2">
        <button
          onClick={() => {
            setFilterAgent(null);
            setFilterDivision(null);
          }}
          className={`w-full text-right px-3 py-2 rounded-md text-sm hover:bg-panel2 transition ${
            !filterAgent && !filterDivision ? "bg-panel2" : ""
          }`}
        >
          הכל
        </button>
        <button
          onClick={() => setShowProposals(!showProposals)}
          className="w-full text-right px-3 py-2 rounded-md text-sm hover:bg-panel2 transition flex items-center justify-between"
        >
          <span>ממתינים לאישור</span>
          {pendingCount > 0 && (
            <span className="bg-accent text-white text-[10px] rounded-full px-2 py-0.5">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {divisions.map((div) => (
          <div key={div} className="mt-3">
            <button
              onClick={() => {
                setFilterDivision(filterDivision === div ? null : div);
                setFilterAgent(null);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-[11px] uppercase tracking-wide font-semibold text-ink2 hover:text-ink ${
                filterDivision === div ? "text-ink" : ""
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full`}
                style={{ background: divisionColor(div) }}
              />
              {divisionLabel(div)}
            </button>
            <div className="space-y-0.5">
              {agents
                .filter((a) => a.division === div)
                .map((a) => (
                  <button
                    key={a.key}
                    onClick={() =>
                      setFilterAgent(filterAgent === a.key ? null : a.key)
                    }
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm hover:bg-panel2 transition ${
                      filterAgent === a.key ? "bg-panel2" : ""
                    }`}
                  >
                    <div className="text-right">
                      <div>{a.display}</div>
                      <div className="text-[10px] text-ink2">{a.role}</div>
                    </div>
                    {isActive(a.key) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-knowledge" />
                    )}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
