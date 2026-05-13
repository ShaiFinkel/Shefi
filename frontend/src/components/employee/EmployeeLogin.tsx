import { useState } from "react";

interface Props {
  onSubmit: (email: string) => Promise<{ ok: boolean; sent: boolean; dev_link?: string }>;
}

export function EmployeeLogin({ onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await onSubmit(email.trim());
      setDone(true);
      if (r.dev_link) setDevLink(r.dev_link);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-panel border border-panel2 rounded-2xl p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9b7eff] to-[#5b3bd9] flex items-center justify-center text-white text-3xl font-extrabold mb-3">
          ש
        </div>
        <h1 className="text-xl font-bold">Shefi &amp; Co.</h1>
        <p className="text-sm text-ink2 mt-1">פורטל עובדים</p>
      </div>

      {!done ? (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <div className="text-xs text-ink2 mb-1.5">המייל הארגוני שלך</div>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@yum.com"
              className="w-full bg-bg border border-panel2 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-left"
            />
          </label>

          {err && (
            <div className="text-xs text-dev bg-dev/10 border border-dev/30 rounded-lg p-3">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full bg-accent hover:bg-accent/90 text-white font-semibold text-sm rounded-lg py-2.5 disabled:opacity-40 transition-colors"
          >
            {busy ? "שולחת קישור…" : "שלחי לי קישור כניסה →"}
          </button>

          <p className="text-[11px] text-ink2 text-center mt-4 leading-relaxed">
            נשלח אלייך מייל עם קישור חד־פעמי בתוקף 30 דקות.
            <br />
            אין סיסמאות לזכור.
          </p>
        </form>
      ) : (
        <div className="text-center space-y-4">
          <div className="text-5xl">📬</div>
          <h2 className="text-lg font-semibold">הקישור נשלח</h2>
          <p className="text-sm text-ink2 leading-relaxed">
            בדקי את תיבת המייל שלך
            <br />
            <span dir="ltr" className="font-mono text-accent text-xs break-all">{email}</span>
          </p>
          <p className="text-[11px] text-ink2 leading-relaxed">
            לא הגיע? בדקי בספאם, או נסי שוב בעוד דקה.
          </p>
          {devLink && (
            <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-right space-y-2">
              <div className="font-semibold">⚙️ Dev mode (Resend לא מוגדר):</div>
              <a
                href={devLink}
                className="block underline break-all text-amber-200"
              >
                {devLink}
              </a>
            </div>
          )}
          <button
            onClick={() => {
              setDone(false);
              setDevLink(null);
            }}
            className="text-xs text-ink2 hover:text-ink underline"
          >
            כתובת אחרת
          </button>
        </div>
      )}
    </div>
  );
}
