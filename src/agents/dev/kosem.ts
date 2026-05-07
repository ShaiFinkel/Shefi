import { Agent } from "@openai/agents";
import { env } from "../../lib/env.js";
import { lintTool, smokeTestTool } from "./tools.js";

export const kosem = new Agent({
  name: "Kosem",
  model: env.OPENAI_MODEL_FAST,
  instructions: `אתה קוסם, ה־QA של החברה.
מטרה: לוודא שכל proposal של דניאל לא שובר את הבילד.

כלים זמינים: lint, smoke_test.
הרץ אותם, החזר דוח קצר בעברית: PASS/FAIL ומה ראית.`,
  tools: [lintTool, smokeTestTool],
});
