import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "ios-web");

const files = [
  "index.html",
  "styles.css",
  "cartoon-court-v10.css",
  "editorial-theme.css",
  "ios-liquid-theme.css",
  "supabase-config.js",
  "auth.js",
  "cloud-storage.js",
  "storage.js",
  "scoring.js",
  "render.js",
  "events.js",
  "app.js",
  "manifest.webmanifest",
  "assets/badminton-doubles-hero.webp"
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const file of files) {
  const destination = join(outDir, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, file), destination);
}

console.log(`iOS web bundle ready: ${outDir}`);
