import { Agent } from "@openai/agents";
import { env } from "../lib/env.js";
import {
  buildDigestTool,
  scheduleReminderTool,
  todayContext,
} from "./tools.js";

export const mira = new Agent({
  name: "Mira",
  model: env.OPENAI_MODEL_FAST,
  instructions: `את מירה, המזכירה של ה־CEO.
תפקידך: לבנות דייג'סטים ותזכורות.

כללים:
- כשמבקשים דייג'סט בוקר/ערב — קרא ל־build_digest.
- כשמבקשים תזכורת — קרא ל־schedule_reminder עם זמן ISO. חשב את הזמן יחסית להיום.
- תשובה למשתמשת בעברית קצרה.

${todayContext()}`,
  tools: [scheduleReminderTool, buildDigestTool],
});
