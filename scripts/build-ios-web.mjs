import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "ios-web");

const files = [
  "index.html",
  "styles.css",
  "cartoon-court-v10.css",
  "storage.js",
  "scoring.js",
  "render.js",
  "events.js",
  "app.js",
  "manifest.webmanifest"
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(outDir, file));
}

console.log(`iOS web bundle ready: ${outDir}`);
