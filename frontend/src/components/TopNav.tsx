import type { View } from "./HomePage";

interface Tab {
  id: View;
  label: string;
  emoji: string;
}

const TABS: Tab[] = [
  { id: "home", label: "בית", emoji: "🏠" },
  { id: "birthdays", label: "ימי הולדת", emoji: "🎂" },
  { id: "people", label: "עובדים", emoji: "👥" },
  { id: "timeline", label: "שיחות הצוות", emoji: "💬" },
  { id: "proposals", label: "פיתוח", emoji: "🛠" },
];

interface Props {
  view: View;
  onChange: (v: View) => void;
  pendingProposals: number;
  wsState: "connecting" | "open" | "closed";
}

export function TopNav({ view, onChange, pendingProposals, wsState }: Props) {
  return (
    <header className="border-b border-panel2 bg-panel/40 px-6 py-2 flex items-center gap-4">
      <div className="flex items-center gap-2 ml-2">
        <span className="text-xl">🏢</span>
        <span className="font-semibold">Shefi & Co.</span>
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
            wsState === "open"
              ? "bg-knowledge"
              : wsState === "connecting"
                ? "bg-ceo"
                : "bg-dev"
          }`}
          title={
            wsState === "open"
              ? "מחובר בזמן אמת"
              : wsState === "connecting"
                ? "מתחבר…"
                : "מנותק"
          }
        />
      </div>
      <nav className="flex items-center gap-1 flex-1">
        {TABS.map((t) => {
          const active = view === t.id;
          const showBadge = t.id === "proposals" && pendingProposals > 0;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative px-4 py-2 rounded-md text-sm transition flex items-center gap-2 ${
                active
                  ? "bg-panel2 text-ink"
                  : "text-ink2 hover:text-ink hover:bg-panel2/50"
              }`}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
              {showBadge && (
                <span className="bg-accent text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {pendingProposals}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
