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

export function PeoplePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<string | "all">("all");
  const [filterLocation, setFilterLocation] = useState<string | "all">("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewEmployeeForm>(DEFAULT_NEW);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});

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

  const managerById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      if (e.org_chart_id) map.set(e.org_chart_id, e.name);
    }
    return map;
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
          !(e.name_he ?? "").includes(search)
        )
          return false;
      }
      return true;
    });
  }, [employees, search, filterDept, filterLocation]);

  // Group counts for the header
  const stats = useMemo(() => {
    const byDept = new Map<string, number>();
    const byLoc = new Map<string, number>();
    for (const e of employees) {
      if (e.department) byDept.set(e.department, (byDept.get(e.department) ?? 0) + 1);
      if (e.location) byLoc.set(e.location, (byLoc.get(e.location) ?? 0) + 1);
    }
    return {
      depts: byDept.size,
      locs: byLoc.size,
      withDept: Array.from(byDept.values()).reduce((s, n) => s + n, 0),
    };
  }, [employees]);

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

  function startEdit(e: Employee) {
    setEditId(e.id);
    setEditForm({
      name: e.name,
      country: e.country,
      type: e.type,
      email: e.email,
      phone: e.phone,
      birthday_md: e.birthday_md,
      amount_ils: e.amount_ils,
      channel: e.channel,
      position: e.position,
      department: e.department,
      location: e.location,
    });
  }

  async function saveEdit() {
    if (editId === null) return;
    setBusy(true);
    try {
      await api.updateEmployee(editId, editForm);
      setEditId(null);
      setEditForm({});
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">👥 עובדים</h1>
            <p className="text-xs text-ink2 mt-1">
              {filtered.length} מתוך {employees.length} · {stats.depts} מחלקות · {stats.locs} מיקומים{" "}
              {showInactive ? "· כולל מי שעזב/ה" : ""}
            </p>
          </div>
          <button
            onClick={() => setAdding(!adding)}
            className="bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-md px-4 py-2"
          >
            {adding ? "סגרי" : "+ עובד/ת חדש/ה"}
          </button>
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
              <Field label="סכום (₪)">
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
            placeholder="חיפוש (שם / אימייל / תפקיד / מחלקה)…"
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
                <th className="text-right px-3 py-2">אימייל</th>
                <th className="text-right px-3 py-2">סכום</th>
                <th className="text-right px-3 py-2">ערוץ</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const isEditing = editId === e.id;
                const managerName = e.manager_org_id ? managerById.get(e.manager_org_id) : null;
                return (
                  <tr key={e.id} className={`border-t border-panel2 ${e.active === 0 ? "opacity-50" : "hover:bg-panel2/30"}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {isEditing ? (
                        <input value={editForm.name ?? ""} onChange={(ev) => setEditForm({ ...editForm, name: ev.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                      ) : (
                        <>
                          {e.name}
                          {e.active === 0 && <span className="text-[10px] text-ink2 mr-2">(עזב/ה {e.departed_at})</span>}
                          {e.type === "Contractor" && <span className="text-[10px] text-ink2 mr-2">(Contractor)</span>}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {isEditing ? (
                        <input value={editForm.position ?? ""} onChange={(ev) => setEditForm({ ...editForm, position: ev.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                      ) : (e.position ?? "—")}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {isEditing ? (
                        <input value={editForm.department ?? ""} onChange={(ev) => setEditForm({ ...editForm, department: ev.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-32" />
                      ) : e.department ? (
                        <span className="bg-panel2 px-2 py-0.5 rounded text-[11px]">{e.department}</span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink2">{managerName ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-ink2">
                      {isEditing ? (
                        <input value={editForm.location ?? ""} onChange={(ev) => setEditForm({ ...editForm, location: ev.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-24" />
                      ) : (e.location ?? "—")}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <input value={editForm.birthday_md ?? ""} onChange={(ev) => setEditForm({ ...editForm, birthday_md: ev.target.value })} placeholder="MM-DD" className="bg-bg border border-panel2 rounded px-2 py-1 w-20" />
                      ) : (e.birthday_md ?? "—")}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink2">
                      {isEditing ? (
                        <input value={editForm.email ?? ""} onChange={(ev) => setEditForm({ ...editForm, email: ev.target.value })} className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
                      ) : (e.email ?? "—")}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <input type="number" value={editForm.amount_ils ?? 0} onChange={(ev) => setEditForm({ ...editForm, amount_ils: Number(ev.target.value) })} className="bg-bg border border-panel2 rounded px-2 py-1 w-20" />
                      ) : `₪${e.amount_ils}`}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select value={editForm.channel ?? "buyme"} onChange={(ev) => setEditForm({ ...editForm, channel: ev.target.value as Channel })} className="bg-bg border border-panel2 rounded px-2 py-1">
                          <option value="buyme">BuyMe</option>
                          <option value="amazon_au">Amazon AU</option>
                          <option value="amazon_us">Amazon US</option>
                          <option value="amazon_ca">Amazon CA</option>
                          <option value="manual">ידני</option>
                        </select>
                      ) : (
                        <span className="text-xs bg-panel2 px-2 py-0.5 rounded">{channelLabel[e.channel]}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-left whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={saveEdit} disabled={busy} className="text-xs bg-knowledge text-bg px-2 py-1 rounded">שמרי</button>
                          <button onClick={() => { setEditId(null); setEditForm({}); }} className="text-xs text-ink2 px-2 py-1">בטלי</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(e)} className="text-xs text-ink2 hover:text-accent" title="ערוך">✏</button>
                          {e.active === 1 ? (
                            <button onClick={() => depart(e.id, e.name)} className="text-xs text-ink2 hover:text-dev" title="סמן כעזב/ה">↗</button>
                          ) : (
                            <button onClick={() => restore(e.id)} className="text-xs text-ink2 hover:text-knowledge" title="החזר/י">↺</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-ink2 text-sm">
                    אין תוצאות.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
