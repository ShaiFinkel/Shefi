import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Channel, Employee } from "../types";

const channelLabel: Record<Channel, string> = {
  buyme: "BuyMe",
  amazon_au: "Amazon AU",
  amazon_us: "Amazon US",
  amazon_ca: "Amazon CA",
  manual: "ידני",
};

interface NewEmployeeForm {
  name: string;
  country: string;
  type: string;
  email: string;
  phone: string;
  birthday_md: string;
  amount_ils: number;
  channel: Channel;
  position: string;
  department: string;
  location: string;
}

const DEFAULT_NEW: NewEmployeeForm = {
  name: "",
  country: "Israel",
  type: "Employee",
  email: "",
  phone: "",
  birthday_md: "",
  amount_ils: 300,
  channel: "buyme",
  position: "",
  department: "",
  location: "Tel Aviv",
};

function fmtMoney(amount: number | null, currency: string | null): string {
  if (amount === null || amount === undefined) return "—";
  const sym = currency || "₪";
  return `${sym}${amount.toLocaleString("en-US")}`;
}

function yearsSince(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(+d)) return "—";
  const now = new Date();
  const yrs = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (yrs < 1) {
    const months = Math.floor(yrs * 12);
    return `${months} ח׳`;
  }
  return `${yrs.toFixed(1)} שנים`;
}

function GenderBadge({ g }: { g: string | null }) {
  if (!g) return null;
  const isF = g.toLowerCase().startsWith("f");
  return (
    <span
      title={g}
      className={`inline-block w-1.5 h-1.5 rounded-full ${
        isF ? "bg-pink-400" : "bg-blue-400"
      }`}
    />
  );
}

export function PeoplePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<string | "all">("all");
  const [filterLocation, setFilterLocation] = useState<string | "all">("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewEmployeeForm>(DEFAULT_NEW);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
  const [editing, setEditing] = useState(false);
  const [showSalary, setShowSalary] = useState(false);

  async function load() {
    try {
      const list = showInactive ? await api.employeesAll() : await api.employees();
      setEmployees(list);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
  }, [showInactive]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.department) set.add(e.department);
    return Array.from(set).sort();
  }, [employees]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.location) set.add(e.location);
    return Array.from(set).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (filterDept !== "all" && e.department !== filterDept) return false;
      if (filterLocation !== "all" && e.location !== filterLocation) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.name.toLowerCase().includes(q) &&
          !(e.email ?? "").toLowerCase().includes(q) &&
          !(e.position ?? "").toLowerCase().includes(q) &&
          !(e.department ?? "").toLowerCase().includes(q) &&
          !(e.manager_name ?? "").toLowerCase().includes(q) &&
          !(e.name_he ?? "").includes(search)
        )
          return false;
      }
      return true;
    });
  }, [employees, search, filterDept, filterLocation]);

  const stats = useMemo(() => {
    const byDept = new Map<string, number>();
    const byLoc = new Map<string, number>();
    for (const e of employees) {
      if (e.department) byDept.set(e.department, (byDept.get(e.department) ?? 0) + 1);
      if (e.location) byLoc.set(e.location, (byLoc.get(e.location) ?? 0) + 1);
    }
    return { depts: byDept.size, locs: byLoc.size };
  }, [employees]);

  const detail = detailId ? employees.find((e) => e.id === detailId) : null;

  function openDetail(e: Employee) {
    setDetailId(e.id);
    setEditing(false);
    setEditForm({});
  }

  function startEdit() {
    if (!detail) return;
    setEditing(true);
    setEditForm({ ...detail });
  }

  async function saveDetail() {
    if (!detail) return;
    setBusy(true);
    try {
      await api.updateEmployee(detail.id, editForm);
      setEditing(false);
      setEditForm({});
      await load();
    } catch (e) {
      alert("שגיאה: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addEmployee() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api.createEmployee(form);
      setForm(DEFAULT_NEW);
      setAdding(false);
      await load();
    } catch (e) {
      alert("שגיאה: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function depart(id: number, name: string) {
    const date = prompt(
      `תאריך עזיבה של ${name} (YYYY-MM-DD):`,
      new Date().toISOString().slice(0, 10),
    );
    if (!date) return;
    setBusy(true);
    try {
      await api.departEmployee(id, date);
      if (detailId === id) setDetailId(null);
      await load();
    } catch (e) {
      alert("שגיאה: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: number) {
    setBusy(true);
    try {
      await api.restoreEmployee(id);
      await load();
    } catch (e) {
      alert("שגיאה: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className={`flex-1 overflow-y-auto ${detail ? "border-l border-panel2" : ""}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">👥 עובדים</h1>
              <p className="text-xs text-ink2 mt-1">
                {filtered.length} מתוך {employees.length} · {stats.depts} מחלקות · {stats.locs} מיקומים
                {showInactive ? " · כולל מי שעזב/ה" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSalary((s) => !s)}
                className={`text-sm rounded-md px-3 py-2 border ${showSalary ? "bg-knowledge/20 border-knowledge text-knowledge" : "border-panel2 text-ink2 hover:text-ink"}`}
                title="הצג/הסתר עמודת שכר"
              >
                {showSalary ? "הסתר שכר" : "הצג שכר"}
              </button>
              <button
                onClick={() => setAdding(!adding)}
                className="bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-md px-4 py-2"
              >
                {adding ? "סגרי" : "+ עובד/ת חדש/ה"}
              </button>
            </div>
          </div>

          {adding && (
            <div className="bg-panel border border-accent/50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="שם מלא (אנגלית)">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="תפקיד">
                  <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="מחלקה">
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="מדינה">
                  <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="מיקום (משרד)">
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="סוג">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full">
                    <option>Employee</option>
                    <option>Employee - Hourly</option>
                    <option>Contractor</option>
                  </select>
                </Field>
                <Field label="אימייל">
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="טלפון">
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="יום הולדת (MM-DD)">
                  <input value={form.birthday_md} onChange={(e) => setForm({ ...form, birthday_md: e.target.value })} placeholder="06-15" className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="סכום מתנה (₪)">
                  <input type="number" value={form.amount_ils} onChange={(e) => setForm({ ...form, amount_ils: Number(e.target.value) })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                </Field>
                <Field label="ערוץ">
                  <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full">
                    <option value="buyme">BuyMe (IL)</option>
                    <option value="amazon_au">Amazon AU</option>
                    <option value="amazon_us">Amazon US</option>
                    <option value="amazon_ca">Amazon CA</option>
                    <option value="manual">ידני</option>
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => { setAdding(false); setForm(DEFAULT_NEW); }} className="text-sm px-4 py-2 text-ink2 hover:text-ink">ביטול</button>
                <button onClick={addEmployee} disabled={busy || !form.name.trim()} className="bg-knowledge text-bg font-semibold text-sm rounded-md px-4 py-2 disabled:opacity-40">
                  {busy ? "…" : "שמרי"}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש (שם / אימייל / תפקיד / מחלקה / מנהל)…"
              className="bg-panel border border-panel2 rounded-md px-3 py-1.5 text-sm flex-1 min-w-[240px]"
            />
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="bg-panel border border-panel2 rounded-md px-3 py-1.5 text-sm">
              <option value="all">כל המחלקות</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="bg-panel border border-panel2 rounded-md px-3 py-1.5 text-sm">
              <option value="all">כל המיקומים</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-ink2">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              הצג עזבו
            </label>
          </div>

          <div className="bg-panel border border-panel2 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel2/50 text-xs text-ink2 uppercase">
                <tr>
                  <th className="text-right px-3 py-2">שם</th>
                  <th className="text-right px-3 py-2">תפקיד</th>
                  <th className="text-right px-3 py-2">מחלקה</th>
                  <th className="text-right px-3 py-2">מנהל/ת</th>
                  <th className="text-right px-3 py-2">מיקום</th>
                  <th className="text-right px-3 py-2">יום הולדת</th>
                  <th className="text-right px-3 py-2">הצטרפות</th>
                  <th className="text-right px-3 py-2">ותק</th>
                  {showSalary && <th className="text-right px-3 py-2">שכר חודשי</th>}
                  <th className="text-right px-3 py-2">ערוץ</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const isOpen = detailId === e.id;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => openDetail(e)}
                      className={`border-t border-panel2 cursor-pointer ${
                        e.active === 0 ? "opacity-50" : ""
                      } ${isOpen ? "bg-accent/10" : "hover:bg-panel2/30"}`}
                    >
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <GenderBadge g={e.gender} />
                          <div>
                            <div>{e.name}</div>
                            {e.person_number && (
                              <div className="text-[10px] text-ink2">#{e.person_number}</div>
                            )}
                          </div>
                          {e.active === 0 && <span className="text-[10px] text-ink2 mr-2">(עזב/ה {e.departed_at})</span>}
                          {e.type === "Contractor" && <span className="text-[10px] text-ink2 mr-2">(Contractor)</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">{e.position ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {e.department ? (
                          <span className="bg-panel2 px-2 py-0.5 rounded text-[11px]">{e.department}</span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink2">{e.manager_name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-ink2">{e.location ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.birthday_md ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-ink2 whitespace-nowrap">{e.hire_date ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-ink2 whitespace-nowrap">{yearsSince(e.hire_date)}</td>
                      {showSalary && (
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          {fmtMoney(e.salary_monthly, e.currency)}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <span className="text-xs bg-panel2 px-2 py-0.5 rounded">{channelLabel[e.channel]}</span>
                      </td>
                      <td className="px-3 py-2 text-left whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                        {e.active === 1 ? (
                          <button onClick={() => depart(e.id, e.name)} className="text-xs text-ink2 hover:text-dev" title="סמן כעזב/ה">↗</button>
                        ) : (
                          <button onClick={() => restore(e.id)} className="text-xs text-ink2 hover:text-knowledge" title="החזר/י">↺</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={showSalary ? 11 : 10} className="px-3 py-8 text-center text-ink2 text-sm">
                      אין תוצאות.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detail && (
        <DetailDrawer
          employee={detail}
          editing={editing}
          editForm={editForm}
          setEditForm={setEditForm}
          startEdit={startEdit}
          saveEdit={saveDetail}
          cancelEdit={() => { setEditing(false); setEditForm({}); }}
          onClose={() => { setDetailId(null); setEditing(false); }}
          busy={busy}
        />
      )}
    </div>
  );
}

interface DrawerProps {
  employee: Employee;
  editing: boolean;
  editForm: Partial<Employee>;
  setEditForm: (f: Partial<Employee>) => void;
  startEdit: () => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  onClose: () => void;
  busy: boolean;
}

function DetailDrawer({ employee: e, editing, editForm, setEditForm, startEdit, saveEdit, cancelEdit, onClose, busy }: DrawerProps) {
  const v = editing ? editForm : e;
  const set = (patch: Partial<Employee>) => setEditForm({ ...editForm, ...patch });

  return (
    <aside className="w-[420px] bg-panel/30 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <GenderBadge g={e.gender} />
          {e.name}
        </h2>
        <button onClick={onClose} className="text-ink2 hover:text-ink text-xl leading-none">×</button>
      </div>

      <div className="text-xs text-ink2 mb-4">
        {e.position ?? "—"}{e.department ? ` · ${e.department}` : ""}
        {e.tech_title && e.tech_title !== e.position && (
          <div className="mt-1 italic">{e.tech_title}</div>
        )}
      </div>

      {!editing ? (
        <>
          <Section title="פרטים אישיים">
            <KV k="אימייל" v={e.email} />
            <KV k="טלפון" v={e.phone} />
            <KV k="כתובת" v={e.address} />
            <KV k="מין" v={e.gender} />
            <KV k="יום הולדת" v={e.birthday_full ?? e.birthday_md} />
          </Section>

          <Section title="תעסוקה">
            <KV k="מספר עובד" v={e.person_number} />
            <KV k="תאריך הצטרפות" v={e.hire_date ? `${e.hire_date} (${yearsSince(e.hire_date)})` : null} />
            <KV k="סוג" v={e.type} />
            <KV k="מנהל/ת ישיר/ה" v={e.manager_name} />
            <KV k="מיקום משרד" v={e.location} />
            <KV k="מדינה" v={e.country} />
            <KV k="דרגה" v={e.grade_level} />
            <KV k="רמה" v={e.level !== null ? `Level ${e.level}` : null} />
          </Section>

          <Section title="שכר">
            <KV k="שכר חודשי" v={fmtMoney(e.salary_monthly, e.currency)} />
            <KV k="שכר שנתי" v={fmtMoney(e.salary_yearly, e.currency)} />
            <KV k="מטבע" v={e.currency} />
          </Section>

          <Section title="מתנות יום הולדת">
            <KV k="ערוץ" v={e.channel} />
            <KV k="סכום (₪)" v={String(e.amount_ils)} />
            <KV k="הערות" v={e.notes} />
          </Section>

          <Section title="מערכת">
            <KV k="ID במערכת" v={String(e.id)} />
            <KV k="ID בעץ" v={e.org_chart_id} />
            <KV k="עודכן" v={e.updated_at} />
            {e.active === 0 && <KV k="עזב/ה בתאריך" v={e.departed_at} />}
          </Section>

          <div className="mt-6 flex gap-2">
            <button onClick={startEdit} className="flex-1 bg-accent text-white text-sm font-semibold rounded-md px-4 py-2">
              ערוך/י פרטים
            </button>
          </div>
        </>
      ) : (
        <>
          <Section title="פרטים אישיים">
            <Edit k="שם" value={v.name ?? ""} on={(x) => set({ name: x })} />
            <Edit k="אימייל" value={v.email ?? ""} on={(x) => set({ email: x })} />
            <Edit k="טלפון" value={v.phone ?? ""} on={(x) => set({ phone: x })} />
            <Edit k="כתובת" value={v.address ?? ""} on={(x) => set({ address: x })} />
            <Edit k="יום הולדת (MM-DD)" value={v.birthday_md ?? ""} on={(x) => set({ birthday_md: x })} placeholder="06-15" />
            <Edit k="יום הולדת מלא" value={v.birthday_full ?? ""} on={(x) => set({ birthday_full: x })} placeholder="1990-06-15" />
            <EditSelect k="מין" value={v.gender ?? ""} options={["", "Male", "Female"]} on={(x) => set({ gender: x || null })} />
          </Section>

          <Section title="תעסוקה">
            <Edit k="תפקיד" value={v.position ?? ""} on={(x) => set({ position: x })} />
            <Edit k="כותרת רשמית" value={v.tech_title ?? ""} on={(x) => set({ tech_title: x })} />
            <Edit k="מחלקה" value={v.department ?? ""} on={(x) => set({ department: x })} />
            <Edit k="מספר עובד" value={v.person_number ?? ""} on={(x) => set({ person_number: x })} />
            <Edit k="תאריך הצטרפות (YYYY-MM-DD)" value={v.hire_date ?? ""} on={(x) => set({ hire_date: x })} />
            <EditSelect k="סוג" value={v.type ?? "Employee"} options={["Employee", "Employee - Hourly", "Contractor"]} on={(x) => set({ type: x })} />
            <Edit k="מנהל/ת (שם)" value={v.manager_name ?? ""} on={(x) => set({ manager_name: x })} />
            <Edit k="מיקום משרד" value={v.location ?? ""} on={(x) => set({ location: x })} />
            <Edit k="מדינה" value={v.country ?? ""} on={(x) => set({ country: x })} />
            <Edit k="דרגה" value={v.grade_level ?? ""} on={(x) => set({ grade_level: x })} />
            <EditNum k="רמה (level)" value={v.level} on={(x) => set({ level: x })} />
          </Section>

          <Section title="שכר">
            <EditNum k="שכר חודשי" value={v.salary_monthly} on={(x) => set({ salary_monthly: x })} />
            <EditNum k="שכר שנתי" value={v.salary_yearly} on={(x) => set({ salary_yearly: x })} />
            <Edit k="מטבע" value={v.currency ?? ""} on={(x) => set({ currency: x })} placeholder="₪ / $" />
          </Section>

          <Section title="מתנות יום הולדת">
            <EditSelect k="ערוץ" value={v.channel ?? "buyme"} options={["buyme", "amazon_au", "amazon_us", "amazon_ca", "manual"]} on={(x) => set({ channel: x as Channel })} />
            <EditNum k="סכום (₪)" value={v.amount_ils ?? 300} on={(x) => set({ amount_ils: x ?? 300 })} />
            <Edit k="הערות" value={v.notes ?? ""} on={(x) => set({ notes: x })} />
          </Section>

          <div className="mt-6 flex gap-2">
            <button onClick={cancelEdit} className="flex-1 text-sm px-4 py-2 text-ink2 hover:text-ink border border-panel2 rounded-md">
              בטלי
            </button>
            <button onClick={saveEdit} disabled={busy} className="flex-1 bg-knowledge text-bg font-semibold text-sm rounded-md px-4 py-2 disabled:opacity-40">
              {busy ? "שומרת…" : "שמרי שינויים"}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] uppercase tracking-wide text-ink2 mb-2 border-b border-panel2 pb-1">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  if (v === null || v === undefined || v === "" || v === "—") {
    return (
      <div className="flex justify-between text-xs">
        <span className="text-ink2">{k}</span>
        <span className="text-ink2/40">—</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between text-xs gap-3">
      <span className="text-ink2 shrink-0">{k}</span>
      <span className="text-ink text-left break-words">{v}</span>
    </div>
  );
}

function Edit({ k, value, on, placeholder }: { k: string; value: string; on: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] text-ink2 mb-1">{k}</div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => on(e.target.value)}
        className="bg-bg border border-panel2 rounded px-2 py-1 w-full text-sm"
      />
    </label>
  );
}

function EditNum({ k, value, on }: { k: string; value: number | null | undefined; on: (v: number | null) => void }) {
  return (
    <label className="block">
      <div className="text-[11px] text-ink2 mb-1">{k}</div>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => on(e.target.value === "" ? null : Number(e.target.value))}
        className="bg-bg border border-panel2 rounded px-2 py-1 w-full text-sm"
      />
    </label>
  );
}

function EditSelect({ k, value, options, on }: { k: string; value: string; options: string[]; on: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-[11px] text-ink2 mb-1">{k}</div>
      <select
        value={value}
        onChange={(e) => on(e.target.value)}
        className="bg-bg border border-panel2 rounded px-2 py-1 w-full text-sm"
      >
        {options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs">
      <div className="text-ink2 mb-1">{label}</div>
      {children}
    </label>
  );
}
