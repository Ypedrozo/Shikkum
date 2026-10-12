import { readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const files = [];
function walk(dir) { for (const item of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, item.name); if (item.isDirectory()) walk(path); else if (path.endsWith(".js")) files.push(path); } }
for (const folder of ["api", "server-lib", "public/js"]) walk(join(root, folder));
files.push(join(root, "local-server.js"));
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) { failed = true; process.stderr.write(`${file}\n${result.stderr}`); }
}
if (failed) process.exit(1);
console.log(`Sintaxis JavaScript correcta: ${files.length} archivos.`);
