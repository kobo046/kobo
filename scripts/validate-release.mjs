import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

async function requireFile(path) {
  try {
    await access(join(root, path));
  } catch (_error) {
    failures.push(`缺少必要檔案：${path}`);
  }
}

const requiredFiles = [
  "index.html",
  "human-ui.css",
  "manifest.webmanifest",
  "supabase-config.js",
  "cloud-storage.js",
  "storage.js",
  "scoring.js",
  "render.js",
  "events.js",
  "app.js",
  "capacitor.config.json",
  "assets/app-icon-1024.png",
  "README.md",
  "README.zh-HK.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "docs/SCORING.md",
  "docs/PROJECT_IMPACT.md"
];

await Promise.all(requiredFiles.map(requireFile));

const markdownFiles = [
  "README.md",
  "README.zh-HK.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "ROADMAP.md",
  "docs/ARCHITECTURE.md",
  "docs/SCORING.md",
  "docs/PROJECT_IMPACT.md"
];

for (const path of markdownFiles) {
  const content = await readFile(join(root, path), "utf8");
  const linkPattern = /\[[^\]]*\]\((?!https?:\/\/|mailto:|#)([^)#]+)(?:#[^)]+)?\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1];
    try {
      await access(join(root, dirname(path), target));
    } catch (_error) {
      failures.push(`Markdown 連結目標不存在：${path} -> ${target}`);
    }
  }
}

try {
  const manifest = JSON.parse(await readFile(join(root, "manifest.webmanifest"), "utf8"));
  if (!manifest.start_url || manifest.display !== "standalone") {
    failures.push("manifest 缺少 start_url 或 standalone 顯示模式。");
  }
} catch (error) {
  failures.push(`manifest 格式錯誤：${error.message}`);
}

const publicFiles = ["index.html", "supabase-config.js", "cloud-storage.js", "storage.js", "events.js"];
const forbiddenSecrets = [
  /\bsb_secret_[A-Za-z0-9_-]+\b/,
  /\bservice_role\b/i,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/
];

for (const path of publicFiles) {
  const content = await readFile(join(root, path), "utf8");
  for (const pattern of forbiddenSecrets) {
    if (pattern.test(content)) failures.push(`公開檔案可能含有秘密憑證：${path}`);
  }
}

if (failures.length) {
  console.error("Release validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Release validation passed: ${requiredFiles.length} required files and public credential checks.`);
}
