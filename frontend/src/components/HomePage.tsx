import { useEffect, useState } from "react";
import { api } from "../api";
import type { DashboardSummary } from "../types";

interface Props {
  onOpenView: (view: View) => void;
  onChatWith: (agent: string) => void;
}

export type View = "home" | "timeline" | "birthdays" | "people" | "orgchart" | "equipment" | "proposals";

interface CardProps {
  emoji: string;
  title: string;
  subtitle?: string;
  stats: { label: string; value: number | string; tone?: "default" | "warn" | "ok" }[];
  actions: { label: string; onClick: () => void; primary?: boolean }[];
  agent?: string;
  onChatWith?: (agent: string) => void;
}

function Card({ emoji, title, subtitle, stats, actions, agent, onChatWith }: CardProps) {
  return (
    <div className="bg-panel border border-panel2 rounded-xl p-5 flex flex-col gap-4 hover:border-accent/50 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <div>
            <div className="font-semibold text-base">{title}</div>
            {subtitle && (
              <div className="text-xs text-ink2 mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        {agent && onChatWith && (
          <button
            onClick={() => onChatWith(agent)}
            className="text-xs text-ink2 hover:text-accent flex items-center gap-1"
            title={`שוחחי עם ${agent}`}
          >
            💬
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="text-center bg-bg/40 rounded-lg py-2">
            <div
              className={`text-2xl font-bold ${
                s.tone === "warn"
                  ? "text-ceo"
                  : s.tone === "ok"
                    ? "text-knowledge"
                    : "text-ink"
              }`}
            >
              {s.value}
            </div>
            <div className="text-[10px] text-ink2 uppercase tracking-wide mt-1">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-auto">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            className={`text-sm rounded-md px-3 py-2 flex-1 ${
              a.primary
                ? "bg-accent hover:bg-accent/80 text-white font-medium"
                : "bg-panel2 hover:bg-panel2/70 text-ink"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function monthName(ym: string): string {
  const names = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];
  const m = Number(ym.slice(5, 7));
  return names[m - 1] ?? ym;
}

export function HomePage({ onOpenView, onChatWith }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const s = await api.summary();
      setSummary(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  if (loading || !summary) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink2">
        טוען…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">בוקר טוב 👋</h1>
            <p className="text-sm text-ink2 mt-1">
              {summary.today} · החברה שלך פעילה
            </p>
          </div>
          <button
            onClick={refresh}
            className="text-xs text-ink2 hover:text-ink"
          >
            רענני
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card
            emoji="🎂"
            title="ימי הולדת ועובדים"
            subtitle={`חודש ${monthName(summary.month)}`}
            stats={[
              {
                label: "החודש",
                value: summary.employees.birthdays_this_month,
              },
              {
                label: "ממתינות לאישור",
                value: summary.birthdays.pending_orders,
                tone: summary.birthdays.pending_orders > 0 ? "warn" : "default",
              },
              { label: "סה״כ עובדים", value: summary.employees.eligible },
            ]}
            actions={[
              {
                label: "פתח את ימי ההולדת",
                onClick: () => onOpenView("birthdays"),
                primary: true,
              },
              {
                label: "רשימת עובדים",
                onClick: () => onOpenView("people"),
              },
            ]}
            agent="Yael"
            onChatWith={onChatWith}
          />

          <Card
            emoji="✅"
            title="משימות"
            subtitle="המשימות הפתוחות שלך"
            stats={[
              { label: "פתוחות", value: summary.tasks.open },
              {
                label: "להיום",
                value: summary.tasks.due_today,
                tone: summary.tasks.due_today > 0 ? "warn" : "default",
              },
              {
                label: "באיחור",
                value: summary.tasks.overdue,
                tone: summary.tasks.overdue > 0 ? "warn" : "default",
              },
            ]}
            actions={[
              {
                label: "צפי בכל המשימות",
                onClick: () => onOpenView("timeline"),
                primary: true,
              },
              { label: "+ משימה חדשה", onClick: () => onChatWith("Tova") },
            ]}
            agent="Tova"
            onChatWith={onChatWith}
          />

          <Card
            emoji="🔔"
            title="תזכורות"
            subtitle="תזכורות מתוזמנות"
            stats={[
              { label: "ממתינות", value: summary.reminders.pending },
              { label: "דייג'סטים", value: "08, 18" },
              { label: "אזור זמן", value: "IL" },
            ]}
            actions={[
              {
                label: "+ תזכורת חדשה",
                onClick: () => onChatWith("Mira"),
                primary: true,
              },
            ]}
            agent="Mira"
            onChatWith={onChatWith}
          />

          <Card
            emoji="🏪"
            title="ספקים"
            subtitle="חוזים, חשבוניות, חידושים"
            stats={[
              { label: "פעילים", value: summary.vendors.active },
              { label: "בקרוב", value: "—" },
              { label: "פג תוקף", value: "—" },
            ]}
            actions={[
              {
                label: "+ ספק חדש",
                onClick: () => onChatWith("Shani"),
                primary: true,
              },
            ]}
            agent="Shani"
            onChatWith={onChatWith}
          />

          <Card
            emoji="🎉"
            title="אירועים וגיבושים"
            subtitle="חגים, אירועי חברה"
            stats={[
              { label: "פעילים", value: summary.events.active },
              { label: "החודש", value: "—" },
              { label: "השנה", value: "—" },
            ]}
            actions={[
              {
                label: "+ אירוע חדש",
                onClick: () => onChatWith("Yael"),
                primary: true,
              },
            ]}
            agent="Yael"
            onChatWith={onChatWith}
          />

          <Card
            emoji="✉️"
            title="תקשורת פנימית"
            subtitle="טיוטות מיילים והודעות"
            stats={[
              { label: "טיוטות", value: "—" },
              { label: "נשלחו השבוע", value: "—" },
              { label: "צוותים", value: "—" },
            ]}
            actions={[
              {
                label: "צרי טיוטה",
                onClick: () => onChatWith("Maya"),
                primary: true,
              },
            ]}
            agent="Maya"
            onChatWith={onChatWith}
          />

          <Card
            emoji="🛠"
            title="פיתוח מערכת"
            subtitle="צוות הדבלופרים פנימי"
            stats={[
              { label: "פתוחות", value: summary.dev.open_tasks },
              {
                label: "ממתינות לאישור",
                value: summary.dev.ready_proposals,
                tone: summary.dev.ready_proposals > 0 ? "warn" : "default",
              },
              { label: "סוכנים", value: 6 },
            ]}
            actions={[
              {
                label: "פתח לוח אישורים",
                onClick: () => onOpenView("proposals"),
                primary: true,
              },
              { label: "+ פיצ'ר חדש", onClick: () => onChatWith("Noam") },
            ]}
            agent="Noam"
            onChatWith={onChatWith}
          />

          <Card
            emoji="📚"
            title="זיכרון וארכיון"
            subtitle="שאלות על העבר"
            stats={[
              { label: "זיכרונות", value: summary.memories },
              { label: "—", value: "—" },
              { label: "—", value: "—" },
            ]}
            actions={[
              {
                label: "שאלי את איה",
                onClick: () => onChatWith("Aya"),
                primary: true,
              },
            ]}
            agent="Aya"
            onChatWith={onChatWith}
          />

          <Card
            emoji="🔎"
            title="מחקר ונתונים"
            subtitle="חיפוש ברשת + אנליזה"
            stats={[
              { label: "—", value: "—" },
              { label: "—", value: "—" },
              { label: "—", value: "—" },
            ]}
            actions={[
              {
                label: "חיפוש ברשת",
                onClick: () => onChatWith("Ofir"),
                primary: true,
              },
              { label: "ניתוח דאטה", onClick: () => onChatWith("Aviv") },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
