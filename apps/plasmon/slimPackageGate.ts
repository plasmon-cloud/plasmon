import { readFile, readdir, stat } from "node:fs/promises";
import { packageArchiveFilename } from "neutron-tools/src/package_archive.js";
import type { NeutronManifest } from "neutron-tools/src/schema.js";
import { resolvePackageProfile } from "./packageProfilePolicy.ts";

export const SLIM_MAX_BYTES = 1_900_000;

const appDirectoryUrl = new URL("./", import.meta.url);
const distRootUrl = new URL("./dist/", import.meta.url);
const distWebUrl = new URL("./dist/web/", import.meta.url);
const manifestUrl = new URL("./neutron.json", import.meta.url);
const mainBundleUrl = new URL("./dist/web/main.js", import.meta.url);

const REQUIRED_WORKER_PATHS = [
  "System/Program Files/MonacoEditor/editor.worker.js",
  "runtime/monaco/worker-sources.js",
] as const;
const REDUNDANT_SLIM_WORKER_MIRROR = "runtime/monaco/editor.worker.js";

const FORBIDDEN_WORKERS = [
  "json.worker.js",
  "css.worker.js",
  "html.worker.js",
  "ts.worker.js",
] as const;

const FORBIDDEN_ARCHIVE_ROOTS = [
  "module/emulatorjs/",
  "module/emulatorjs-shim/",
  "module/emulatorjs-runtime/",
  "module/native-apps/games/game-libraries/",
  "module/native-apps/games/game-runtime/",
  "web/System/Program Files/js-dos/",
  "web/System/Program Files/EmulatorJS/",
  "web/runtime/jsdos/",
  "web/runtime/emulatorjs/",
] as const;

const FORBIDDEN_GAME_EXTENSIONS = [".jsdos", ".dosz", ".nes", ".rom"] as const;

// File names remain in shared demo helper source even when demo activation is
// compiled off. These markers come from the actual repository-owned payloads,
// so their absence proves the demo file bytes were not embedded in Slim.
export const DEMO_PAYLOAD_MARKERS = [
  "These files are repository-owned demo content installed only by plasmon:demo.",
  "All content in this file is authored in the Plasmon repository and is safe to redistribute with the demo package.",
  "Abstract vector artwork with glowing orbital rings around a central Plasmon mark.",
] as const;

function fail(message: string): never {
  throw new Error(`Slim package gate failed: ${message}`);
}

export async function verifySlimPackage(): Promise<{ archive: string; bytes: number }> {
  const policy = resolvePackageProfile();
  if (policy.requestedProfile !== "slim" || !policy.isSlim || policy.isDemo) {
    fail(`expected explicit non-demo PLASMON_PACKAGE_PROFILE=slim, got ${policy.requestedProfile}`);
  }

  const manifest = JSON.parse(await readFile(manifestUrl, "utf8")) as NeutronManifest;
  const archive = packageArchiveFilename(manifest.id, manifest.version);
  const archiveStats = await stat(new URL(archive, appDirectoryUrl));
  if (archiveStats.size >= SLIM_MAX_BYTES) {
    fail(`${archive} is ${archiveStats.size} bytes; limit is strictly less than ${SLIM_MAX_BYTES}`);
  }

  // pack.ts archives the complete dist/ tree, so exclusions are checked against
  // that exact input boundary rather than only against browser-facing dist/web.
  const archiveFiles = (await readdir(distRootUrl, { recursive: true }))
    .map((file) => file.replaceAll("\\", "/"));
  const webFiles = (await readdir(distWebUrl, { recursive: true }))
    .map((file) => file.replaceAll("\\", "/"));
  const webFileSet = new Set(webFiles);

  for (const required of REQUIRED_WORKER_PATHS) {
    if (!webFileSet.has(required)) fail(`missing required Monaco transport member ${required}`);
    const member = await stat(new URL(required, distWebUrl));
    if (member.size === 0) fail(`required Monaco transport member is empty: ${required}`);
  }

  if (webFileSet.has(REDUNDANT_SLIM_WORKER_MIRROR)) {
    fail(`redundant Slim Monaco worker mirror present: ${REDUNDANT_SLIM_WORKER_MIRROR}`);
  }

  for (const worker of FORBIDDEN_WORKERS) {
    const matches = webFiles.filter((file) =>
      file === `System/Program Files/MonacoEditor/${worker}`
      || file === `runtime/monaco/${worker}`
    );
    if (matches.length > 0) fail(`forbidden dedicated Monaco worker present: ${matches.join(", ")}`);
  }

  for (const root of FORBIDDEN_ARCHIVE_ROOTS) {
    const matches = archiveFiles.filter((file) => file === root.slice(0, -1) || file.startsWith(root));
    if (matches.length > 0) fail(`heavyweight runtime root present: ${root}`);
  }

  const gamePayloads = archiveFiles.filter((file) =>
    FORBIDDEN_GAME_EXTENSIONS.some((extension) => file.toLowerCase().endsWith(extension))
    || file.startsWith("web/Games/")
    || file.startsWith("web/fixtures/")
  );
  if (gamePayloads.length > 0) fail(`game/demo payloads present: ${gamePayloads.join(", ")}`);

  const mainBundle = await readFile(mainBundleUrl, "utf8");
  const embeddedDemoPayloads = DEMO_PAYLOAD_MARKERS.filter((marker) => mainBundle.includes(marker));
  if (embeddedDemoPayloads.length > 0) {
    fail(`ordinary demo payload bytes leaked into Slim bundle (${embeddedDemoPayloads.length} marker(s))`);
  }

  console.log(`Slim package: ${archive}`);
  console.log(`Slim package size: ${archiveStats.size} bytes (< ${SLIM_MAX_BYTES})`);
  console.log(`Slim package inventory: ${archiveFiles.length} dist entries verified`);
  return { archive, bytes: archiveStats.size };
}

if (import.meta.main) {
  await verifySlimPackage();
}
