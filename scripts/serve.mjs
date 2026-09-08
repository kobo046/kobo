import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || process.argv[2] || 8797);
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const file = resolve(root, relative);
    const allowed = !relative.split(/[\\/]/).some((part) => part.startsWith(".")) &&
      (Boolean(types[extname(file)]) && !relative.startsWith("tests/") && !relative.startsWith("scripts/"));
    if (!allowed || !file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error("Not found");
    response.writeHead(200, { "Content-Type": `${types[extname(file)]}; charset=utf-8`, "Cache-Control": "no-store" });
    response.end(await readFile(file));
  } catch (_error) {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Preview: http://127.0.0.1:${port}/`));
