import { useEffect, useState } from "react";
import { employeeApi } from "../../employee-api";
import type { EquipmentRequest } from "../../types";

export function EmployeeApprovals() {
  const [rows, setRows] = useState<EquipmentRequest[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await employeeApi.pendingApprovals();
      setRows(r);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: number) {
    setBusy(id);
    setErr(null);
    try {
      await employeeApi.managerApprove(id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submitReject(id: number) {
    if (!reason.trim()) return;
    setBusy(id);
    setErr(null);
    try {
      await employeeApi.managerReject(id, reason.trim());
      setRejecting(null);
      setReason("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!rows) {
    return <div className="text-center text-ink2 py-12">טוען…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">אישורים ממתינים לי</h1>
        <p className="text-sm text-ink2 mt-1">
          {rows.length === 0
            ? "אין כרגע בקשות שדורשות את אישורך 🎉"
            : `${rows.length} ${rows.length === 1 ? "בקשה ממתינה" : "בקשות ממתינות"}`}
        </p>
      </div>

      {err && (
        <div className="text-xs text-dev bg-dev/10 border border-dev/30 rounded-lg p-3">
          {err}
        </div>
      )}

      {rows.length === 0 && (
        <div className="text-center py-16 text-ink2">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-sm">הצוות שלך אין בקשות פתוחות.</p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((req) => (
          <ApprovalCard
            key={req.id}
            req={req}
            busy={busy === req.id}
            isRejecting={rejecting === req.id}
            reason={reason}
            setReason={setReason}
            onApprove={() => approve(req.id)}
            onStartReject={() => {
              setRejecting(req.id);
              setReason("");
            }}
            onCancelReject={() => {
              setRejecting(null);
              setReason("");
            }}
            onSubmitReject={() => submitReject(req.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ApprovalCard({
  req,
  busy,
  isRejecting,
  reason,
  setReason,
  onApprove,
  onStartReject,
  onCancelReject,
  onSubmitReject,
}: {
  req: EquipmentRequest;
  busy: boolean;
  isRejecting: boolean;
  reason: string;
  setReason: (s: string) => void;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onSubmitReject: () => void;
}) {
  return (
    <div className="bg-panel border border-panel2 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-panel2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{req.employee_name}</div>
          <div className="text-[11px] text-ink2 mt-0.5">
            {req.created_at?.slice(0, 10)} · {req.employee_department ?? "—"}
          </div>
        </div>
        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full px-2 py-0.5 whitespace-nowrap">
          ממתין לאישורך
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div>
          <div className="text-base font-semibold">{req.display_name}</div>
          <div className="text-[11px] text-ink2 mt-1 flex flex-wrap gap-x-2">
            <span>כמות: {req.quantity}</span>
            {req.catalog_price && (
              <>
                <span>·</span>
                <span>
                  ~{req.catalog_currency || "₪"}
                  {req.catalog_price.toLocaleString("en-US")} ליחידה
                </span>
              </>
            )}
            {req.delivery_to === "home" && (
              <>
                <span>·</span>
                <span className="text-events">🏠 הביתה</span>
              </>
            )}
            {req.delivery_to === "office" && (
              <>
                <span>·</span>
                <span>🏢 למשרד</span>
              </>
            )}
          </div>
        </div>

        {req.justification && (
          <div className="bg-bg border border-panel2 rounded-lg p-3">
            <div className="text-[10px] text-ink2 mb-1">נימוק</div>
            <p className="text-sm whitespace-pre-wrap">{req.justification}</p>
          </div>
        )}

        {req.delivery_to === "home" && req.delivery_address && (
          <div className="bg-bg border border-panel2 rounded-lg p-3">
            <div className="text-[10px] text-ink2 mb-1">כתובת משלוח</div>
            <p className="text-sm whitespace-pre-wrap">{req.delivery_address}</p>
          </div>
        )}
      </div>

      {!isRejecting ? (
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onStartReject}
            disabled={busy}
            className="flex-1 text-sm text-ink2 hover:text-dev border border-panel2 rounded-lg py-2.5 disabled:opacity-40"
          >
            ✕ דחייה
          </button>
          <button
            onClick={onApprove}
            disabled={busy}
            className="flex-[2] bg-knowledge text-bg font-semibold text-sm rounded-lg py-2.5 disabled:opacity-40"
          >
            {busy ? "…" : "✓ אישור"}
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-2 border-t border-dev/20 pt-3 mx-2 -mb-1 bg-dev/5">
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="סיבת הדחייה (חובה)…"
            className="w-full bg-bg border border-panel2 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-dev resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={onCancelReject}
              disabled={busy}
              className="flex-1 text-xs text-ink2 hover:text-ink py-2 rounded-lg"
            >
              ביטול
            </button>
            <button
              onClick={onSubmitReject}
              disabled={busy || !reason.trim()}
              className="flex-1 bg-dev text-white text-sm rounded-lg py-2 disabled:opacity-40"
            >
              דחה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
