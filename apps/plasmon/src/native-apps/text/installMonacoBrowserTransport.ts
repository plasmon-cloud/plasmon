import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const WORKERS = [
  "editor.worker.js",
  "json.worker.js",
  "css.worker.js",
  "html.worker.js",
  "ts.worker.js",
] as const;

const canonicalRoot = "./dist/web/System/Program Files/MonacoEditor";
const transportRoot = "./dist/web/runtime/monaco";

await rm(transportRoot, { recursive: true, force: true });
await mkdir(transportRoot, { recursive: true });

for (const worker of WORKERS) {
  const canonicalPath = join(canonicalRoot, worker);
  const transportPath = join(transportRoot, worker);
  await copyFile(canonicalPath, transportPath);

  const [canonical, transport] = await Promise.all([
    readFile(canonicalPath),
    readFile(transportPath),
  ]);
  if (!canonical.equals(transport)) {
    throw new Error(`Monaco browser transport diverged from Program Files authority: ${worker}`);
  }
}
