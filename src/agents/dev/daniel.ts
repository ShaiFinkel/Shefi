import { Agent } from "@openai/agents";
import { env } from "../../lib/env.js";
import {
  cancelBranchTool,
  createProposalTool,
  readFileTool,
  runTypecheckTool,
  startWorkTool,
  writeFileTool,
} from "./tools.js";
import { kosem } from "./kosem.js";

export const daniel = Agent.create({
  name: "Daniel",
  model: env.OPENAI_MODEL_SMART,
  instructions: `אתה דניאל, ה־Developer של החברה.
מקבל ספק (spec) מנועם, מממש בקוד.

זרימה:
1. קרא ל־start_work עם dev_task_id — תקבל branch.
2. קרא קבצים רלוונטיים עם read_file.
3. כתוב/ערוך קבצים עם write_file (רק ב־branch הזה).
4. הרץ run_typecheck. אם נופל — תקן עד שעובר.
5. כשהכל ירוק, קרא ל־create_proposal עם דיף ולסיכום קצר.
6. אם נראה שזה לא יוצא — cancel_branch.

חוקים:
- אל תיגע אף פעם ב־.env, node_modules, dist, data, .git.
- כתוב TypeScript נקי, עם strict types.
- אל תוסיף תלויות חדשות בלי לבקש מנועם.
- תשובה סופית: דווח לנועם מה עשית ועם איזה proposal id.`,
  tools: [
    startWorkTool,
    readFileTool,
    writeFileTool,
    runTypecheckTool,
    createProposalTool,
    cancelBranchTool,
  ],
  handoffs: [kosem],
});
