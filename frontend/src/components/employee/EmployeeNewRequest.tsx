import { useEffect, useMemo, useState } from "react";
import { employeeApi, type EmployeeMe } from "../../employee-api";
import type { CatalogItem, DeliveryTo, EquipmentCategory } from "../../types";

const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  laptop: "💻 לפטופים",
  monitor: "🖥 מסכים",
  chair: "🪑 כיסאות",
  accessory: "🎧 אביזרים",
  software: "🧩 תוכנה",
  phone: "📱 טלפונים",
  other: "📦 אחר",
};

interface Props {
  me: EmployeeMe;
  onSubmitted: () => void;
  onCancel: () => void;
}

export function EmployeeNewRequest({ me, onSubmitted, onCancel }: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
  const [catalogId, setCatalogId] = useState<number | "">("");
  const [customName, setCustomName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [justification, setJustification] = useState("");
  const [deliveryTo, setDeliveryTo] = useState<DeliveryTo>("office");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    employeeApi
      .catalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  // Auto-fill home address from the org-chart record the first time the user
  // selects "home" (and only if the field is empty).
  useEffect(() => {
    if (deliveryTo === "home" && !deliveryAddress.trim() && me.address) {
      setDeliveryAddress(me.address);
    }
  }, [deliveryTo, me.address]);

  const isCustom = catalogId === "" || catalogId === -1;
  const homeMissingAddress = deliveryTo === "home" && !deliveryAddress.trim();
  const canSubmit =
    !busy &&
    (!isCustom || customName.trim().length > 0) &&
    !homeMissingAddress &&
    quantity > 0;

  // Group catalog by category for the picker
  const grouped = useMemo(() => {
    const out = new Map<EquipmentCategory, CatalogItem[]>();
    for (const cat of Object.keys(CATEGORY_LABEL) as EquipmentCategory[]) out.set(cat, []);
    for (const item of catalog ?? []) {
      if (!item.active) continue;
      out.get(item.category)?.push(item);
    }
    return out;
  }, [catalog]);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await employeeApi.createRequest({
        catalog_id: typeof catalogId === "number" && catalogId > 0 ? catalogId : undefined,
        custom_name: isCustom ? customName.trim() : undefined,
        quantity,
        justification: justification.trim() || undefined,
        delivery_to: deliveryTo,
        delivery_address: deliveryTo === "home" ? deliveryAddress.trim() : undefined,
      });
      onSubmitted();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">בקשת ציוד חדשה</h1>
        <button onClick={onCancel} className="text-ink2 hover:text-ink text-sm">
          ✕ ביטול
        </button>
      </div>

      <Field label="פריט מהקטלוג">
        <select
          value={catalogId}
          onChange={(e) => setCatalogId(e.target.value ? Number(e.target.value) : "")}
          className="w-full bg-bg border border-panel2 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        >
          <option value="">— בחר/י פריט —</option>
          {(Object.keys(CATEGORY_LABEL) as EquipmentCategory[]).map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (!items.length) return null;
            return (
              <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
                {items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.vendor ? ` · ${c.vendor}` : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
          <option value={-1}>📝 לא ברשימה — אכתוב שם בעצמי</option>
        </select>
      </Field>

      {isCustom && (
        <Field label="שם הפריט המבוקש">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="למשל: מקלדת אלחוטית של Logitech"
            className="w-full bg-bg border border-panel2 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
            required
          />
        </Field>
      )}

      <Field label="כמות">
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="w-full bg-bg border border-panel2 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        />
      </Field>

      <Field label="נימוק (אופציונלי)" hint="למה צריך, לאיזה פרויקט, מתי דחוף">
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={3}
          placeholder=""
          className="w-full bg-bg border border-panel2 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent resize-none"
        />
      </Field>

      <Field label="לאן לשלוח?">
        <div className="grid grid-cols-2 gap-2">
          <DeliveryRadio
            label="🏢 למשרד"
            value="office"
            current={deliveryTo}
            onChange={setDeliveryTo}
          />
          <DeliveryRadio
            label="🏠 הביתה"
            value="home"
            current={deliveryTo}
            onChange={setDeliveryTo}
          />
        </div>
      </Field>

      {deliveryTo === "home" && (
        <Field label="כתובת מלאה למשלוח" hint="רחוב, מספר בית, דירה, עיר, מיקוד, טלפון">
          <textarea
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            rows={3}
            className={`w-full bg-bg border rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none ${
              homeMissingAddress ? "border-dev focus:border-dev" : "border-panel2 focus:border-accent"
            }`}
            required
          />
          {me.address && deliveryAddress === me.address && (
            <div className="text-[10px] text-ink2 mt-1">
              ✓ נטען מהכתובת ברישומי החברה — אפשר לערוך
            </div>
          )}
        </Field>
      )}

      {err && (
        <div className="text-xs text-dev bg-dev/10 border border-dev/30 rounded-lg p-3">
          {err}
        </div>
      )}

      <div className="flex gap-2 pt-2 sticky bottom-0 bg-bg/80 backdrop-blur py-3 -mx-4 px-4 -mb-6 border-t border-panel2">
        <button
          onClick={onCancel}
          className="flex-1 text-sm text-ink2 hover:text-ink py-2.5 rounded-lg border border-panel2"
        >
          ביטול
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="flex-1 bg-accent text-white font-semibold text-sm rounded-lg py-2.5 disabled:opacity-40 transition-colors"
        >
          {busy ? "שולחת…" : "שלחי בקשה ✓"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-ink2 mt-1">{hint}</div>}
    </label>
  );
}

function DeliveryRadio({
  label,
  value,
  current,
  onChange,
}: {
  label: string;
  value: DeliveryTo;
  current: DeliveryTo;
  onChange: (v: DeliveryTo) => void;
}) {
  const active = current === value;
  return (
    <label
      className={`flex items-center justify-center gap-2 border rounded-lg px-3 py-3 cursor-pointer text-sm transition-colors ${
        active
          ? "border-accent bg-accent/10 text-ink"
          : "border-panel2 text-ink2 hover:text-ink hover:border-panel2"
      }`}
    >
      <input
        type="radio"
        name="delivery"
        value={value}
        checked={active}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
