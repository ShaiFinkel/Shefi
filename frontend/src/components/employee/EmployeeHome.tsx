import { useEffect, useState } from "react";
import { employeeApi, type EmployeeMe } from "../../employee-api";
import type { EquipmentRequest } from "../../types";

interface ManagerStatus {
  is_manager: boolean;
  reports_count: number;
  pending_count: number;
}

interface Props {
  me: EmployeeMe;
  mgr: ManagerStatus | null;
  onNav: (path: string) => void;
}

export function EmployeeHome({ me, mgr, onNav }: Props) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [recent, setRecent] = useState<EquipmentRequest[]>([]);

  useEffect(() => {
    employeeApi
      .myRequests()
      .then((rows) => {
        const open = rows.filter((r) => r.status !== "rejected" && r.status !== "received");
        setPendingCount(open.length);
        setRecent(rows.slice(0, 3));
      })
      .catch(() => null);
  }, []);

  const greeting = makeGreeting();
  const firstName = (me.name_he ?? me.name).split(" ")[0];

  return (
    <div className="space-y-6">
      <section className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-ink2 mt-1">
          {pendingCount === null
            ? "טוען…"
            : pendingCount === 0
              ? "אין בקשות פתוחות כרגע"
              : `${pendingCount} ${pendingCount === 1 ? "בקשה פתוחה" : "בקשות פתוחות"}`}
        </p>
      </section>

      <div className="grid gap-3">
        {mgr && mgr.pending_count > 0 && (
          <BigButton
            icon="🔔"
            title={`${mgr.pending_count} ${mgr.pending_count === 1 ? "בקשה ממתינה" : "בקשות ממתינות"} לאישורך`}
            subtitle="עובדים בצוות שלך מחכים לתשובה"
            onClick={() => onNav("/me/approvals")}
            color="dev"
          />
        )}
        <BigButton
          icon="➕"
          title="בקשת ציוד חדשה"
          subtitle="לפטופ · מסך · כיסא · אביזרים · ועוד"
          onClick={() => onNav("/me/new-request")}
          color="accent"
        />
        <BigButton
          icon="📋"
          title="ההיסטוריה שלי"
          subtitle="כל הבקשות שלך והסטטוס שלהן"
          onClick={() => onNav("/me/history")}
          color="knowledge"
        />
      </div>

      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-ink2 mb-2 px-1">בקשות אחרונות</h2>
          <div className="bg-panel border border-panel2 rounded-xl divide-y divide-panel2">
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => onNav("/me/history")}
                className="w-full text-right px-4 py-3 hover:bg-panel2/50 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.display_name}</div>
                  <div className="text-[11px] text-ink2 mt-0.5">
                    {r.created_at?.slice(0, 10)} · כמות {r.quantity}
                  </div>
                </div>
                <StatusPill status={r.status} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="text-center text-[11px] text-ink2 mt-6 px-4 leading-relaxed">
        💡 טיפ: להוסיף את האפליקציה למסך הבית — נגישה תמיד בקליק.
      </section>
    </div>
  );
}

function BigButton({
  icon,
  title,
  subtitle,
  onClick,
  color,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  color: "accent" | "knowledge" | "dev";
}) {
  const ringClass =
    color === "accent"
      ? "border-accent/40 hover:border-accent"
      : color === "knowledge"
        ? "border-knowledge/40 hover:border-knowledge"
        : "border-dev/40 hover:border-dev";
  const glowClass =
    color === "accent" ? "from-accent/20" : color === "knowledge" ? "from-knowledge/20" : "from-dev/20";
  return (
    <button
      onClick={onClick}
      className={`relative w-full bg-panel border ${ringClass} rounded-2xl p-5 text-right group transition-all overflow-hidden`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${glowClass} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative flex items-center justify-between gap-4">
        <div className="text-3xl">{icon}</div>
        <div className="flex-1 min-w-0 text-right">
          <div className="text-base font-semibold">{title}</div>
          <div className="text-xs text-ink2 mt-0.5">{subtitle}</div>
        </div>
        <div className="text-ink2 text-2xl">‹</div>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "ממתין", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
    manager_approved: { label: "באישור CEO", cls: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
    exec_approved: { label: "מאושר", cls: "bg-knowledge/20 text-knowledge border-knowledge/40" },
    ordered: { label: "הוזמן", cls: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
    received: { label: "נמסר", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    rejected: { label: "נדחה", cls: "bg-dev/20 text-dev border-dev/40" },
  };
  const m = map[status] ?? { label: status, cls: "bg-panel2 text-ink2" };
  return (
    <span className={`text-[10px] border rounded-full px-2 py-0.5 whitespace-nowrap ${m.cls}`}>
      {m.label}
    </span>
  );
}

function makeGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}
