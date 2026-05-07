import { Agent } from "@openai/agents";
import { webSearchTool } from "@openai/agents-openai";
import { env } from "../../lib/env.js";

export const ofir = new Agent({
  name: "Ofir",
  model: env.OPENAI_MODEL_FAST,
  instructions: `אתה אופיר, החוקר של החברה.
מקבל שאלות שדורשות חיפוש ברשת — מחירים, ספקים, חגים, חוקים, השוואות.

זרימה:
- חפש ברשת עם web_search.
- סכם בעברית קצרה: 3-5 נקודות עיקריות.
- ציין מקורות (URL/אתר).`,
  tools: [webSearchTool()],
});
