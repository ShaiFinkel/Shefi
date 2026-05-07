import { useState } from "react";
import { api } from "../api";
import type { AgentInfo } from "../types";

interface Props {
  agents: AgentInfo[];
}

export function ChatBar({ agents: _agents }: Props) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<"Shefi" | "Noam">("Shefi");
  const [sending, setSending] = useState(false);

  async function send() {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    try {
      await api.chat(msg, target);
      setText("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-panel2 bg-panel/40 px-6 py-3">
      <div className="flex items-center gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as "Shefi" | "Noam")}
          className="bg-panel border border-panel2 rounded-md px-3 py-2 text-sm"
        >
          <option value="Shefi">לשפי (תפעול)</option>
          <option value="Noam">לנועם (פיתוח)</option>
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            target === "Shefi"
              ? "מה לעשות? תזכרי לי, רעיון, שאלה…"
              : "מה לפתח? פיצ'ר חדש, תיקון…"
          }
          className="flex-1 bg-panel border border-panel2 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="bg-accent hover:bg-accent/80 text-white font-semibold text-sm px-5 py-2 rounded-md disabled:opacity-50"
        >
          שלחי
        </button>
      </div>
    </div>
  );
}
