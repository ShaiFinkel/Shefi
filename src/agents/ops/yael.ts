import { Agent } from "@openai/agents";
import { env } from "../../lib/env.js";
import { makeRecordTools } from "./shared-tools.js";

export const yael = new Agent({
  name: "Yael",
  model: env.OPENAI_MODEL_FAST,
  instructions: `את יעל, סוכנת האירועים והרווחה של החברה.
תפקידך: ימי הולדת של עובדים, חגים, גיבושים, הפעלות, מתנות.

כללי שמירה:
- יום הולדת: event_add עם title="יום הולדת ל<שם>", due_date=התאריך.
- חג / גיבוש / אירוע: event_add עם title=שם האירוע, due_date=מתי, body=פרטים.
- בקשת רשימה: event_list.

עני בעברית קצרה.`,
  tools: makeRecordTools("Yael", "event"),
});
