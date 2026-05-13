import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type {
  CatalogItem,
  DeliveryTo,
  Employee,
  EquipmentCategory,
  EquipmentRequest,
  EquipmentRequestStatus,
} from "../types";

type InnerTab = "queue" | "catalog" | "all";

const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  laptop: "💻 לפטופ",
  monitor: "🖥 מסך",
  chair: "🪑 כיסא",
  accessory: "🎧 אביזר",
  software: "🧩 תוכנה",
  phone: "📱 טלפון",
  other: "📦 אחר",
};

const STATUS_LABEL: Record<EquipmentRequestStatus, string> = {
  pending: "ממתין לאישור מנהל",
  manager_approved: "ממתין לאישור בכיר",
  exec_approved: "מאושר — להזמין",
  ordered: "הוזמן",
  received: "נמסר",
  rejected: "נדחה",
};

const STATUS_COLOR: Record<EquipmentRequestStatus, string> = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  manager_approved: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  exec_approved: "bg-knowledge/20 text-knowledge border-knowledge/40",
  ordered: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  received: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  rejected: "bg-dev/20 text-dev border-dev/40",
};

function fmtMoney(n: number | null, currency: string | null) {
  if (n === null || n === undefined) return "—";
  return `${currency || "₪"}${n.toLocaleString("en-US")}`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return s.slice(0, 10);
}

export function EquipmentPage() {
  const [tab, setTab] = useState<InnerTab>("queue");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);
  const [showNewReq, setShowNewReq] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | "new" | null>(null);
  const [detail, setDetail] = useState<EquipmentRequest | null>(null);

  async function loadAll() {
    try {
      const [c, r, e] = await Promise.all([
        api.catalog(true),
        api.equipmentRequests({ status: "all" }),
        api.employees(),
      ]);
      setCatalog(c);
      setRequests(r);
      setEmployees(e);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const queue = useMemo(
    () => requests.filter((r) => r.status === "pending" || r.status === "manager_approved"),
    [requests],
  );
  const exec_approved = useMemo(
    () => requests.filter((r) => r.status === "exec_approved" || r.status === "ordered"),
    [requests],
  );

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className={`flex-1 overflow-y-auto ${detail ? "border-l border-panel2" : ""}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">📦 ציוד עובדים</h1>
              <p className="text-xs text-ink2 mt-1">
                {queue.length} לאישור · {exec_approved.length} מאושרות · {catalog.filter((c) => c.active).length} פריטים בקטלוג
              </p>
            </div>
            <div className="flex gap-2">
              {tab === "catalog" && (
                <button
                  onClick={() => setEditingItem("new")}
                  className="bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-md px-4 py-2"
                >
                  + פריט לקטלוג
                </button>
              )}
              <button
                onClick={() => setShowNewReq(true)}
                className="bg-knowledge text-bg text-sm font-semibold rounded-md px-4 py-2"
              >
                + בקשה חדשה
              </button>
            </div>
          </div>

          {/* Inner tabs */}
          <div className="flex gap-1 border-b border-panel2 mb-4">
            <InnerTabBtn active={tab === "queue"} onClick={() => setTab("queue")} label={`לאישור (${queue.length})`} />
            <InnerTabBtn active={tab === "catalog"} onClick={() => setTab("catalog")} label={`קטלוג (${catalog.filter((c) => c.active).length})`} />
            <InnerTabBtn active={tab === "all"} onClick={() => setTab("all")} label={`כל הבקשות (${requests.length})`} />
          </div>

          {tab === "queue" && (
            <RequestsTable
              rows={queue}
              onSelect={setDetail}
              emptyMsg="אין בקשות שממתינות לאישור 🎉"
            />
          )}

          {tab === "catalog" && (
            <CatalogGrid
              items={catalog}
              busy={busy}
              onEdit={setEditingItem}
              onToggleActive={async (item) => {
                setBusy(true);
                try {
                  await api.updateCatalogItem(item.id, { active: item.active ? 0 : 1 });
                  await loadAll();
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          {tab === "all" && (
            <RequestsTable rows={requests} onSelect={setDetail} emptyMsg="אין בקשות עדיין." />
          )}
        </div>
      </div>

      {detail && (
        <RequestDrawer
          req={detail}
          busy={busy}
          onClose={() => setDetail(null)}
          onAction={async (fn) => {
            setBusy(true);
            try {
              await fn();
              await loadAll();
              const fresh = (await api.equipmentRequests({ status: "all" })).find((r) => r.id === detail.id);
              setDetail(fresh ?? null);
            } catch (err) {
              alert("שגיאה: " + (err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {showNewReq && (
        <NewRequestModal
          employees={employees}
          catalog={catalog.filter((c) => c.active)}
          onClose={() => setShowNewReq(false)}
          onCreated={async () => {
            setShowNewReq(false);
            await loadAll();
          }}
        />
      )}

      {editingItem && (
        <CatalogItemModal
          initial={editingItem === "new" ? null : editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={async () => {
            setEditingItem(null);
            await loadAll();
          }}
        />
      )}
    </div>
  );
}

function InnerTabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
        active ? "border-accent text-ink" : "border-transparent text-ink2 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function RequestsTable({
  rows,
  onSelect,
  emptyMsg,
}: {
  rows: EquipmentRequest[];
  onSelect: (r: EquipmentRequest) => void;
  emptyMsg: string;
}) {
  if (!rows.length) {
    return (
      <div className="bg-panel border border-panel2 rounded-xl p-10 text-center text-ink2 text-sm">
        {emptyMsg}
      </div>
    );
  }
  return (
    <div className="bg-panel border border-panel2 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-panel2/50 text-xs text-ink2 uppercase">
          <tr>
            <th className="text-right px-3 py-2">פריט</th>
            <th className="text-right px-3 py-2">עובד/ת</th>
            <th className="text-right px-3 py-2">מחלקה</th>
            <th className="text-right px-3 py-2">כמות</th>
            <th className="text-right px-3 py-2">מחיר</th>
            <th className="text-right px-3 py-2">סטטוס</th>
            <th className="text-right px-3 py-2">תאריך</th>
            <th className="text-right px-3 py-2">הצעת מחיר</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r)}
              className="border-t border-panel2 cursor-pointer hover:bg-panel2/30"
            >
              <td className="px-3 py-2 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>{r.display_name}</span>
                  {r.delivery_to === "home" && (
                    <span title="משלוח הביתה" className="text-events text-[11px]">🏠</span>
                  )}
                </div>
                {r.catalog_category && (
                  <div className="text-[10px] text-ink2">{CATEGORY_LABEL[r.catalog_category]}</div>
                )}
              </td>
              <td className="px-3 py-2 text-xs">{r.employee_name}</td>
              <td className="px-3 py-2 text-xs text-ink2">{r.employee_department ?? "—"}</td>
              <td className="px-3 py-2 text-xs">{r.quantity}</td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {fmtMoney(r.catalog_price, r.catalog_currency)}
              </td>
              <td className="px-3 py-2">
                <span className={`text-[11px] border rounded-full px-2 py-0.5 ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-ink2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
              <td className="px-3 py-2 text-xs">
                {r.quote_url ? (
                  <a
                    href={r.quote_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-accent hover:underline"
                  >
                    קישור ↗
                  </a>
                ) : (
                  <span className="text-ink2/40">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CatalogGrid({
  items,
  busy,
  onEdit,
  onToggleActive,
}: {
  items: CatalogItem[];
  busy: boolean;
  onEdit: (item: CatalogItem) => void;
  onToggleActive: (item: CatalogItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="bg-panel border border-panel2 rounded-xl p-10 text-center text-ink2 text-sm">
        עדיין אין פריטים בקטלוג. לחצי "+ פריט לקטלוג" כדי להוסיף.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((it) => (
        <div
          key={it.id}
          onClick={() => onEdit(it)}
          className={`bg-panel border border-panel2 rounded-xl p-4 cursor-pointer hover:border-accent/50 transition ${
            it.active ? "" : "opacity-50"
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-semibold">{it.name}</div>
              <div className="text-[11px] text-ink2 mt-0.5">{CATEGORY_LABEL[it.category]}</div>
            </div>
            <div className="text-sm font-mono">{fmtMoney(it.price, it.currency)}</div>
          </div>
          {it.description && <p className="text-xs text-ink2 mb-2">{it.description}</p>}
          {it.vendor && <p className="text-[11px] text-ink2">ספק: {it.vendor}</p>}
          <div className="mt-3 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEdit(it)}
              disabled={busy}
              className="text-[11px] text-accent hover:underline"
            >
              ✏ ערוך/י
            </button>
            <button
              onClick={() => onToggleActive(it)}
              disabled={busy}
              className="text-[11px] text-ink2 hover:text-dev"
            >
              {it.active ? "השבת" : "הפעל"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestDrawer({
  req,
  busy,
  onClose,
  onAction,
}: {
  req: EquipmentRequest;
  busy: boolean;
  onClose: () => void;
  onAction: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [quoteUrl, setQuoteUrl] = useState(req.quote_url ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  return (
    <aside className="w-[420px] bg-panel/30 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{req.display_name}</h2>
        <button onClick={onClose} className="text-ink2 hover:text-ink text-xl leading-none">
          ×
        </button>
      </div>

      <div className="text-xs text-ink2 mb-4">
        {req.catalog_category && CATEGORY_LABEL[req.catalog_category]} · {req.employee_name}
        {req.employee_department && ` · ${req.employee_department}`}
      </div>

      <div className="mb-5">
        <span className={`text-xs border rounded-full px-3 py-1 ${STATUS_COLOR[req.status]}`}>
          {STATUS_LABEL[req.status]}
        </span>
      </div>

      <Section title="פרטים">
        <KV k="עובד/ת" v={req.employee_name} />
        <KV k="מנהל/ת" v={req.employee_manager_name} />
        <KV k="כמות" v={String(req.quantity)} />
        <KV k="מחיר משוער" v={fmtMoney(req.catalog_price, req.catalog_currency)} />
        <KV k="הוגש" v={fmtDate(req.created_at)} />
      </Section>

      {req.justification && (
        <Section title="נימוק">
          <p className="text-xs whitespace-pre-wrap">{req.justification}</p>
        </Section>
      )}

      <Section title="יעד משלוח">
        {req.delivery_to === "home" ? (
          <div className="bg-events/10 border border-events/30 rounded p-2 space-y-1">
            <div className="text-xs font-semibold text-events">🏠 משלוח הביתה</div>
            {req.delivery_address ? (
              <p className="text-xs whitespace-pre-wrap text-ink">{req.delivery_address}</p>
            ) : (
              <p className="text-[11px] text-dev">⚠ חסרה כתובת — חובה להשלים לפני הזמנה</p>
            )}
          </div>
        ) : req.delivery_to === "office" ? (
          <div className="text-xs text-ink2">🏢 איסוף במשרד</div>
        ) : (
          <div className="text-xs text-ink2 italic">לא הוגדר (בקשה ישנה)</div>
        )}
      </Section>

      <Section title="הצעת מחיר">
        {req.quote_url && (
          <div className="bg-knowledge/10 border border-knowledge/30 rounded p-2 mb-2 flex justify-between items-center">
            <a
              href={req.quote_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-knowledge hover:underline truncate"
              title={req.quote_url}
            >
              📎 {req.quote_url.startsWith("/api/equipment/quotes/")
                ? decodeURIComponent(req.quote_url.split("/").pop() ?? "קובץ").replace(/^req-\d+-\d+-/, "")
                : "קישור חיצוני"} ↗
            </a>
            <span className="text-[10px] text-ink2 mr-2 shrink-0">
              {req.quote_url.startsWith("/api/equipment/quotes/") ? "קובץ" : "URL"}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <label className="block">
            <div className="text-[11px] text-ink2 mb-1">העלאת קובץ (PDF/תמונה/Excel · עד 10MB)</div>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.docx,.doc"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                onAction(() => api.uploadQuote(req.id, f));
                e.target.value = "";
              }}
              className="text-xs w-full file:mr-2 file:px-3 file:py-1 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer file:text-xs"
            />
          </label>

          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-panel2"></div>
            <span className="text-[10px] text-ink2">או קישור</span>
            <div className="flex-1 border-t border-panel2"></div>
          </div>

          <div className="flex gap-2">
            <input
              value={quoteUrl}
              onChange={(e) => setQuoteUrl(e.target.value)}
              placeholder="Google Drive / Dropbox / WeTransfer…"
              className="bg-bg border border-panel2 rounded px-2 py-1 flex-1 text-xs"
            />
            <button
              onClick={() => onAction(() => api.attachQuote(req.id, quoteUrl))}
              disabled={busy || !quoteUrl.trim() || quoteUrl === req.quote_url}
              className="text-xs bg-panel2 px-2 py-1 rounded hover:bg-panel2/80 disabled:opacity-40"
            >
              שמרי
            </button>
          </div>
        </div>
      </Section>

      <Section title="היסטוריית אישורים">
        <KV k="אישור מנהל" v={req.manager_decision_by ? `${req.manager_decision_by} · ${fmtDate(req.manager_decision_at)}` : null} />
        <KV k="אישור בכיר" v={req.exec_decision_by ? `${req.exec_decision_by} · ${fmtDate(req.exec_decision_at)}` : null} />
        {req.ordered_at && <KV k="הוזמן" v={fmtDate(req.ordered_at)} />}
        {req.received_at && <KV k="נמסר" v={fmtDate(req.received_at)} />}
        {req.rejected_reason && <KV k="סיבת דחייה" v={req.rejected_reason} />}
      </Section>

      <div className="space-y-2 mt-6">
        {req.status === "pending" && (
          <button
            onClick={() => onAction(() => api.managerApproveRequest(req.id))}
            disabled={busy}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-40"
          >
            ✓ אישור מנהל ישיר
          </button>
        )}
        {(req.status === "pending" || req.status === "manager_approved") && (
          <button
            onClick={() => onAction(() => api.execApproveRequest(req.id, quoteUrl || undefined))}
            disabled={busy}
            className="w-full bg-knowledge text-bg text-sm font-semibold rounded-md px-4 py-2 disabled:opacity-40"
          >
            ✓✓ אישור סופי (CEO){quoteUrl ? " + צרפי הצעת מחיר" : ""}
          </button>
        )}
        {req.status === "exec_approved" && (
          <button
            onClick={() => onAction(() => api.markRequestOrdered(req.id))}
            disabled={busy}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-40"
          >
            🛒 הוזמן מהספק
          </button>
        )}
        {(req.status === "ordered" || req.status === "exec_approved") && (
          <button
            onClick={() => onAction(() => api.markRequestReceived(req.id))}
            disabled={busy}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md px-4 py-2 disabled:opacity-40"
          >
            📦 התקבל אצל העובד/ת
          </button>
        )}

        {req.status !== "rejected" && req.status !== "received" && (
          <>
            {!showReject ? (
              <button
                onClick={() => setShowReject(true)}
                disabled={busy}
                className="w-full text-sm text-ink2 hover:text-dev border border-panel2 rounded-md px-4 py-2"
              >
                דחייה
              </button>
            ) : (
              <div className="space-y-2 border border-dev/40 rounded-md p-3">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="סיבת דחייה (חובה)…"
                  rows={2}
                  className="bg-bg border border-panel2 rounded px-2 py-1 w-full text-xs"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowReject(false); setRejectReason(""); }}
                    className="flex-1 text-xs text-ink2 hover:text-ink"
                  >
                    בטלי
                  </button>
                  <button
                    onClick={() => onAction(() => api.rejectRequest(req.id, rejectReason).then(() => { setShowReject(false); setRejectReason(""); }))}
                    disabled={busy || !rejectReason.trim()}
                    className="flex-1 bg-dev text-white text-xs rounded px-3 py-1 disabled:opacity-40"
                  >
                    דחה/י
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function NewRequestModal({
  employees,
  catalog,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  catalog: CatalogItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [catalogId, setCatalogId] = useState<number | "">("");
  const [customName, setCustomName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [justification, setJustification] = useState("");
  const [deliveryTo, setDeliveryTo] = useState<DeliveryTo>("office");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const isCustom = catalogId === "" || catalogId === -1;
  const selectedEmployee =
    typeof employeeId === "number" ? employees.find((e) => e.id === employeeId) : undefined;

  // Autofill the home address from the employee's address in the org chart
  // the first time the user picks "home" (and only if the field is empty).
  useEffect(() => {
    if (deliveryTo === "home" && !deliveryAddress.trim() && selectedEmployee?.address) {
      setDeliveryAddress(selectedEmployee.address);
    }
  }, [deliveryTo, selectedEmployee]);

  const homeMissingAddress = deliveryTo === "home" && !deliveryAddress.trim();

  async function submit() {
    if (typeof employeeId !== "number") return;
    if (isCustom && !customName.trim()) return;
    if (homeMissingAddress) return;
    setBusy(true);
    try {
      await api.createEquipmentRequest({
        employee_id: employeeId,
        catalog_id: typeof catalogId === "number" && catalogId > 0 ? catalogId : undefined,
        custom_name: isCustom ? customName.trim() : undefined,
        quantity,
        justification: justification.trim() || undefined,
        delivery_to: deliveryTo,
        delivery_address: deliveryTo === "home" ? deliveryAddress.trim() : undefined,
      });
      onCreated();
    } catch (e) {
      alert("שגיאה: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="בקשת ציוד חדשה" onClose={onClose}>
      <Field label="עבור איזה עובד/ת">
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : "")}
          className="bg-bg border border-panel2 rounded px-2 py-1 w-full"
        >
          <option value="">— בחר/י —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} {e.department ? `· ${e.department}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="פריט מהקטלוג">
        <select
          value={catalogId}
          onChange={(e) => setCatalogId(e.target.value ? Number(e.target.value) : "")}
          className="bg-bg border border-panel2 rounded px-2 py-1 w-full"
        >
          <option value="">— בחר/י מהקטלוג —</option>
          {(Object.keys(CATEGORY_LABEL) as EquipmentCategory[])
            .map((cat) => {
              const items = catalog.filter((c) => c.active && c.category === cat);
              if (!items.length) return null;
              return (
                <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
                  {items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.vendor ? ` · ${c.vendor}` : ""}
                      {c.price ? ` · ${fmtMoney(c.price, c.currency)}` : ""}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          <option value={-1}>📝 אחר (פריט מותאם — לא בקטלוג)</option>
        </select>
      </Field>

      {isCustom && (
        <Field label="שם הפריט המבוקש">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="למשל: מקלדת אלחוטית של Logitech MX Keys"
            className="bg-bg border border-panel2 rounded px-2 py-1 w-full"
          />
        </Field>
      )}

      <Field label="כמות">
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="bg-bg border border-panel2 rounded px-2 py-1 w-full"
        />
      </Field>

      <Field label="נימוק">
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={3}
          placeholder="למה צריך, לאיזה פרויקט, מתי דחוף…"
          className="bg-bg border border-panel2 rounded px-2 py-1 w-full"
        />
      </Field>

      <Field label="לאן לשלוח?">
        <div className="grid grid-cols-2 gap-2">
          <label className={`flex items-center justify-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-sm ${
            deliveryTo === "office"
              ? "border-accent bg-accent/10 text-ink"
              : "border-panel2 text-ink2 hover:text-ink"
          }`}>
            <input type="radio" name="delivery" value="office" checked={deliveryTo === "office"}
              onChange={() => setDeliveryTo("office")} className="sr-only" />
            🏢 למשרד
          </label>
          <label className={`flex items-center justify-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-sm ${
            deliveryTo === "home"
              ? "border-accent bg-accent/10 text-ink"
              : "border-panel2 text-ink2 hover:text-ink"
          }`}>
            <input type="radio" name="delivery" value="home" checked={deliveryTo === "home"}
              onChange={() => setDeliveryTo("home")} className="sr-only" />
            🏠 הביתה
          </label>
        </div>
      </Field>

      {deliveryTo === "home" && (
        <Field label="כתובת מלאה למשלוח">
          <textarea
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            rows={3}
            placeholder="רחוב, מספר בית, דירה, עיר, מיקוד, טלפון לתיאום…"
            className={`bg-bg border rounded px-2 py-1 w-full ${
              homeMissingAddress ? "border-dev" : "border-panel2"
            }`}
            required
          />
          {selectedEmployee?.address && deliveryAddress === selectedEmployee.address && (
            <div className="text-[10px] text-ink2 mt-1">
              ✓ נטען מהכתובת בעץ הארגוני — אפשר לערוך
            </div>
          )}
          {homeMissingAddress && (
            <div className="text-[10px] text-dev mt-1">חובה למלא כתובת מלאה</div>
          )}
        </Field>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-sm text-ink2 px-4 py-2">ביטול</button>
        <button
          onClick={submit}
          disabled={busy || typeof employeeId !== "number" || (isCustom && !customName.trim()) || homeMissingAddress}
          className="bg-knowledge text-bg font-semibold text-sm rounded-md px-4 py-2 disabled:opacity-40"
        >
          {busy ? "…" : "צרי בקשה"}
        </button>
      </div>
    </Modal>
  );
}

function CatalogItemModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: CatalogItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<EquipmentCategory>(initial?.category ?? "laptop");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [price, setPrice] = useState<number | "">(initial?.price ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "₪");
  const [active, setActive] = useState(initial?.active ?? 1);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        description: description.trim() || null,
        vendor: vendor.trim() || null,
        price: typeof price === "number" ? price : null,
        currency,
      };
      if (isEdit && initial) {
        await api.updateCatalogItem(initial.id, { ...payload, active });
      } else {
        await api.createCatalogItem(payload);
      }
      onSaved();
    } catch (e) {
      alert("שגיאה: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? `עריכת פריט: ${initial?.name}` : "פריט חדש לקטלוג"} onClose={onClose}>
      <Field label="שם הפריט">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: MacBook Pro 14"
          className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
      </Field>
      <Field label="קטגוריה">
        <select value={category} onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
          className="bg-bg border border-panel2 rounded px-2 py-1 w-full">
          {(Object.keys(CATEGORY_LABEL) as EquipmentCategory[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>
          ))}
        </select>
      </Field>
      <Field label="תיאור">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
      </Field>
      <Field label="ספק מועדף">
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Apple Israel / Office Depot…"
          className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="מחיר משוער">
          <input type="number" value={price}
            onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
            className="bg-bg border border-panel2 rounded px-2 py-1 w-full" />
        </Field>
        <Field label="מטבע">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="bg-bg border border-panel2 rounded px-2 py-1 w-full">
            <option value="₪">₪</option>
            <option value="$">$</option>
            <option value="€">€</option>
          </select>
        </Field>
      </div>

      {isEdit && (
        <Field label="סטטוס">
          <select value={active} onChange={(e) => setActive(Number(e.target.value))}
            className="bg-bg border border-panel2 rounded px-2 py-1 w-full">
            <option value={1}>פעיל (זמין לבקשות)</option>
            <option value={0}>מושבת (לא יופיע ברשימת הבחירה)</option>
          </select>
        </Field>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-sm text-ink2 px-4 py-2">ביטול</button>
        <button onClick={submit} disabled={busy || !name.trim()}
          className="bg-accent text-white font-semibold text-sm rounded-md px-4 py-2 disabled:opacity-40">
          {busy ? "…" : isEdit ? "שמרי שינויים" : "הוסיפי לקטלוג"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-panel border border-panel2 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-ink2 hover:text-ink text-xl leading-none">×</button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
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
  if (!v) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <div className="text-ink2 mb-1">{label}</div>
      {children}
    </label>
  );
}
