import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createPlasmonNesDemoRom } from "./src/games/demoNesBundle.ts";
import {
  DEMO_NES_BYTES,
  DEMO_NES_LICENSE_TEXT,
  DEMO_NES_SHA256,
  PACKAGED_DEMO_NES_FILENAME,
} from "./src/games/demoNesContract.ts";

export const PACKAGED_DEMO_NES_LICENSE_FILENAME = "PlasmonNesDemo.LICENSE.txt";

function sriSha256(bytes: Uint8Array): string {
  return `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
}

/** Materialize only Demo-owned game content after the normal package build. */
export async function materializeDemoNesContent(outputRoot = "./dist/web"): Promise<void> {
  const bytes = createPlasmonNesDemoRom();
  if (bytes.byteLength !== DEMO_NES_BYTES) {
    throw new Error(`Plasmon NES Demo size changed: expected ${DEMO_NES_BYTES}, received ${bytes.byteLength}`);
  }
  const digest = sriSha256(bytes);
  if (digest !== DEMO_NES_SHA256) {
    throw new Error(`Plasmon NES Demo digest changed: expected ${DEMO_NES_SHA256}, received ${digest}`);
  }

  const fixturesRoot = `${outputRoot}/fixtures`;
  await mkdir(fixturesRoot, { recursive: true });
  await Promise.all([
    writeFile(`${fixturesRoot}/${PACKAGED_DEMO_NES_FILENAME}`, bytes),
    writeFile(`${fixturesRoot}/${PACKAGED_DEMO_NES_LICENSE_FILENAME}`, DEMO_NES_LICENSE_TEXT, "utf8"),
  ]);
}

if (import.meta.main) await materializeDemoNesContent();
