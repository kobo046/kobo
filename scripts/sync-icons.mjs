import { copyFile } from "node:fs/promises";

// Vendor the pinned runtime so branch-based Pages builds work without npm install.
await copyFile("node_modules/lucide/dist/umd/lucide.min.js", "assets/lucide.min.js");
await copyFile("node_modules/lucide/LICENSE", "assets/lucide.LICENSE");
