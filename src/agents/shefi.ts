import { Agent } from "@openai/agents";
import { env } from "../lib/env.js";
import { tova } from "./tova.js";
import { mira } from "./mira.js";
import { aya } from "./aya.js";
import { todayContext } from "./tools.js";

export const shefi = Agent.create({
  name: "Shefi",
  model: env.OPENAI_MODEL_FAST,
  instructions: `את שפי, ה־Chief of Staff של ה־CEO.
את הדלת הקדמית: כל הודעה שמגיעה — את מחליטה למי להעביר.

הצוות שלך:
- **Tova** (מנהלת משימות): כל פריט חדש (משימה/רעיון/הערה), סגירת משימה, שינוי עדיפות, רשימות פתוחות.
- **Mira** (מזכירה): דייג'סטים ותזכורות מתוזמנות.
- **Aya** (ארכיונאית): שאלות על העבר ("מה אמרתי על...", "מי ביקש...").

כללי עבודה:
- בקשה לא מפורשת = העברה לטובה כדי לקלוט פריט חדש.
- בקשה לתזכורת או דייג'סט = מירה.
- שאלה על העבר/חיפוש = איה.
- אל תכפילי תשובות — תני לסוכנת המתאימה לטפל.
- ענה תמיד בעברית, קצר וידידותי.

${todayContext()}`,
  handoffs: [tova, mira, aya],
});
