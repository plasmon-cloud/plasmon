import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  OPTIONAL_RUNTIME_CATALOG,
  verifyRuntimeArtifactIntegrity,
  type PreparedRuntimeArtifact,
  type ResolvedRuntimeConfiguration,
  type RuntimePreparationReport,
} from "./runtimeConfiguration.ts";

export const EMULATORJS_PROGRAM_FILES_ROOT = "System/Program Files/EmulatorJS";
export const EMULATORJS_BROWSER_ROOT = "runtime/emulatorjs";

const EMULATORJS_SOURCE_BUNDLE_ASSETS = Object.freeze([
  "src/emulator.js",
  "src/nipplejs.js",
  "src/shaders.js",
  "src/storage.js",
  "src/gamepad.js",
  "src/GameManager.js",
  "src/socket.io.min.js",
  "src/compression.js",
]);

export interface EmulatorJsRuntimeMaterializationReport {
  readonly runtimeId: "emulatorjs";
  readonly version: string;
  readonly requiredAssets: readonly string[];
  readonly logicalBytes: number;
  readonly emittedBytes: number;
}

interface TarEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

function readTarString(bytes: Uint8Array, start: number, length: number): string {
  const end = Math.min(bytes.byteLength, start + length);
  let value = "";
  for (let index = start; index < end; index += 1) {
    const byte = bytes[index] ?? 0;
    if (byte === 0) break;
    value += String.fromCharCode(byte);
  }
  return value.trim();
}

function readTarOctal(bytes: Uint8Array, start: number, length: number): number {
  const value = readTarString(bytes, start, length).replaceAll("\0", "").trim();
  if (!value) return 0;
  if (!/^[0-7]+$/u.test(value)) throw new Error(`Malformed tar size field: ${value}`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Tar entry size is outside the supported range");
  return parsed;
}

function normalizeArchivePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => part === "..")) {
    throw new Error(`Unsafe EmulatorJS archive path: ${path}`);
  }
  return normalized.startsWith("package/") ? normalized.slice("package/".length) : normalized;
}

export function extractTarGzEntries(archive: Uint8Array): readonly TarEntry[] {
  const tar = new Uint8Array(gunzipSync(archive));
  const entries: TarEntry[] = [];
  let offset = 0;

  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const path = normalizeArchivePath(prefix ? `${prefix}/${name}` : name);
    const size = readTarOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] ?? 0);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > tar.byteLength) throw new Error(`Truncated EmulatorJS tar entry: ${path}`);

    if (type === "\0" || type === "0" || type === "") {
      entries.push({ path, bytes: tar.slice(contentStart, contentEnd) });
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function assetCandidates(asset: string): readonly string[] {
  const candidates = new Set<string>([asset, `data/${asset}`]);
  if (asset.startsWith("cores/")) candidates.add(asset.slice("cores/".length));
  return [...candidates];
}

function findArchiveAsset(
  archives: readonly (readonly TarEntry[])[],
  asset: string,
): Uint8Array | null {
  const candidates = assetCandidates(asset);
  const matches = archives.flatMap((entries) => entries.filter((entry) =>
    candidates.some((candidate) => entry.path === candidate || entry.path.endsWith(`/${candidate}`))
  ));
  if (matches.length === 0) return null;
  if (matches.length > 1) throw new Error(`Prepared EmulatorJS runtime contains ambiguous required asset ${asset}`);
  const bytes = matches[0]!.bytes;
  if (bytes.byteLength === 0) throw new Error(`Prepared EmulatorJS runtime asset ${asset} is empty`);
  return bytes;
}

function requireArchiveAsset(
  archives: readonly (readonly TarEntry[])[],
  asset: string,
  generatedAsset: string,
): Uint8Array {
  const bytes = findArchiveAsset(archives, asset);
  if (!bytes) {
    throw new Error(`Prepared EmulatorJS runtime cannot derive ${generatedAsset}; missing source asset ${asset}`);
  }
  return bytes;
}

function deriveGeneratedAsset(
  archives: readonly (readonly TarEntry[])[],
  asset: string,
): Uint8Array | null {
  // EmulatorJS 4.2.3 intentionally omits generated minified files from its npm
  // package. Its published source package remains the pinned authority, so emit
  // deterministic package-local equivalents from those verified source bytes.
  if (asset === "emulator.min.js") {
    const separator = Buffer.from("\n;\n", "utf8");
    const parts = EMULATORJS_SOURCE_BUNDLE_ASSETS.map((sourceAsset) =>
      Buffer.from(requireArchiveAsset(archives, sourceAsset, asset))
    );
    return new Uint8Array(Buffer.concat(parts.flatMap((part, index) =>
      index === parts.length - 1 ? [part] : [part, separator]
    )));
  }
  if (asset === "emulator.min.css") {
    return requireArchiveAsset(archives, "emulator.css", asset).slice();
  }
  return null;
}

export function selectRequiredEmulatorJsAssets(
  archives: readonly (readonly TarEntry[])[],
  requiredAssets: readonly string[],
): ReadonlyMap<string, Uint8Array> {
  const selected = new Map<string, Uint8Array>();
  for (const asset of requiredAssets) {
    const bytes = findArchiveAsset(archives, asset) ?? deriveGeneratedAsset(archives, asset);
    if (!bytes) throw new Error(`Prepared EmulatorJS runtime is missing required asset ${asset}`);
    if (bytes.byteLength === 0) throw new Error(`Prepared EmulatorJS runtime asset ${asset} is empty`);
    selected.set(asset, bytes);
  }
  return selected;
}

function preparedArtifact(
  preparation: RuntimePreparationReport,
  artifactId: string,
): PreparedRuntimeArtifact {
  const artifact = preparation.artifacts.find((candidate) =>
    candidate.runtimeId === "emulatorjs" && candidate.artifactId === artifactId
  );
  if (!artifact) throw new Error(`EmulatorJS preparation is missing artifact ${artifactId}`);
  return artifact;
}

export async function materializeEmulatorJsRuntime(
  runtimePolicy: ResolvedRuntimeConfiguration,
  preparation: RuntimePreparationReport,
  outputRoot: string,
): Promise<EmulatorJsRuntimeMaterializationReport> {
  const definition = runtimePolicy.runtimes.find(({ id }) => id === "emulatorjs");
  if (!definition) throw new Error("EmulatorJS runtime is not selected");
  const canonical = OPTIONAL_RUNTIME_CATALOG.emulatorjs;
  if (definition.version !== canonical.version || definition.revision !== canonical.revision) {
    throw new Error("EmulatorJS materializer requires the canonical pinned runtime definition");
  }

  const archiveEntries: TarEntry[][] = [];
  for (const pin of definition.sourceArtifacts) {
    const prepared = preparedArtifact(preparation, pin.id);
    const bytes = new Uint8Array(await readFile(prepared.cachePath));
    verifyRuntimeArtifactIntegrity(bytes, pin);
    if (pin.archive !== "tgz") throw new Error(`Unsupported EmulatorJS archive kind: ${pin.archive}`);
    archiveEntries.push([...extractTarGzEntries(bytes)]);
  }

  const selected = selectRequiredEmulatorJsAssets(archiveEntries, definition.requiredAssets);
  const programRoot = join(outputRoot, EMULATORJS_PROGRAM_FILES_ROOT);
  const browserDataRoot = join(outputRoot, EMULATORJS_BROWSER_ROOT, "data");
  await Promise.all([
    rm(programRoot, { recursive: true, force: true }),
    rm(join(outputRoot, EMULATORJS_BROWSER_ROOT), { recursive: true, force: true }),
  ]);

  let logicalBytes = 0;
  for (const [asset, bytes] of selected) {
    const managed = join(programRoot, "data", asset);
    const browser = join(browserDataRoot, asset);
    await Promise.all([mkdir(dirname(managed), { recursive: true }), mkdir(dirname(browser), { recursive: true })]);
    await Promise.all([writeFile(managed, bytes), writeFile(browser, bytes)]);
    logicalBytes += bytes.byteLength;
  }

  const runtimeMetadata = `${JSON.stringify({
    runtime: "EmulatorJS",
    version: definition.version,
    revision: definition.revision,
    sourceArtifacts: definition.sourceArtifacts.map(({ id, url, integrity }) => ({ id, url, integrity })),
    core: "fceumm",
    resourceType: ".nes",
    browserDataRoot: "runtime/emulatorjs/data/",
  }, null, 2)}\n`;
  await mkdir(programRoot, { recursive: true });
  await writeFile(join(programRoot, "runtime.json"), runtimeMetadata);

  return Object.freeze({
    runtimeId: "emulatorjs",
    version: definition.version,
    requiredAssets: definition.requiredAssets,
    logicalBytes,
    emittedBytes: logicalBytes * 2 + Buffer.byteLength(runtimeMetadata),
  });
}
