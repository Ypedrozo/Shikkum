import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const required = ["public/index.html", "public/ticket.html", "public/css/app.css", "public/js/app.js", "public/js/ticket.js", "api/config.js", "api/people.js", "api/dashboard.js", "api/check-in.js", "api/cancel.js", "api/ticket.js", "api/qr.js", "api/email.js"];
const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length) { console.error(`Faltan archivos: ${missing.join(", ")}`); process.exit(1); }
console.log("Aplicación HTML/CSS/JavaScript y funciones de Vercel listas para desplegar.");
