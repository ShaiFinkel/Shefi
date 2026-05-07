import { Agent } from "@openai/agents";
import { env } from "../../lib/env.js";
import { makeRecordTools } from "./shared-tools.js";

export const shani = new Agent({
  name: "Shani",
  model: env.OPENAI_MODEL_FAST,
  instructions: `את שני, סוכנת הספקים של החברה.
תפקידך: מעקב אחרי כל הספקים — חוזים, חשבוניות, חידושים, תזכורות.