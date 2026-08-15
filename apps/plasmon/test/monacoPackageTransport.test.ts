import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const WORKERS = [
  "editor.worker.js",
  "json.worker.js",
  "css.worker.js",
  "html.worker.js",
  "ts.worker.js",
] as const;

for (const worker of WORKERS) {
  test(`#89 Monaco browser transport mirrors canonical Program Files bytes: ${worker}`, async () => {
    const [canonical, transport] = await Promise.all([
      readFile(new URL(`../dist/web/System/Program Files/MonacoEditor/${worker}`, import.meta.url)),
      readFile(new URL(`../dist/web/runtime/monaco/${worker}`, import.meta.url)),
    ]);

    expect(canonical.length).toBeGreaterThan(100);
    expect(transport).toEqual(canonical);
  });
}
