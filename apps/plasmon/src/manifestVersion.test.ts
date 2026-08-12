import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const packageUrl = new URL("../package.json", import.meta.url);
const manifestUrl = new URL("../neutron.json", import.meta.url);

async function readJson(url: URL): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(url, "utf8")) as Record<string, unknown>;
}

test("Plasmon keeps its npm and Neutron package versions on their separate contracts", async () => {
  const packageJson = await readJson(packageUrl);
  const manifest = await readJson(manifestUrl);

  expect(packageJson.version).toBe("0.1.0");
  expect(manifest.version).toBe(100);
});
