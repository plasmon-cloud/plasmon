import {
  ChunkIntegrityError,
  ResourceIntegrityError,
  type ProviderChunkRef,
} from "./model.ts";

const encoder = new TextEncoder();
const ROOT_DOMAIN = encoder.encode("plasmon.shared-resource.content-root.v1\0");

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new ChunkIntegrityError(`Invalid SHA-256 digest: ${hex}`);
  }
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return bytesToHex(await sha256(bytes));
}

function writeUint64(target: Uint8Array, offset: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ResourceIntegrityError(`Invalid unsigned 64-bit value: ${value}`);
  }
  let remaining = BigInt(value);
  for (let index = 7; index >= 0; index -= 1) {
    target[offset + index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}

/**
 * Content root for an ordered chunk manifest. The root is deliberately based
 * only on immutable content layout, so identical content can be recognized
 * independently of path/name/resource identity.
 */
export async function computeContentRoot(
  byteLength: number,
  chunks: readonly ProviderChunkRef[],
): Promise<string> {
  const entrySize = 32 + 8;
  const preimage = new Uint8Array(ROOT_DOMAIN.length + 8 + 8 + chunks.length * entrySize);
  preimage.set(ROOT_DOMAIN, 0);
  let offset = ROOT_DOMAIN.length;
  writeUint64(preimage, offset, byteLength);
  offset += 8;
  writeUint64(preimage, offset, chunks.length);
  offset += 8;

  for (const chunk of chunks) {
    const hash = hexToBytes(chunk.hash);
    preimage.set(hash, offset);
    offset += hash.length;
    writeUint64(preimage, offset, chunk.size);
    offset += 8;
  }

  return sha256Hex(preimage);
}

export async function verifyChunk(ref: ProviderChunkRef, bytes: Uint8Array): Promise<void> {
  if (bytes.length !== ref.size) {
    throw new ChunkIntegrityError(`Chunk ${ref.hash} has size ${bytes.length}; expected ${ref.size}`);
  }
  const actual = await sha256Hex(bytes);
  if (actual !== ref.hash) {
    throw new ChunkIntegrityError(`Chunk hash mismatch: expected ${ref.hash}, received ${actual}`);
  }
}

export async function verifyContentRoot(
  byteLength: number,
  chunks: readonly ProviderChunkRef[],
  expectedRoot: string,
): Promise<void> {
  const total = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  if (total !== byteLength) {
    throw new ResourceIntegrityError(`Chunk sizes total ${total}; expected ${byteLength}`);
  }
  const actual = await computeContentRoot(byteLength, chunks);
  if (actual !== expectedRoot) {
    throw new ResourceIntegrityError(`Content root mismatch: expected ${expectedRoot}, received ${actual}`);
  }
}
