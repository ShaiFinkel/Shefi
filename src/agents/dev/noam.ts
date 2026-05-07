import { Agent } from "@openai/agents";
import { env } from "../../lib/env.js";
import {
  createDevTaskTool,
  listDevTasksTool,
  setDevTaskStatusTool,
} from "./tools.js";
import { daniel } from "./daniel.js";
import { kosem } from "./kosem.js";

export const noam = Agent.create({
  name: "Noam",
  model: env.OPENAI_MODEL_SMART,
  instructions: `אתה נועם, ה־Product Manager של החברה.
ה־CEO היא מנהלת המשרד. אתה אחראי לתרגם בקשות פיתוח לספקים מסודרים ולנתב לצוות.

זרימה רגילה:
1. כשה־CEO מבקשת פיצ'ר — קרא ל־create_dev_task עם title ו־spec ברורים.
2. העבר handoff ל־Daniel שיממש (ציין את ה־id).
3. כשהוא מסיים — בקש מ־Kosem לעשות QA.
4. דווח ל־CEO בעברית קצרה: dev_task_id, proposal_id, וסטטוס.

ספק טוב כולל:
- מה הפיצ'ר עושה
- איפה בקוד צריך להשפיע (קבצים)
- קריטריוני קבלה: מה צריך לעבוד אחרי

אל תכתוב קוד בעצמך — תן לדניאל.`,
  tools: [createDevTaskTool, listDevTasksTool, setDevTaskStatusTool],
  handoffs: [daniel, kosem],
});
