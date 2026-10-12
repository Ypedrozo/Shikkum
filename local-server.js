import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import config from "./api/config.js";
import people from "./api/people.js";
import dashboard from "./api/dashboard.js";
import checkIn from "./api/check-in.js";
import cancel from "./api/cancel.js";
import ticket from "./api/ticket.js";
import qr from "./api/qr.js";
import email from "./api/email.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(root, "public");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const api = new Map([["/api/config", config], ["/api/people", people], ["/api/dashboard", dashboard], ["/api/check-in", checkIn], ["/api/cancel", cancel], ["/api/ticket", ticket], ["/api/qr", qr], ["/api/email", email]]);

if (!process.env.VERCEL) {
  const envFile = resolve(root, ".env.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const handler = api.get(url.pathname);
  if (handler) {
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (value) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(value)); };
    res.send = (value) => res.end(value);
    try { return await handler(req, res); }
    catch (error) { console.error("API request failed:", url.pathname, error.message); res.statusCode = 500; return res.end(JSON.stringify({ error: "Error interno del servidor." })); }
  }
  if (url.pathname.startsWith("/api/")) { res.statusCode = 404; return res.end("Not found"); }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.statusCode = 400; return res.end("Bad request"); }
  if (pathname === "/") pathname = "/index.html";
  const file = resolve(publicRoot, `.${pathname}`);
  if (file !== publicRoot && !file.startsWith(`${publicRoot}${sep}`)) { res.statusCode = 403; return res.end("Forbidden"); }
  try {
    if (!statSync(file).isFile()) throw new Error("not a file");
    res.statusCode = 200;
    res.setHeader("Content-Type", mime[extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", extname(file) === ".html" ? "no-store" : "public, max-age=3600");
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch { res.statusCode = 404; res.end("Not found"); }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => console.log(`Shikkum listo en http://localhost:${port}`));
