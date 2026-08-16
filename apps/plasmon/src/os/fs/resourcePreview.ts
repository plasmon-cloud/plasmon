import type { FsNode, JsonValue, NodeId } from "../contracts/index.ts";

export const RESOURCE_PREVIEW_METADATA_KEY = "plasmon.resourcePreview";
export const RESOURCE_PREVIEW_MAX_BYTES = 256 * 1024;
export const RESOURCE_PREVIEW_MAX_DIMENSION = 512;

export type ResourcePreviewMime = "image/jpeg" | "image/png" | "image/webp";

export interface ResourcePreviewMetadata {
  format: "plasmon.resource-preview";
  version: 1;
  source: "filesystem-node";
  nodeId: NodeId;
  mime: ResourcePreviewMime;
  byteSize: number;
  width: number;
  height: number;
}

type PreviewResource = Pick<FsNode, "metadata">;

function record(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : null;
}

function boundedPositiveInteger(value: JsonValue | undefined, maximum: number): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value > 0
    && value <= maximum
    ? value
    : null;
}

function previewMime(value: JsonValue | undefined): ResourcePreviewMime | null {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp"
    ? value
    : null;
}

function parsePreview(value: JsonValue | undefined): ResourcePreviewMetadata | null {
  const candidate = record(value);
  if (!candidate
    || candidate.format !== "plasmon.resource-preview"
    || candidate.version !== 1
    || candidate.source !== "filesystem-node"
    || typeof candidate.nodeId !== "string"
    || candidate.nodeId.length === 0) return null;

  const mime = previewMime(candidate.mime);
  const byteSize = boundedPositiveInteger(candidate.byteSize, RESOURCE_PREVIEW_MAX_BYTES);
  const width = boundedPositiveInteger(candidate.width, RESOURCE_PREVIEW_MAX_DIMENSION);
  const height = boundedPositiveInteger(candidate.height, RESOURCE_PREVIEW_MAX_DIMENSION);
  if (!mime || byteSize === null || width === null || height === null) return null;

  return {
    format: "plasmon.resource-preview",
    version: 1,
    source: "filesystem-node",
    nodeId: candidate.nodeId,
    mime,
    byteSize,
    width,
    height,
  };
}

/**
 * Read presentation-only preview metadata from an authoritative filesystem
 * resource. The referenced image is never consulted for resource/save
 * correctness; invalid metadata simply produces the canonical fallback.
 */
export function readResourcePreviewMetadata(node: PreviewResource): ResourcePreviewMetadata | null {
  return parsePreview(node.metadata[RESOURCE_PREVIEW_METADATA_KEY]);
}

/** Create a bounded filesystem-node preview reference for a resource. */
export function resourcePreviewMetadata(
  input: Omit<ResourcePreviewMetadata, "format" | "version" | "source">,
): Record<string, JsonValue> {
  const candidate: ResourcePreviewMetadata = {
    format: "plasmon.resource-preview",
    version: 1,
    source: "filesystem-node",
    ...input,
  };
  if (!parsePreview(candidate as unknown as JsonValue)) {
    throw new Error("Invalid filesystem resource preview metadata");
  }
  return { [RESOURCE_PREVIEW_METADATA_KEY]: candidate as unknown as JsonValue };
}
