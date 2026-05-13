#!/usr/bin/env node
// Generates all PWA icons (favicons, apple-touch, maskable) from icon.svg.
// Run: npm run icons (added to frontend/package.json)

import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(here, "../public");

const sourceSvg = await readFile(resolve(PUBLIC, "icon.svg"));

const targets = [
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-64.png", size: 64 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "pwa-192.png", size: 192 },
  { name: "pwa-512.png", size: 512 },
];

await mkdir(PUBLIC, { recursive: true });

for (const t of targets) {
  const out = resolve(PUBLIC, t.name);
  await sharp(sourceSvg).resize(t.size, t.size).png().toFile(out);
  console.log(`✓ ${t.name} (${t.size}x${t.size})`);
}

// Maskable icon: same image but with extra padding so iOS/Android can
// crop into a circle without cutting off the "ש".
const maskable = resolve(PUBLIC, "pwa-maskable-512.png");
const padded = await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 124, g: 92, b: 255, alpha: 1 },
  },
})
  .composite([{ input: await sharp(sourceSvg).resize(360, 360).png().toBuffer() }])
  .png()
  .toBuffer();
await writeFile(maskable, padded);
console.log(`✓ pwa-maskable-512.png (with safe area)`);

console.log("\nAll icons generated in frontend/public/.");
