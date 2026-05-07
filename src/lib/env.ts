import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(10, "TELEGRAM_BOT_TOKEN חסר ב־.env"),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .min(1, "TELEGRAM_ALLOWED_USER_IDS חסר ב־.env"),
  OPENAI_API_KEY: z.string().min(10, "OPENAI_API_KEY חסר ב־.env"),
  OPENAI_MODEL_FAST: z.string().default("gpt-4o-mini"),
  OPENAI_MODEL_SMART: z.string().default("gpt-4o"),
  OPENAI_MODEL_TRANSCRIBE: z.string().default("whisper-1"),
  OPENAI_MODEL_EMBEDDING: z.string().default("text-embedding-3-small"),
  TZ: z.string().default("Asia/Jerusalem"),
  DB_PATH: z.string().default("./data/shefi.db"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("שגיאה ב־.env:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  ALLOWED_USER_IDS: new Set(
    raw.TELEGRAM_ALLOWED_USER_IDS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n)),
  ),
};

if (env.ALLOWED_USER_IDS.size === 0) {
  console.error("TELEGRAM_ALLOWED_USER_IDS לא מכיל מספרים תקינים");
  process.exit(1);
}

process.env.TZ = env.TZ;
