import type { FsNode, NodeId } from "../../os/contracts/index.ts";
import { classifyResource } from "../../os/fs/index.ts";

/** Handler capability declarations; global resource classification lives in fs/resourcePolicy. */
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"] as const;
export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/svg+xml"] as const;

export interface ObjectUrlApi { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void; }

export function inferImageMime(name: string, declaredMime?: string): string | null {
  const classification = classifyResource({
    name,
    kind: "file",
    metadata: {},
    ...(declaredMime ? { mime: declaredMime } : {}),
  });
  const mime = classification.type.mime;
  if (classification.type.contentKind !== "image" || !mime) return null;
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mime) ? mime : null;
}

export function isSupportedImageNode(node: FsNode): boolean {
  return node.kind !== "directory" && inferImageMime(node.name, node.mime) !== null;
}

export function createImageObjectUrlLease(
  bytes: Uint8Array,
  name: string,
  declaredMime: string | undefined,
  urlApi: ObjectUrlApi,
): { url: string; mime: string; release: () => void } {
  const mime = inferImageMime(name, declaredMime);
  if (!mime) throw new Error(`Unsupported image format: ${name}`);
  const blob = new Blob([bytes.slice().buffer], { type: mime });
  const url = urlApi.createObjectURL(blob);
  let released = false;
  return {
    url,
    mime,
    release: () => {
      if (released) return;
      released = true;
      urlApi.revokeObjectURL(url);
    },
  };
}

export function adjacentImageNode(nodes: readonly FsNode[], currentId: NodeId, direction: -1 | 1): FsNode | null {
  const images = nodes.filter(isSupportedImageNode).sort((a, b) => a.name.localeCompare(b.name));
  const current = images.findIndex((node) => node.id === currentId);
  if (current < 0) return null;
  return images[current + direction] ?? null;
}
