import { useState } from "react";
import { api } from "../api";
import type { Proposal } from "../types";

interface Props {
  proposals: Proposal[];
  refresh: () => Promise<unknown>;
}

export function ProposalsPanel({ proposals, refresh }: Props) {
  const pending = proposals.filter((p) => p.status === "ready");
  const history = proposals.filter((p) => p.status !== "ready").slice(0, 10);

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-3">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">🛠 פיתוח — ממתינים לאישור</h1>
        <p className="text-xs text-ink2 mt-1">
          {pending.length} דיפים מהצוות (נועם · דניאל · קוסם)
        </p>
      </div>
        {pending.length === 0 && (
          <div className="text-center text-ink2 text-sm py-8">
            אין דיפים שמחכים. כשדניאל יסיים פיתוח — זה יופיע כאן.
          </div>
        )}
        {pending.map((p) => (
          <ProposalCard key={p.id} proposal={p} refresh={refresh} />
        ))}
        {history.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wide text-ink2 mt-6 mb-1">
              הסטוריה
            </div>
            {history.map((p) => (
              <div
                key={p.id}
                className="text-xs px-3 py-2 rounded bg-panel2 text-ink2"
              >
                #{p.id} {p.summary} —{" "}
                <span
                  className={
                    p.status === "merged"
                      ? "text-knowledge"
                      : p.status === "rejected"
                        ? "text-dev"
                        : ""
                  }
                >
                  {p.status}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ProposalCard({ proposal, refresh }: { proposal: Proposal; refresh: () => Promise<unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      if (action === "approve") {
        await api.approve(proposal.id, comment || undefined);
      } else {
        await api.reject(proposal.id, comment || undefined);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-panel2 rounded-lg p-3 border border-transparent hover:border-accent/30 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{proposal.summary}</div>
          <div className="text-[11px] text-ink2 code mt-0.5">
            #{proposal.id} · {proposal.branch}
          </div>
        </div>
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-[11px] text-accent hover:underline"
      >
        {expanded ? "הסתר דיף" : "הצג דיף"}
      </button>
      {expanded && (
        <pre className="mt-2 max-h-72 overflow-auto bg-bg/50 rounded p-2 text-[11px] code">
          {colorizeDiff(proposal.diff_text)}
        </pre>
      )}
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="הערה לצוות (אופציונלי)…"
        className="mt-2 w-full bg-bg/60 border border-panel2 rounded px-2 py-1 text-xs"
      />
      {error && <div className="text-dev text-xs mt-1">{error}</div>}
      <div className="flex gap-2 mt-2">
        <button
          disabled={busy}
          onClick={() => handle("approve")}
          className="flex-1 bg-knowledge/80 hover:bg-knowledge text-bg font-semibold text-sm py-1.5 rounded disabled:opacity-50"
        >
          ✓ אשרי ומזגי
        </button>
        <button
          disabled={busy}
          onClick={() => handle("reject")}
          className="flex-1 bg-dev/80 hover:bg-dev text-bg font-semibold text-sm py-1.5 rounded disabled:opacity-50"
        >
          ✗ דחי
        </button>
      </div>
    </div>
  );
}

function colorizeDiff(diff: string): React.ReactNode {
  return diff.split("\n").map((line, i) => {
    let cls = "";
    if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-knowledge";
    else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-dev";
    else if (line.startsWith("@@")) cls = "text-accent";
    else if (line.startsWith("diff ") || line.startsWith("index ") ||
             line.startsWith("+++") || line.startsWith("---"))
      cls = "text-ink2";
    return (
      <div key={i} className={cls}>
        {line || " "}
      </div>
    );
  });
}
