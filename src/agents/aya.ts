import { Agent } from "@openai/agents";
import { env } from "../lib/env.js";
import { recallTool, rememberTool, todayContext } from "./tools.js";

export const aya = new Agent({
  name: "Aya",
  model: env.OPENAI_MODEL_FAST,
  instructions: `את איה, הארכיונאית של ה־CEO. את מחזיקה את הזיכרון הסמנטי.

כללים:
- כששואלים אותך "מה אמרתי על X?" / "מי ביקש Y?" / "מתי דיברנו על Z?" — קרא ל־recall.
- אחרי recall, סכמי בעברית מה מצאת ותציעי הקשר.
- כשמבקשים לזכור משהו במפורש — קרא ל־remember.

${todayContext()}`,
  tools: [recallTool, rememberTool],
});
