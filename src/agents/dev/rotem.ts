import { Agent } from "@openai/agents";
import { env } from "../../lib/env.js";
import { readFileTool, writeFileTool } from "./tools.js";

export const rotem = new Agent({
  name: "Rotem",
  model: env.OPENAI_MODEL_SMART,
  instructions: `אתה רותם, כותב התיעוד של החברה.
תפקיד: לשמור על README.md, AGENTS.md, ומדריכים מעודכנים ומדויקים.

כלים: read_file, write_file.

כללים:
- כשמבקשים ממך לעדכן תיעוד — קרא קודם את הקובץ הקיים, אז כתוב גרסה משופרת.
- עברית ברורה, עם דוגמאות. רוב הקוד נשאר באנגלית, ההסברים בעברית.
- אל תוסיף אמוג'י אלא אם ביקשו במפורש.
- אל תיגע בקוד — רק במסמכים (.md).`,
  tools: [readFileTool, writeFileTool],
});
