import { useEffect, useState } from "react";
import { employeeApi } from "../../employee-api";
import type { EquipmentRequest, EquipmentRequestStatus } from "../../types";

const STATUS_LABEL: Record<EquipmentRequestStatus, string> = {
  pending: "ממתין לאישור מנהל",
  manager_approved: "ממתין לאישור CEO",
  exec_approved: "מאושר — בדרך אלייך",
  ordered: "הוזמן מהספק",
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

const STATUS_PROGRESS: Record<EquipmentRequestStatus, number> = {
  pending: 1,
  manager_approved: 2,
  exec_approved: 3,
  ordered: 4,
  received: 5,
  rejected: 0,
};

export function EmployeeHistory() {
  const [rows, setRows] = useState<EquipmentRequest[] | null>(null);
  const [open, setOpen] = useState<EquipmentRequest | null>(null);

  useEffect(() => {
    employeeApi
      .myRequests()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (!rows) {
    return <div className="text-center text-ink2 py-12">טוען…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">📭</div>
        <h2 className="text-lg font-semibold mb-1">אין בקשות עדיין</h2>
        <p className="text-sm text-ink2">
          לחצי "בקשה חדשה" בכותרת כדי להגיש את הראשונה.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ההיסטוריה שלי</h1>

      <div className="space-y-3">
        {rows.map((r) => (
          <RequestCard key={r.id} req={r} onClick={() => setOpen(r)} />
        ))}
      </div>

      {open && <RequestDetail req={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function RequestCard({ req, onClick }: { req: EquipmentRequest; onClick: () => void }) {
  const status = req.status;
  return (
    <button
      onClick={onClick}
      className="w-full text-right bg-panel border border-panel2 rounded-xl p-4 hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{req.display_name}</div>
          <div className="text-[11px] text-ink2 mt-0.5 flex flex-wrap gap-1.5">
            <span>{req.created_at?.slice(0, 10)}</span>
            <span>·</span>
            <span>כמות {req.quantity}</span>
            {req.delivery_to === "home" && (
              <>
                <span>·</span>
                <span className="text-events">🏠 הביתה</span>
              </>
            )}
          </div>
        </div>
        <span className={`text-[10px] border rounded-full px-2 py-0.5 whitespace-nowrap ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {status !== "rejected" && <ProgressBar status={status} />}
      {status === "rejected" && req.rejected_reason && (
        <div className="text-[11px] text-dev mt-2 bg-dev/10 border border-dev/30 rounded p-2">
          סיבת דחייה: {req.rejected_reason}
        </div>
      )}
    </button>
  );
}

function ProgressBar({ status }: { status: EquipmentRequestStatus }) {
  const stage = STATUS_PROGRESS[status];
  const labels = ["הוגש", "מנהל", "CEO", "הוזמן", "נמסר"];
  return (
    <div className="mt-3">
      <div className="flex gap-1">
        {labels.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full ${
              i < stage
                ? "bg-knowledge"
                : i === stage - 1
                  ? "bg-accent"
                  : "bg-panel2"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-ink2 mt-1">
        {labels.map((l, i) => (
          <span key={i} className={i < stage ? "text-knowledge" : ""}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function RequestDetail({
  req,
  onClose,
}: {
  req: EquipmentRequest;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-panel border border-panel2 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-panel border-b border-panel2 px-5 py-4 flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold truncate">{req.display_name}</h2>
            <span className={`inline-block mt-2 text-[11px] border rounded-full px-2 py-0.5 ${STATUS_COLOR[req.status]}`}>
              {STATUS_LABEL[req.status]}
            </span>
          </div>
          <button onClick={onClose} className="text-ink2 hover:text-ink text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          <KV k="מס' בקשה" v={`#${req.id}`} />
          <KV k="כמות" v={String(req.quantity)} />
          <KV k="הוגש בתאריך" v={req.created_at?.slice(0, 10)} />

          {req.justification && (
            <div>
              <div className="text-xs text-ink2 mb-1">נימוק</div>
              <p className="text-sm bg-bg border border-panel2 rounded p-2 whitespace-pre-wrap">
                {req.justification}
              </p>
            </div>
          )}

          <div>
            <div className="text-xs text-ink2 mb-1">יעד משלוח</div>
            {req.delivery_to === "home" ? (
              <div className="bg-accent/10 border border-accent/30 rounded p-2">
                <div className="text-xs font-semibold text-accent mb-1">🏠 משלוח הביתה</div>
                <p className="text-sm whitespace-pre-wrap">{req.delivery_address}</p>
              </div>
            ) : req.delivery_to === "office" ? (
              <div className="text-sm">🏢 איסוף במשרד</div>
            ) : (
              <div className="text-xs text-ink2 italic">לא הוגדר</div>
            )}
          </div>

          {req.status === "rejected" && req.rejected_reason && (
            <div className="bg-dev/10 border border-dev/30 rounded p-3">
              <div className="text-xs font-semibold text-dev mb-1">סיבת דחייה</div>
              <p className="text-sm">{req.rejected_reason}</p>
            </div>
          )}

          <div className="border-t border-panel2 pt-3 space-y-2">
            <KV k="אישור מנהל" v={req.manager_decision_at?.slice(0, 10) ?? "—"} />
            <KV k="אישור CEO" v={req.exec_decision_at?.slice(0, 10) ?? "—"} />
            <KV k="הוזמן" v={req.ordered_at?.slice(0, 10) ?? "—"} />
            <KV k="נמסר" v={req.received_at?.slice(0, 10) ?? "—"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink2">{k}</span>
      <span>{v ?? "—"}</span>
    </div>
  );
}
