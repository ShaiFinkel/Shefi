import { mkdtempSync, createWriteStream, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Context } from "grammy";
import { transcribeAudio } from "../lib/llm.js";

export async function transcribeTelegramVoice(ctx: Context): Promise<string> {
  const file = await ctx.getFile();
  if (!file.file_path) {
    throw new Error("הקובץ הקולי לא זמין להורדה");
  }

  const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
  const tmpDir = mkdtempSync(join(tmpdir(), "shefi-voice-"));
  const ext = file.file_path.split(".").pop() || "ogg";
  const localPath = join(tmpDir, `voice.${ext}`);

  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`הורדת הקובץ נכשלה: ${res.status}`);
    }
    const writer = createWriteStream(localPath);
    await pipeline(res.body as unknown as NodeJS.ReadableStream, writer);

    const text = await transcribeAudio(localPath);
    return text.trim();
  } finally {
    try {
      unlinkSync(localPath);
      rmdirSync(tmpDir);
    } catch {
      // ignore cleanup errors
    }
  }
}
