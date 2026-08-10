import type { AtomDescriptor, JsonValue } from "../contracts/index.ts";
import { validateAtomDescriptor } from "./atom.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;
const DEFAULT_MAX_UNCOMPRESSED = 512 * 1024 * 1024;

export interface AtomPackageHandler {
  id: string;
  appId?: string;
  minVersion?: number;
  packageUrl?: string | null;
}

export interface AtomPackageInput {
  descriptor: AtomDescriptor;
  payload: Uint8Array;
  payloadEntry?: string;
  mediaType?: string;
  handler?: Omit<AtomPackageHandler, "id">;
  files?: Readonly<Record<string, Uint8Array>>;
}

export interface ParsedAtomPackage {
  descriptor: AtomDescriptor;
  handler: AtomPackageHandler;
  payloadEntry: string;
  payload: Uint8Array;
  mediaType?: string;
  files: ReadonlyMap<string, Uint8Array>;
}

export type AtomPackageErrorCode =
  | "not_zip" | "malformed_zip" | "unsupported_zip" | "unsafe_path" | "missing_manifest"
  | "malformed_manifest" | "missing_payload" | "integrity_error" | "too_large";
export interface AtomPackageError { code: AtomPackageErrorCode; message: string; }
export type AtomPackageParseResult = { ok: true; package: ParsedAtomPackage } | { ok: false; error: AtomPackageError };

function fail(code: AtomPackageErrorCode, message: string): AtomPackageParseResult {
  return { ok: false, error: { code, message } };
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function u16(value: number): Uint8Array {
  const out = new Uint8Array(2); new DataView(out.buffer).setUint16(0, value, true); return out;
}
function u32(value: number): Uint8Array {
  const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value >>> 0, true); return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function safeEntryName(name: string): boolean {
  if (!name || name.startsWith("/") || name.startsWith("\\") || name.includes("\\") || name.includes("\0")) return false;
  return !name.split("/").some((part) => part === ".." || part === "");
}

function safeZipEntryName(name: string): boolean {
  const fileName = name.endsWith("/") ? name.slice(0, -1) : name;
  return safeEntryName(fileName);
}

function assertSafeEntryName(name: string): void {
  if (!safeEntryName(name)) throw new Error(`Unsafe Atom package entry: ${name}`);
}

interface ZipEntry { name: string; bytes: Uint8Array; }

function writeStoreZip(entries: readonly ZipEntry[]): Uint8Array {
  if (entries.length > 0xffff) throw new Error("Atom package has too many ZIP entries");
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    assertSafeEntryName(entry.name);
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const local = concat([
      u32(ZIP_LOCAL), u16(20), u16(UTF8_FLAG), u16(0), u16(0), u16(0x0021),
      u32(crc), u32(entry.bytes.length), u32(entry.bytes.length), u16(name.length), u16(0), name, entry.bytes,
    ]);
    locals.push(local);
    centrals.push(concat([
      u32(ZIP_CENTRAL), u16(20), u16(20), u16(UTF8_FLAG), u16(0), u16(0), u16(0x0021),
      u32(crc), u32(entry.bytes.length), u32(entry.bytes.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(localOffset), name,
    ]));
    localOffset += local.length;
  }
  const central = concat(centrals);
  const eocd = concat([
    u32(ZIP_EOCD), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(localOffset), u16(0),
  ]);
  return concat([...locals, central, eocd]);
}

function descriptorMetadata(descriptor: AtomDescriptor): Record<string, JsonValue> | undefined {
  return descriptor.metadata === undefined ? undefined : descriptor.metadata;
}

export function createAtomPackage(input: AtomPackageInput): Uint8Array {
  const checked = validateAtomDescriptor(input.descriptor);
  if (!checked.ok) throw new Error(checked.error.message);
  const payloadEntry = input.payloadEntry ?? "payload.bin";
  assertSafeEntryName(payloadEntry);
  if (payloadEntry === "atom.json") throw new Error("Atom payload entry cannot be atom.json");

  const handler: Record<string, JsonValue> = { id: input.descriptor.handlerId };
  if (input.handler?.appId !== undefined) handler.appId = input.handler.appId;
  if (input.handler?.minVersion !== undefined) handler.minVersion = input.handler.minVersion;
  if (input.handler?.packageUrl !== undefined) handler.packageUrl = input.handler.packageUrl;
  const payload: Record<string, JsonValue> = { entry: payloadEntry };
  if (input.mediaType !== undefined) payload.mediaType = input.mediaType;
  const manifest: Record<string, JsonValue> = {
    format: "plasmon.atom", version: 1, atomId: input.descriptor.atomId, handler,
    atomType: input.descriptor.atomType, schemaVersion: input.descriptor.schemaVersion, payload,
  };
  if (input.descriptor.title !== undefined) manifest.title = input.descriptor.title;
  if (input.descriptor.sourceNodeId !== undefined) manifest.sourceNodeId = input.descriptor.sourceNodeId;
  const metadata = descriptorMetadata(input.descriptor);
  if (metadata !== undefined) manifest.metadata = metadata;

  const entries: ZipEntry[] = [
    { name: "atom.json", bytes: encoder.encode(JSON.stringify(manifest)) },
    { name: payloadEntry, bytes: input.payload },
  ];
  if (input.files) {
    for (const name of Object.keys(input.files).sort((a, b) => a.localeCompare(b))) {
      if (name === "atom.json" || name === payloadEntry) throw new Error(`Duplicate Atom package entry: ${name}`);
      const bytes = input.files[name];
      if (bytes === undefined) continue;
      entries.push({ name, bytes });
    }
  }
  return writeStoreZip(entries);
}

function readU16(view: DataView, offset: number): number { return view.getUint16(offset, true); }
function readU32(view: DataView, offset: number): number { return view.getUint32(offset, true); }

class ZipSizeLimitError extends Error {
  constructor() {
    super("Decompressed ZIP entry exceeds the configured size limit");
    this.name = "ZipSizeLimitError";
  }
}

async function inflateRaw(bytes: Uint8Array, maxOutputBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("Deflate decompression is unavailable");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      if (value.byteLength > maxOutputBytes - total) {
        try { await reader.cancel("Atom package decompression limit exceeded"); } catch { /* cancellation is best effort */ }
        throw new ZipSizeLimitError();
      }
      total += value.byteLength;
      chunks.push(value.slice());
    }
  } finally {
    reader.releaseLock();
  }
  return concat(chunks);
}

async function readZip(bytes: Uint8Array, maxUncompressedBytes: number): Promise<AtomPackageParseResult | Map<string, Uint8Array>> {
  if (bytes.length < 22) return fail("not_zip", "Atom package is too small to be a ZIP archive");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const min = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (readU32(view, offset) === ZIP_EOCD) { eocd = offset; break; }
  }
  if (eocd < 0) return fail("not_zip", "ZIP end-of-central-directory record was not found");
  if (readU16(view, eocd + 4) !== 0 || readU16(view, eocd + 6) !== 0) return fail("unsupported_zip", "Multi-disk Atom packages are not supported");
  const count = readU16(view, eocd + 10);
  if (readU16(view, eocd + 8) !== count) return fail("malformed_zip", "ZIP entry counts do not agree");
  const centralSize = readU32(view, eocd + 12);
  const centralOffset = readU32(view, eocd + 16);
  if (centralOffset + centralSize > eocd) return fail("malformed_zip", "ZIP central directory is out of bounds");

  const result = new Map<string, Uint8Array>();
  const seenNames = new Set<string>();
  let offset = centralOffset;
  let declaredTotalUncompressed = 0;
  let actualTotalUncompressed = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.length || readU32(view, offset) !== ZIP_CENTRAL) return fail("malformed_zip", "Malformed ZIP central directory entry");
    const flags = readU16(view, offset + 8);
    const method = readU16(view, offset + 10);
    const expectedCrc = readU32(view, offset + 16);
    const compressedSize = readU32(view, offset + 20);
    const uncompressedSize = readU32(view, offset + 24);
    const nameLength = readU16(view, offset + 28);
    const extraLength = readU16(view, offset + 30);
    const commentLength = readU16(view, offset + 32);
    const disk = readU16(view, offset + 34);
    const localOffset = readU32(view, offset + 42);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) return fail("malformed_zip", "ZIP central directory entry is truncated");
    if ((flags & ENCRYPTED_FLAG) !== 0) return fail("unsupported_zip", "Encrypted Atom packages are not supported");
    if (disk !== 0) return fail("unsupported_zip", "Multi-disk Atom packages are not supported");
    let name: string;
    try { name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)); }
    catch { return fail("malformed_zip", "ZIP entry name is not valid UTF-8"); }
    if (!safeZipEntryName(name)) return fail("unsafe_path", `Unsafe Atom package entry: ${name}`);
    if (seenNames.has(name)) return fail("malformed_zip", `Duplicate Atom package entry: ${name}`);
    seenNames.add(name);
    declaredTotalUncompressed += uncompressedSize;
    if (uncompressedSize > maxUncompressedBytes || declaredTotalUncompressed > maxUncompressedBytes) return fail("too_large", "Atom package exceeds the configured uncompressed size limit");
    if (localOffset + 30 > bytes.length || readU32(view, localOffset) !== ZIP_LOCAL) return fail("malformed_zip", `Missing local ZIP header for ${name}`);
    const localFlags = readU16(view, localOffset + 6);
    const localMethod = readU16(view, localOffset + 8);
    const localNameLength = readU16(view, localOffset + 26);
    const localExtraLength = readU16(view, localOffset + 28);
    const localNameStart = localOffset + 30;
    const dataOffset = localNameStart + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > bytes.length) return fail("malformed_zip", `ZIP entry ${name} is truncated`);
    let localName: string;
    try { localName = decoder.decode(bytes.subarray(localNameStart, localNameStart + localNameLength)); }
    catch { return fail("malformed_zip", `Local ZIP entry name for ${name} is not valid UTF-8`); }
    if (localName !== name || localMethod !== method || (localFlags & ENCRYPTED_FLAG) !== (flags & ENCRYPTED_FLAG)) {
      return fail("malformed_zip", `ZIP central/local metadata mismatch for ${name}`);
    }
    if (name.endsWith("/") && uncompressedSize !== 0) return fail("malformed_zip", `ZIP directory entry ${name} contains data`);
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const remainingBudget = maxUncompressedBytes - actualTotalUncompressed;
    let unpacked: Uint8Array;
    if (method === 0) {
      if (compressed.length > remainingBudget) return fail("too_large", "Atom package exceeds the configured uncompressed size limit");
      unpacked = compressed.slice();
    } else if (method === 8) {
      try { unpacked = await inflateRaw(compressed, remainingBudget); }
      catch (error) {
        if (error instanceof ZipSizeLimitError) return fail("too_large", "Atom package exceeds the configured uncompressed size limit");
        return fail("unsupported_zip", `Could not inflate ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else return fail("unsupported_zip", `ZIP compression method ${method} is not supported`);
    actualTotalUncompressed += unpacked.length;
    if (actualTotalUncompressed > maxUncompressedBytes) return fail("too_large", "Atom package exceeds the configured uncompressed size limit");
    if (unpacked.length !== uncompressedSize) return fail("integrity_error", `Uncompressed size mismatch for ${name}`);
    if (crc32(unpacked) !== expectedCrc) return fail("integrity_error", `CRC mismatch for ${name}`);
    if (!name.endsWith("/")) result.set(name, unpacked);
    offset = end;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function tryParseAtomPackage(
  bytes: Uint8Array,
  options: { maxUncompressedBytes?: number } = {},
): Promise<AtomPackageParseResult> {
  const zip = await readZip(bytes, options.maxUncompressedBytes ?? DEFAULT_MAX_UNCOMPRESSED);
  if (!(zip instanceof Map)) return zip;
  const manifestBytes = zip.get("atom.json");
  if (!manifestBytes) return fail("missing_manifest", "Atom package does not contain atom.json");
  let manifest: unknown;
  try { manifest = JSON.parse(decoder.decode(manifestBytes)) as unknown; }
  catch { return fail("malformed_manifest", "atom.json is not valid UTF-8 JSON"); }
  if (!isRecord(manifest) || !isRecord(manifest.handler) || !isRecord(manifest.payload)) return fail("malformed_manifest", "atom.json is missing handler or payload metadata");
  const handlerId = manifest.handler.id;
  const payloadEntry = manifest.payload.entry;
  if (typeof handlerId !== "string" || !handlerId.trim() || typeof payloadEntry !== "string" || !safeEntryName(payloadEntry)) {
    return fail("malformed_manifest", "atom.json contains an invalid handler or payload entry");
  }
  const descriptorCandidate: Record<string, unknown> = {
    format: manifest.format, version: manifest.version, atomId: manifest.atomId, handlerId,
    atomType: manifest.atomType, schemaVersion: manifest.schemaVersion,
  };
  for (const key of ["title", "sourceNodeId", "metadata"] as const) if (manifest[key] !== undefined) descriptorCandidate[key] = manifest[key];
  const checked = validateAtomDescriptor(descriptorCandidate);
  if (!checked.ok) return fail("malformed_manifest", checked.error.message);
  const payload = zip.get(payloadEntry);
  if (!payload) return fail("missing_payload", `Atom package payload entry is missing: ${payloadEntry}`);

  const handler: AtomPackageHandler = { id: handlerId };
  if (typeof manifest.handler.appId === "string") handler.appId = manifest.handler.appId;
  if (Number.isSafeInteger(manifest.handler.minVersion)) handler.minVersion = manifest.handler.minVersion as number;
  if (manifest.handler.packageUrl === null || typeof manifest.handler.packageUrl === "string") handler.packageUrl = manifest.handler.packageUrl as string | null;
  const mediaType = typeof manifest.payload.mediaType === "string" ? manifest.payload.mediaType : undefined;
  return {
    ok: true,
    package: {
      descriptor: checked.descriptor, handler, payloadEntry, payload,
      ...(mediaType !== undefined ? { mediaType } : {}), files: zip,
    },
  };
}

export async function parseAtomPackage(bytes: Uint8Array): Promise<ParsedAtomPackage> {
  const result = await tryParseAtomPackage(bytes);
  if (!result.ok) throw new Error(result.error.message);
  return result.package;
}
