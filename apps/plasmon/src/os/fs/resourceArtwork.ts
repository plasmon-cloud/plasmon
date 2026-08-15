import type { FsNode, JsonValue } from "../contracts/index.ts";

export const RESOURCE_ARTWORK_METADATA_KEY = "plasmon.resourceArtwork";
export const RESOURCE_ARTWORK_MAX_BYTES = 512 * 1024;
export const RESOURCE_ARTWORK_MAX_SOURCE_LENGTH = 256;
export const RESOURCE_ARTWORK_PACKAGE_PREFIX = "static/plasmon/artwork/";

export type ResourceArtworkMime =
  | "image/jpeg"
  | "image/png"
  | "image/svg+xml"
  | "image/webp";

export interface ResourceArtworkMetadata {
  format: "plasmon.resource-artwork";
  version: 1;
  source: "package-local";
  src: string;
  mime: ResourceArtworkMime;
  byteSize: number;
}

type ArtworkResource = Pick<FsNode, "metadata">;

const MIME_BY_EXTENSION: Readonly<Record<string, ResourceArtworkMime>> = Object.freeze({
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
});

function record(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : null;
}

function packageArtworkSource(value: JsonValue | undefined): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith(RESOURCE_ARTWORK_PACKAGE_PREFIX) || value.length > RESOURCE_ARTWORK_MAX_SOURCE_LENGTH) return null;
  if (/[\\?#%]/u.test(value)) return null;
  if (!/^[A-Za-z0-9._/-]+$/u.test(value)) return null;
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return value;
}

function artworkMime(value: JsonValue | undefined, src: string): ResourceArtworkMime | null {
  if (typeof value !== "string") return null;
  const dot = src.lastIndexOf(".");
  const extension = dot >= 0 ? src.slice(dot).toLowerCase() : "";
  const expected = MIME_BY_EXTENSION[extension];
  return expected === value ? expected : null;
}

function parseArtwork(value: JsonValue | undefined): ResourceArtworkMetadata | null {
  const candidate = record(value);
  if (!candidate
    || candidate.format !== "plasmon.resource-artwork"
    || candidate.version !== 1
    || candidate.source !== "package-local") return null;
  const src = packageArtworkSource(candidate.src);
  if (!src) return null;
  const mime = artworkMime(candidate.mime, src);
  if (!mime) return null;
  const byteSize = candidate.byteSize;
  if (typeof byteSize !== "number"
    || !Number.isSafeInteger(byteSize)
    || byteSize < 1
    || byteSize > RESOURCE_ARTWORK_MAX_BYTES) return null;
  return {
    format: "plasmon.resource-artwork",
    version: 1,
    source: "package-local",
    src,
    mime,
    byteSize,
  };
}

/**
 * Read presentation-only artwork from stable filesystem metadata.
 *
 * v1 deliberately accepts only bounded assets shipped inside the Plasmon
 * package. URLs, data/blob references, traversal, query/fragment rewriting,
 * unsupported image MIME values, and oversized declarations fall back by
 * returning null. Runtime/association selection never consults this metadata.
 */
export function readResourceArtworkMetadata(node: ArtworkResource): ResourceArtworkMetadata | null {
  return parseArtwork(node.metadata[RESOURCE_ARTWORK_METADATA_KEY]);
}

/** Create validated artwork metadata for a package-owned filesystem resource. */
export function resourceArtworkMetadata(
  input: Pick<ResourceArtworkMetadata, "src" | "mime" | "byteSize">,
): Record<string, JsonValue> {
  const candidate: ResourceArtworkMetadata = {
    format: "plasmon.resource-artwork",
    version: 1,
    source: "package-local",
    src: input.src,
    mime: input.mime,
    byteSize: input.byteSize,
  };
  if (!parseArtwork(candidate as unknown as JsonValue)) {
    throw new Error("Invalid package-local resource artwork metadata");
  }
  return { [RESOURCE_ARTWORK_METADATA_KEY]: candidate as unknown as JsonValue };
}
