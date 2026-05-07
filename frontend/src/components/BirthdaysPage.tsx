import { useEffect, useState } from "react";
import { api } from "../api";
import type { BirthdayMonthData, Channel } from "../types";

function todayMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(ym: string): string {
  const names = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];
  return names[Number(ym.slice(5, 7)) - 1] ?? ym;
}

const channelLabel: Record<Channel, string> = {
  buyme: "BuyMe (IL)",
  amazon_au: "Amazon AU",
  amazon_us: "Amazon US",
  amazon_ca: "Amazon CA",
  manual: "ידני",
};

export function BirthdaysPage() {
  const [month, setMonth] = useState(todayMonth());
  const [data, setData] = useState<BirthdayMonthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    birthday_md?: string;
    amount_ils?: number;
    channel?: Channel;
    email?: string;
  }>({});

  async function load(ym: string) {
    setLoading(true);
    try {
      const d = await api.birthdaysMonth(ym);
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(month);
  }, [month]);

  async function action(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    try {
      await fn();
      await load(month);
    } catch (e) {
      console.error(e);
      alert("שגיאה: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function startEdit(empId: number) {
    const e = data?.employees.find((x) => x.id === empId);
    if (!e) return;
    setEditingId(empId);
    setEditForm({
      birthday_md: e.birthday_md ?? "",
      amount_ils: e.amount_ils,
      channel: e.channel,
      email: e.email ?? "",
    });
  }

  async function saveEdit() {
    if (editingId === null) return;
    setBusy("save");
    try {
      await api.updateEmployee(editingId, editForm);
      setEditingId(null);
      setEditForm({});
      await load(month);
    } catch (e) {
      alert("שגיאה: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink2">
        טוען…
      </div>
    );
  }

  const israeli = data.employees.filter((e) => e.channel === "buyme");
  const abroad = data.employees.filter((e) => e.channel !== "buyme");
  const orderByEmpId = new Map(data.orders.map((o) => [o.employee_id, o]));
  const totalIls = israeli.reduce((s, e) => s + e.amount_ils, 0);
  const pendingCount = data.orders.filter((o) => o.status === "pending").length;
  const approvedCount = data.orders.filter((o) => o.status === "approved").length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="px-3 py-1.5 bg-panel border border-panel2 rounded-md hover:bg-panel2"
            >
              ‹ קודם
            </button>
            <div>
              <h1 className="text-2xl font-bold">
                🎂 ימי הולדת — {monthName(month)} {month.slice(0, 4)}
              </h1>
              <div className="text-xs text-ink2 mt-0.5">
                {data.employees.length} עובדים · {pendingCount} ממתינות · {approvedCount} מאושרות
              </div>
            </div>
            <button
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="px-3 py-1.5 bg-panel border border-panel2 rounded-md hover:bg-panel2"
            >
              הבא ›
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-panel border border-panel2 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="bg-panel border border-panel2 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={!!busy || data.employees.length === 0}
              onClick={() => action("create", () => api.createOrders(month))}
              className="bg-panel2 hover:bg-panel2/70 text-sm rounded-md px-4 py-2 disabled:opacity-40"
            >
              {busy === "create" ? "…" : "➕ צרי הזמנות (pending)"}
            </button>
            <button
              disabled={!!busy || pendingCount === 0}
              onClick={() => action("approve", () => api.approveOrders(month))}
              className="bg-knowledge/80 hover:bg-knowledge text-bg font-semibold text-sm rounded-md px-4 py-2 disabled:opacity-40"
            >
              {busy === "approve" ? "…" : `✅ אשרי הכל (${pendingCount})`}
            </button>
            <a
              href={api.csvUrl(month)}
              className="bg-accent hover:bg-accent/80 text-white font-semibold text-sm rounded-md px-4 py-2"
              download
            >
              📥 הורדי CSV ל־BuyMe
            </a>
            <button
              disabled={!!busy || approvedCount === 0}
              onClick={() => action("sent", () => api.markSent(month))}
              className="bg-panel2 hover:bg-panel2/70 text-sm rounded-md px-4 py-2 disabled:opacity-40"
            >
              {busy === "sent" ? "…" : `✓ סמני כנשלחו (${approvedCount})`}
            </button>
            <button
              disabled={!!busy || pendingCount === 0}
              onClick={() => action("skip", () => api.skipOrders(month))}
              className="bg-panel2 hover:bg-panel2/70 text-sm rounded-md px-4 py-2 disabled:opacity-40"
            >
              ✗ בטלי
            </button>
            {loading && <span className="text-xs text-ink2">טוען…</span>}
          </div>
        </div>

        {/* Israeli BuyMe section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              📦 BuyMe — ישראל
              <span className="text-xs text-ink2 font-normal">
                ({israeli.length} עובדים · ₪{totalIls.toLocaleString()})
              </span>
            </h2>
          </div>
          {israeli.length === 0 ? (
            <p className="text-sm text-ink2 bg-panel border border-panel2 rounded-xl p-6 text-center">
              אין ימי הולדת בישראל החודש.
            </p>
          ) : (
            <div className="bg-panel border border-panel2 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-panel2/50 text-xs text-ink2 uppercase">
                  <tr>
                    <th className="text-right px-4 py-2">תאריך</th>
                    <th className="text-right px-4 py-2">שם</th>
                    <th className="text-right px-4 py-2">אימייל</th>
                    <th className="text-right px-4 py-2">סכום</th>
                    <th className="text-right px-4 py-2">סטטוס</th>
                    <th className="text-right px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {israeli.map((e) => {
                    const o = orderByEmpId.get(e.id);
                    const isEditing = editingId === e.id;
                    return (
                      <tr key={e.id} className="border-t border-panel2 hover:bg-panel2/30">
                        <td className="px-4 py-3">{e.birthday_md?.slice(3) ?? "?"}</td>
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-ink2 text-xs">
                          {isEditing ? (
                            <input
                              value={editForm.email ?? ""}
                              onChange={(ev) => setEditForm({ ...editForm, email: ev.target.value })}
                              className="bg-bg border border-panel2 rounded px-2 py-1 w-full"
                            />
                          ) : (
                            e.email ?? "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.amount_ils ?? 0}
                              onChange={(ev) => setEditForm({ ...editForm, amount_ils: Number(ev.target.value) })}
                              className="bg-bg border border-panel2 rounded px-2 py-1 w-20"
                            />
                          ) : (
                            `₪${e.amount_ils}`
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {o ? (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              o.status === "pending" ? "bg-ceo/20 text-ceo" :
                              o.status === "approved" ? "bg-accent/20 text-accent" :
                              o.status === "sent" ? "bg-knowledge/20 text-knowledge" :
                              "bg-panel2 text-ink2"
                            }`}>
                              {o.status}
                            </span>
                          ) : (
                            <span className="text-xs text-ink2">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-left">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                onClick={saveEdit}
                                disabled={busy === "save"}
                                className="text-xs bg-knowledge text-bg px-2 py-1 rounded"
                              >
                                שמרי
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditForm({}); }}
                                className="text-xs text-ink2 px-2 py-1"
                              >
                                בטלי
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(e.id)}
                              className="text-xs text-ink2 hover:text-accent"
                            >
                              ✏ ערוך
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Abroad reminder section */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            🌍 חו״ל — תזכורת ידנית
            <span className="text-xs text-ink2 font-normal">
              ({abroad.length} עובדים)
            </span>
          </h2>
          {abroad.length === 0 ? (
            <p className="text-sm text-ink2 bg-panel border border-panel2 rounded-xl p-6 text-center">
              אין ימי הולדת בחו״ל החודש.
            </p>
          ) : (
            <div className="bg-panel border border-panel2 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-panel2/50 text-xs text-ink2 uppercase">
                  <tr>
                    <th className="text-right px-4 py-2">תאריך</th>
                    <th className="text-right px-4 py-2">שם</th>
                    <th className="text-right px-4 py-2">מדינה</th>
                    <th className="text-right px-4 py-2">פלטפורמה</th>
                    <th className="text-right px-4 py-2">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {abroad.map((e) => (
                    <tr key={e.id} className="border-t border-panel2 hover:bg-panel2/30">
                      <td className="px-4 py-3">{e.birthday_md?.slice(3) ?? "?"}</td>
                      <td className="px-4 py-3 font-medium">{e.name}</td>
                      <td className="px-4 py-3 text-ink2">{e.country}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-panel2 px-2 py-0.5 rounded">
                          {channelLabel[e.channel]}
                        </span>
                      </td>
                      <td className="px-4 py-3">₪{e.amount_ils}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
