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
  // ===== Public app URL (used in magic-link emails) =====
  // Set to your Cloudflare Tunnel domain in production, e.g. https://shefi.team
  // Falls back to localhost for dev so the magic links remain clickable on the same machine.
  APP_PUBLIC_URL: z.string().default("http://localhost:3000"),
  // ===== Email (Resend) =====
  // If empty, magic links are printed to the server console (dev mode)
  // and a notice is shown in the UI so you can copy them manually.
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("Shefi & Co. <onboarding@resend.dev>"),
  // ===== Admin guard for /api endpoints (CEO dashboard) =====
  // Random string. Stored in browser localStorage so only browsers that you
  // explicitly logged in from your admin device can access management endpoints.
  // Empty = no admin protection (open access). Set ANY value to enable.
  ADMIN_TOKEN: z.string().default(""),
  // ===== Web Push (VAPID) =====
  // Generate once with `npx web-push generate-vapid-keys` and paste here.
  // If empty, push notifications are silently disabled.
  VAPID_PUBLIC_KEY: z.string().default(""),
  VAPID_PRIVATE_KEY: z.string().default(""),
  VAPID_SUBJECT: z.string().default("mailto:shai@example.com"),
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
