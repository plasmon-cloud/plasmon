import { inflateRawSync } from "node:zlib";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  OPTIONAL_RUNTIME_CATALOG,
  verifyRuntimeArtifactIntegrity,
  type ResolvedRuntimeConfiguration,
  type RuntimePreparationReport,
} from "./runtimeConfiguration.ts";

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_MAX_COMMENT_BYTES = 0xffff;

interface ZipEntry {
  readonly name: string;
  readonly flags: number;
  readonly compression: number;
  readonly compressedBytes: number;
  readonly uncompressedBytes: number;
  readonly localHeaderOffset: number;
}

export interface JsDosMaterializationReport {
  readonly runtimeId: "js-dos";
  readonly runtimeVersion: string;
  readonly sourceArtifact: string;
  readonly managedRoot: string;
  readonly browserRoot: string;
  readonly assets: readonly string[];
  readonly logicalBytes: number;
  readonly emittedBytes: number;
}

function asBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - ZIP_MAX_COMMENT_BYTES - 22);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new Error("Prepared js-dos release is not a supported ZIP archive");
}

function readCentralDirectory(buffer: Buffer): readonly ZipEntry[] {
  const end = findEndOfCentralDirectory(buffer);
  const disk = buffer.readUInt16LE(end + 4);
  const centralDisk = buffer.readUInt16LE(end + 6);
  const entriesOnDisk = buffer.readUInt16LE(end + 8);
  const totalEntries = buffer.readUInt16LE(end + 10);
  const centralBytes = buffer.readUInt32LE(end + 12);
  const centralOffset = buffer.readUInt32LE(end + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error("Prepared js-dos release uses unsupported multi-disk ZIP layout");
  }
  if (totalEntries === 0xffff || centralBytes === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("Prepared js-dos release uses unsupported ZIP64 metadata");
  }
  if (centralOffset + centralBytes > buffer.length) {
    throw new Error("Prepared js-dos release has an invalid central directory");
  }

  const entries: ZipEntry[] = [];
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
      throw new Error("Prepared js-dos release has a malformed central directory entry");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedBytes = buffer.readUInt32LE(offset + 20);
    const uncompressedBytes = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > buffer.length) throw new Error("Prepared js-dos release has a truncated central directory entry");
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.push(Object.freeze({
      name,
      flags,
      compression,
      compressedBytes,
      uncompressedBytes,
      localHeaderOffset,
    }));
    offset = next;
  }
  return Object.freeze(entries);
}

function validateRelativeAssetPath(path: string): void {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
    throw new Error(`Invalid js-dos required asset path: ${path}`);
  }
}

function extractZipEntry(buffer: Buffer, entry: ZipEntry): Uint8Array {
  if ((entry.flags & 0x1) !== 0) throw new Error(`Encrypted js-dos ZIP entry is unsupported: ${entry.name}`);
  const offset = entry.localHeaderOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_LOCAL_FILE_HEADER) {
    throw new Error(`Prepared js-dos release has an invalid local header for ${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataOffset = offset + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedBytes;
  if (dataEnd > buffer.length) throw new Error(`Prepared js-dos release has truncated data for ${entry.name}`);
  const compressed = buffer.subarray(dataOffset, dataEnd);

  let output: Buffer;
  if (entry.compression === 0) {
    output = Buffer.from(compressed);
  } else if (entry.compression === 8) {
    output = inflateRawSync(compressed);
  } else {
    throw new Error(`Unsupported ZIP compression ${entry.compression} for js-dos asset ${entry.name}`);
  }
  if (output.byteLength !== entry.uncompressedBytes) {
    throw new Error(`Prepared js-dos asset ${entry.name} has an unexpected uncompressed size`);
  }
  return new Uint8Array(output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength));
}

export function extractRequiredZipEntries(
  archiveBytes: Uint8Array,
  requiredAssets: readonly string[],
): ReadonlyMap<string, Uint8Array> {
  const buffer = asBuffer(archiveBytes);
  const entries = readCentralDirectory(buffer);
  const byName = new Map(entries.map((entry) => [entry.name.replace(/^\.\//, ""), entry] as const));
  const result = new Map<string, Uint8Array>();
  for (const asset of requiredAssets) {
    validateRelativeAssetPath(asset);
    // The pinned js-dos release packages its browser files below `dist/`,
    // while the materialized runtime exposes the catalog's logical paths.
    const entry = byName.get(asset) ?? byName.get(`dist/${asset}`);
    if (!entry || entry.name.endsWith("/")) {
      throw new Error(`Prepared js-dos release is missing required asset ${asset}`);
    }
    result.set(asset, extractZipEntry(buffer, entry));
  }
  return result;
}

export async function materializeJsDosRuntime(
  resolved: ResolvedRuntimeConfiguration,
  preparation: RuntimePreparationReport,
  outputRoot: string,
): Promise<JsDosMaterializationReport | null> {
  const runtime = resolved.runtimes.find(({ id }) => id === "js-dos");
  if (!runtime) return null;
  const canonical = OPTIONAL_RUNTIME_CATALOG["js-dos"];
  if (runtime.version !== canonical.version
    || runtime.revision !== canonical.revision
    || runtime.sourceArtifacts[0]?.integrity !== canonical.sourceArtifacts[0]?.integrity) {
    throw new Error("Selected js-dos runtime does not match canonical runtime authority");
  }
  if (runtime.sourceArtifacts.length !== 1 || runtime.sourceArtifacts[0]?.archive !== "zip") {
    throw new Error("js-dos runtime consumer requires exactly one pinned ZIP source artifact");
  }
  const pin = runtime.sourceArtifacts[0];
  const prepared = preparation.artifacts.filter(({ runtimeId }) => runtimeId === "js-dos");
  if (prepared.length !== 1 || prepared[0]?.artifactId !== pin.id || prepared[0]?.integrity !== pin.integrity) {
    throw new Error("js-dos preparation report does not contain the canonical pinned release artifact");
  }

  const archiveBytes = new Uint8Array(await readFile(prepared[0].cachePath));
  verifyRuntimeArtifactIntegrity(archiveBytes, pin);
  const extracted = extractRequiredZipEntries(archiveBytes, runtime.requiredAssets);
  const root = resolve(outputRoot);
  const managedRoot = join(root, "System", "Program Files", "js-dos");
  const browserRoot = join(root, "runtime", "jsdos");
  await Promise.all([
    rm(managedRoot, { recursive: true, force: true }),
    rm(browserRoot, { recursive: true, force: true }),
  ]);

  let logicalBytes = 0;
  for (const [asset, bytes] of extracted) {
    logicalBytes += bytes.byteLength;
    for (const destinationRoot of [managedRoot, browserRoot]) {
      const destination = join(destinationRoot, ...asset.split("/"));
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
  }

  return Object.freeze({
    runtimeId: "js-dos",
    runtimeVersion: runtime.version,
    sourceArtifact: pin.id,
    managedRoot,
    browserRoot,
    assets: Object.freeze(runtime.requiredAssets.slice()),
    logicalBytes,
    emittedBytes: logicalBytes * 2,
  });
}
