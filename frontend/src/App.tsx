import { useEffect, useMemo, useState } from "react";
import { api, connectWS } from "./api";
import type { AgentEvent, AgentInfo, Proposal } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Timeline } from "./components/Timeline";
import { ProposalsPanel } from "./components/ProposalsPanel";
import { ChatBar } from "./components/ChatBar";
import { TopNav } from "./components/TopNav";
import { HomePage, type View } from "./components/HomePage";
import { BirthdaysPage } from "./components/BirthdaysPage";
import { PeoplePage } from "./components/PeoplePage";
import { OrgChartPage } from "./components/OrgChartPage";
import { EquipmentPage } from "./components/EquipmentPage";

export function App() {
  const [view, setView] = useState<View>("home");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showProposals, setShowProposals] = useState(true);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );

  useEffect(() => {
    api.agents().then(setAgents).catch(console.error);
    api.proposals().then(setProposals).catch(console.error);
  }, []);

  useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      setWsState("connecting");
      ws = connectWS(
        (snap) => alive && setEvents(snap),
        (ev) => {
          if (!alive) return;
          setEvents((prev) => [...prev, ev]);
          if (ev.kind === "system" && ev.content.includes("ממתין לאישור")) {
            api.proposals().then(setProposals).catch(console.error);
          }
          if (
            ev.agent === "Daniel" &&
            ev.kind === "tool_result" &&
            ev.content.startsWith("create_proposal")
          ) {
            api.proposals().then(setProposals).catch(console.error);
          }
        },
      );
      ws.onopen = () => alive && setWsState("open");
      ws.onclose = () => {
        if (!alive) return;
        setWsState("closed");
        retryTimer = setTimeout(open, 2000);
      };
    };

    open();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterAgent && e.agent !== filterAgent && e.target_agent !== filterAgent)
        return false;
      if (filterDivision) {
        const a = agents.find((x) => x.key === e.agent);
        if (e.agent === "CEO" || e.agent === "system") return !filterDivision;
        if (!a || a.division !== filterDivision) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.content.toLowerCase().includes(q) &&
          !e.agent.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [events, filterAgent, filterDivision, search, agents]);

  const pendingCount = proposals.filter((p) => p.status === "ready").length;

  function chatWith(agent: string) {
    if (["Noam", "Daniel", "Kosem", "Liya", "Uri", "Rotem"].includes(agent)) {
      setFilterAgent(agent);
      setView("timeline");
      return;
    }
    setFilterAgent(agent);
    setView("timeline");
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav
        view={view}
        onChange={(v) => {
          setView(v);
          if (v === "timeline") {
            // keep filterAgent so chatWith can target a specific agent
          } else {
            setFilterAgent(null);
            setFilterDivision(null);
          }
        }}
        pendingProposals={pendingCount}
        wsState={wsState}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {view === "home" && (
          <HomePage onOpenView={setView} onChatWith={chatWith} />
        )}

        {view === "birthdays" && <BirthdaysPage />}

        {view === "people" && <PeoplePage />}

        {view === "orgchart" && <OrgChartPage />}

        {view === "equipment" && <EquipmentPage />}

        {view === "timeline" && (
          <>
            <Sidebar
              agents={agents}
              events={events}
              filterAgent={filterAgent}
              setFilterAgent={setFilterAgent}
              filterDivision={filterDivision}
              setFilterDivision={setFilterDivision}
              showProposals={showProposals}
              setShowProposals={setShowProposals}
              pendingCount={pendingCount}
              wsState={wsState}
            />
            <main className="flex-1 flex flex-col min-w-0">
              <header className="flex items-center justify-between px-6 py-3 border-b border-panel2 bg-panel/40">
                <div>
                  <h1 className="text-lg font-semibold">
                    {filterAgent
                      ? `שיחות של ${filterAgent}`
                      : filterDivision === "ops"
                        ? "חטיבת תפעול"
                        : filterDivision === "dev"
                          ? "חטיבת פיתוח"
                          : filterDivision === "knowledge"
                            ? "ידע ותובנות"
                            : "Timeline — כל הסוכנים"}
                  </h1>
                  <p className="text-xs text-ink2">
                    {filteredEvents.length} הודעות · {agents.length} סוכנים בצוות
                  </p>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש בטיימליין…"
                  className="bg-panel border border-panel2 rounded-md px-3 py-1.5 text-sm w-72 focus:outline-none focus:border-accent"
                />
              </header>
              <div className="flex-1 flex flex-col min-h-0">
                <Timeline events={filteredEvents} agents={agents} />
                <ChatBar agents={agents} />
              </div>
            </main>
          </>
        )}

        {view === "proposals" && (
          <ProposalsPanel
            proposals={proposals}
            refresh={() => api.proposals().then(setProposals)}
          />
        )}
      </div>
    </div>
  );
}
