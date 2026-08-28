import type { FsNode, FsService } from "../contracts/index.ts";

export const DOWNLOAD_CHUNK_BYTES = 1024 * 1024;

export interface DownloadAnchorLike {
  href: string;
  download: string;
  click(): void;
  remove(): void;
}

export interface DownloadEnvironment {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): DownloadAnchorLike;
  scheduleCleanup(callback: () => void): void;
}

export function browserDownloadEnvironment(): DownloadEnvironment {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => {
      const anchor = document.createElement("a");
      anchor.style.display = "none";
      document.body.append(anchor);
      return anchor;
    },
    scheduleCleanup: (callback) => { window.setTimeout(callback, 0); },
  };
}

export function saneDownloadFilename(name: string): string {
  const sane = name.replace(/[\\/]/g, "_").trim();
  return sane || "download";
}

export async function readDownloadBlob(
  fs: FsService,
  node: FsNode,
  chunkBytes = DOWNLOAD_CHUNK_BYTES,
): Promise<Blob> {
  if (node.kind === "directory") throw new Error("Folders cannot be downloaded as a single file");
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) throw new Error("Download chunk size must be positive");

  const parts: Uint8Array[] = [];
  for (let offset = 0; offset < node.size; offset += chunkBytes) {
    const length = Math.min(chunkBytes, node.size - offset);
    const bytes = await fs.read(node.id, { offset, length });
    if (bytes.byteLength !== length) throw new Error(`Short read while downloading ${node.name}`);
    parts.push(bytes);
  }
  return new Blob(parts, { type: node.mime || "application/octet-stream" });
}

export function downloadBlob(
  node: FsNode,
  blob: Blob,
  environment: DownloadEnvironment = browserDownloadEnvironment(),
): void {
  console.log(`[download-debug] downloadBlob name=${node.name} size=${blob.size}`);
  const url = environment.createObjectURL(blob);
  const anchor = environment.createAnchor();
  anchor.href = url;
  anchor.download = saneDownloadFilename(node.name);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    environment.scheduleCleanup(() => environment.revokeObjectURL(url));
  }
}

export async function downloadFsNode(
  fs: FsService,
  node: FsNode,
  environment: DownloadEnvironment = browserDownloadEnvironment(),
): Promise<void> {
  const blob = await readDownloadBlob(fs, node);
  downloadBlob(node, blob, environment);
}
