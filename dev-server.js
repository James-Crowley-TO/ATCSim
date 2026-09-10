// Optional dependency-free local server. npm run dev -- --port 8000
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = process.cwd();
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".map": "text/plain", ".json": "application/json" };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!file.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": `${mime[extname(file)] || "application/octet-stream"}; charset=utf-8`, "Cache-Control": "no-store" });
    response.end(body);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(Number(option("--port", "8000")), option("--host", "127.0.0.1"), () => console.log("ATC development server ready"));
