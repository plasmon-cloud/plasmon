import { readFile, readdir, stat } from "node:fs/promises";
import { packageArchiveFilename } from "neutron-tools/src/package_archive.js";
import type { NeutronManifest } from "neutron-tools/src/schema.js";
import { resolvePackageProfile } from "./packageProfilePolicy.ts";

export const HACKATHON_MAX_BYTES = 1_900_000;

const appDirectoryUrl = new URL("./", import.meta.url);
const distWebUrl = new URL("./dist/web/", import.meta.url);
const manifestUrl = new URL("./neutron.json", import.meta.url);
const mainBundleUrl = new URL("./dist/web/main.js", import.meta.url);

const REQUIRED_WORKER_PATHS = [
  "System/Program Files/MonacoEditor/editor.worker.js",
  "runtime/monaco/editor.worker.js",
  "runtime/monaco/worker-sources.js",
] as const;

const FORBIDDEN_WORKERS = [
  "json.worker.js",
  "css.worker.js",
  "html.worker.js",
  "ts.worker.js",
] as const;

const FORBIDDEN_RUNTIME_ROOTS = [
  "module/emulatorjs/",
  "module/emulatorjs-shim/",
  "module/emulatorjs-runtime/",
  "module/native-apps/games/game-libraries/",
  "module/native-apps/games/game-runtime/",
  "System/Program Files/js-dos/",
  "System/Program Files/EmulatorJS/",
  "runtime/jsdos/",
  "runtime/emulatorjs/",
] as const;

const FORBIDDEN_GAME_EXTENSIONS = [".jsdos", ".dosz", ".nes", ".rom"] as const;
const FORBIDDEN_DEMO_LITERALS = ["Demo Notes.txt", "Demo Guide.md", "Demo Artwork.svg"] as const;

function fail(message: string): never {
  throw new Error(`Hackathon package gate failed: ${message}`);
}

export async function verifyHackathonPackage(): Promise<{ archive: string; bytes: number }> {
  const policy = resolvePackageProfile();
  if (policy.requestedProfile !== "hackathon" || !policy.isHackathon) {
    fail(`expected explicit PLASMON_PACKAGE_PROFILE=hackathon, got ${policy.requestedProfile}`);
  }

  const manifest = JSON.parse(await readFile(manifestUrl, "utf8")) as NeutronManifest;
  const archive = packageArchiveFilename(manifest.id, manifest.version);
  const archiveStats = await stat(new URL(archive, appDirectoryUrl));
  if (archiveStats.size >= HACKATHON_MAX_BYTES) {
    fail(`${archive} is ${archiveStats.size} bytes; limit is strictly less than ${HACKATHON_MAX_BYTES}`);
  }

  const files = (await readdir(distWebUrl, { recursive: true }))
    .map((file) => file.replaceAll("\\", "/"));
  const fileSet = new Set(files);

  for (const required of REQUIRED_WORKER_PATHS) {
    if (!fileSet.has(required)) fail(`missing required Monaco transport member ${required}`);
    const member = await stat(new URL(required, distWebUrl));
    if (member.size === 0) fail(`required Monaco transport member is empty: ${required}`);
  }

  for (const worker of FORBIDDEN_WORKERS) {
    const matches = files.filter((file) =>
      file === `System/Program Files/MonacoEditor/${worker}`
      || file === `runtime/monaco/${worker}`
    );
    if (matches.length > 0) fail(`forbidden dedicated Monaco worker present: ${matches.join(", ")}`);
  }

  for (const root of FORBIDDEN_RUNTIME_ROOTS) {
    const matches = files.filter((file) => file === root.slice(0, -1) || file.startsWith(root));
    if (matches.length > 0) fail(`heavyweight runtime root present: ${root}`);
  }

  const gamePayloads = files.filter((file) =>
    FORBIDDEN_GAME_EXTENSIONS.some((extension) => file.toLowerCase().endsWith(extension))
    || file.startsWith("Games/")
    || file.startsWith("fixtures/")
  );
  if (gamePayloads.length > 0) fail(`game/demo payloads present: ${gamePayloads.join(", ")}`);

  const mainBundle = await readFile(mainBundleUrl, "utf8");
  const demoLiterals = FORBIDDEN_DEMO_LITERALS.filter((literal) => mainBundle.includes(literal));
  if (demoLiterals.length > 0) {
    fail(`ordinary demo seed content leaked into Hackathon bundle: ${demoLiterals.join(", ")}`);
  }

  console.log(`Hackathon package: ${archive}`);
  console.log(`Hackathon package size: ${archiveStats.size} bytes (< ${HACKATHON_MAX_BYTES})`);
  console.log(`Hackathon package inventory: ${files.length} dist/web entries verified`);
  return { archive, bytes: archiveStats.size };
}

if (import.meta.main) {
  await verifyHackathonPackage();
}
