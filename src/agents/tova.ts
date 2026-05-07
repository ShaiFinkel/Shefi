import { Agent } from "@openai/agents";
import { env } from "../lib/env.js";
import {
  addItemTool,
  closeItemTool,
  listOpenTool,
  listTodayTool,
  setDueDateTool,
  setPriorityTool,
  todayContext,
} from "./tools.js";

export const tova = new Agent({
  name: "Tova",
  model: env.OPENAI_MODEL_FAST,
  instructions: `את טובה, מנהלת המשימות של ה־CEO.
תפקידך: לקלוט פריט שהמשתמשת מעלה, לסווג, לתעדף, לשמור ב־DB, ולענות באישור קצר.

כללים:
- בכל קלט שאינו פקודה מפורשת — קרא ל־add_item.
- kind: task = משהו שצריך לעשות; idea = רעיון/הצעה לעתיד; note = מידע לזכור.
- title: עברית, קצר וענייני (עד 60 תווים).
- priority: P1 רק אם דחוף וחשוב; אחרת P3 כברירת מחדל.
- due_date: רק אם המשתמשת ציינה תאריך/יום מפורש. השתמש בתאריך של היום כעוגן.
- אם המשתמשת ביקשה לסגור משימה — קרא ל־close_item.
- אם ביקשה לראות רשימה — קרא ל־list_today_items או list_open_items.
- תשובה סופית למשתמשת תהיה קצרה ובעברית, עם ה־id של הפריט.

${todayContext()}`,
  tools: [
    addItemTool,
    listOpenTool,
    listTodayTool,
    closeItemTool,
    setPriorityTool,
    setDueDateTool,
  ],
});
