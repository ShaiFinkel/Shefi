import OpenAI from "openai";
import { env } from "./env.js";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function transcribeAudio(filePath: string): Promise<string> {
  const fs = await import("node:fs");
  const file = fs.createReadStream(filePath);
  const result = await openai.audio.transcriptions.create({
    file,
    model: env.OPENAI_MODEL_TRANSCRIBE,
  });
  return result.text;
}

export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: env.OPENAI_MODEL_EMBEDDING,
    input: text,
  });
  return response.data[0]!.embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
