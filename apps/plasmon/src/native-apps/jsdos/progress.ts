import type { FsNode, FsService, JsonValue, NodeId } from "../../os/contracts/index.ts";
import {
  RESOURCE_PREVIEW_MAX_BYTES,
  resourcePreviewMetadata,
  type ResourcePreviewMime,
} from "../../os/fs/resourcePreview.ts";

export const JS_DOS_PROGRESS_DIRECTORY = "/.jsdos-progress";
export const JS_DOS_PROGRESS_METADATA_KEY = "plasmon.jsdos.progress.v1";
export const JS_DOS_PROGRESS_MIME = "application/x-plasmon-jsdos-progress";
export const JS_DOS_PROGRESS_FORMAT = "plasmon.jsdos-progress";
export const JS_DOS_PROGRESS_VERSION = 1;
export const JS_DOS_PROGRESS_RUNTIME_VERSION = "8.4.1";
export const JS_DOS_PROGRESS_PREVIEW_METADATA_KEY = "plasmon.jsdos.progressPreviewFor";

export interface JsDosFsChangesOptions {
  local: false;
  urlToKey(url: string): Promise<string>;
  pull(key: string): Promise<Uint8Array | null>;
  push(key: string, data: Uint8Array): Promise<void>;
}

export interface JsDosProgressCallbacks {
  onWarning?: (message: string) => void;
  onRestored?: (restored: boolean) => void;
  onSaved?: () => void;
}

export interface JsDosProgressPreview {
  bytes: Uint8Array;
  mime: ResourcePreviewMime;
  width: number;
  height: number;
}

interface ProgressMetadata {
  format: typeof JS_DOS_PROGRESS_FORMAT;
  version: typeof JS_DOS_PROGRESS_VERSION;
  runtimeVersion: string;
  gameNodeId: NodeId;
  byteLength: number;
  checksum: string;
}

function recordFor(gameNodeId: NodeId, bytes: Uint8Array): ProgressMetadata {
  return {
    format: JS_DOS_PROGRESS_FORMAT,
    version: JS_DOS_PROGRESS_VERSION,
    runtimeVersion: JS_DOS_PROGRESS_RUNTIME_VERSION,
    gameNodeId,
    byteLength: bytes.length,
    checksum: checksum(bytes),
  };
}

function readRecord(value: JsonValue | undefined): ProgressMetadata | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, JsonValue>;
  if (
    record.format !== JS_DOS_PROGRESS_FORMAT
    || record.version !== JS_DOS_PROGRESS_VERSION
    || typeof record.runtimeVersion !== "string"
    || typeof record.gameNodeId !== "string"
    || typeof record.byteLength !== "number"
    || typeof record.checksum !== "string"
  ) {
    return null;
  }
  return {
    format: JS_DOS_PROGRESS_FORMAT,
    version: JS_DOS_PROGRESS_VERSION,
    runtimeVersion: record.runtimeVersion,
    gameNodeId: record.gameNodeId,
    byteLength: record.byteLength,
    checksum: record.checksum,
  };
}

function checksum(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function jsDosProgressFileName(gameNodeId: NodeId): string {
  return `${encodeURIComponent(gameNodeId)}.changes`;
}

export function jsDosProgressPath(gameNodeId: NodeId): string {
  return `${JS_DOS_PROGRESS_DIRECTORY}/${jsDosProgressFileName(gameNodeId)}`;
}

export function jsDosProgressPreviewFileName(gameNodeId: NodeId): string {
  return `${encodeURIComponent(gameNodeId)}.preview.png`;
}

export function jsDosProgressPreviewPath(gameNodeId: NodeId): string {
  return `${JS_DOS_PROGRESS_DIRECTORY}/${jsDosProgressPreviewFileName(gameNodeId)}`;
}

async function ensureProgressDirectory(fs: FsService): Promise<FsNode> {
  const existing = await fs.resolvePath(JS_DOS_PROGRESS_DIRECTORY);
  if (existing) {
    if (existing.kind !== "directory") {
      throw new Error(`${JS_DOS_PROGRESS_DIRECTORY} exists but is not a directory`);
    }
    return existing;
  }

  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");
  try {
    return await fs.mkdir(root.id, JS_DOS_PROGRESS_DIRECTORY.slice(1));
  } catch (error) {
    const concurrent = await fs.resolvePath(JS_DOS_PROGRESS_DIRECTORY);
    if (concurrent?.kind === "directory") return concurrent;
    throw error;
  }
}

export class JsDosProgressStore {
  constructor(
    private readonly fs: FsService,
    readonly gameNodeId: NodeId,
    private readonly onWarning: (message: string) => void = () => undefined,
  ) {}

  async load(): Promise<Uint8Array | null> {
    const save = await this.fs.resolvePath(jsDosProgressPath(this.gameNodeId));
    if (!save) return null;
    if (save.kind !== "file") {
      this.warn("Saved js-dos progress is not a file; starting without saved progress.");
      return null;
    }

    const record = readRecord(save.metadata[JS_DOS_PROGRESS_METADATA_KEY]);
    if (!record || record.gameNodeId !== this.gameNodeId) {
      this.warn("Saved js-dos progress metadata is invalid; starting without saved progress.");
      return null;
    }
    if (record.runtimeVersion !== JS_DOS_PROGRESS_RUNTIME_VERSION) {
      this.warn("Saved js-dos progress was created by an incompatible runtime; starting without saved progress.");
      return null;
    }

    try {
      const bytes = await this.fs.read(save.id);
      if (bytes.length !== record.byteLength || checksum(bytes) !== record.checksum) {
        this.warn("Saved js-dos progress is corrupt; starting without saved progress.");
        return null;
      }
      return bytes;
    } catch {
      this.warn("Saved js-dos progress could not be read; starting without saved progress.");
      return null;
    }
  }

  async save(bytes: Uint8Array): Promise<FsNode> {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
      throw new Error("js-dos returned empty progress data");
    }
    await this.fs.stat(this.gameNodeId);
    const directory = await ensureProgressDirectory(this.fs);
    const name = jsDosProgressFileName(this.gameNodeId);
    let save = await this.fs.resolvePath(jsDosProgressPath(this.gameNodeId));
    if (save && save.kind !== "file") {
      throw new Error(`js-dos progress path is not a file: ${jsDosProgressPath(this.gameNodeId)}`);
    }
    if (!save) {
      save = await this.fs.createFile(directory.id, name, { mime: JS_DOS_PROGRESS_MIME });
    }
    save = await this.fs.write(save.id, bytes, { truncate: true });
    return this.fs.setMetadata(save.id, {
      [JS_DOS_PROGRESS_METADATA_KEY]: recordFor(this.gameNodeId, bytes) as unknown as JsonValue,
    });
  }

  /**
   * Attach one presentation-only screenshot to the canonical save resource.
   * Repeated captures overwrite the same preview node, so preview storage is
   * bounded to one image per game save. Save correctness never reads it.
   */
  async savePreview(preview: JsDosProgressPreview): Promise<FsNode | null> {
    if (!(preview.bytes instanceof Uint8Array)
      || preview.bytes.length === 0
      || preview.bytes.length > RESOURCE_PREVIEW_MAX_BYTES) {
      return null;
    }

    const save = await this.fs.resolvePath(jsDosProgressPath(this.gameNodeId));
    if (!save || save.kind !== "file") return null;
    const record = readRecord(save.metadata[JS_DOS_PROGRESS_METADATA_KEY]);
    if (!record || record.gameNodeId !== this.gameNodeId) return null;

    const directory = await ensureProgressDirectory(this.fs);
    let image = await this.fs.resolvePath(jsDosProgressPreviewPath(this.gameNodeId));
    if (image && image.kind !== "file") return null;
    if (!image) {
      image = await this.fs.createFile(directory.id, jsDosProgressPreviewFileName(this.gameNodeId), {
        mime: preview.mime,
        metadata: {
          hidden: true,
          [JS_DOS_PROGRESS_PREVIEW_METADATA_KEY]: this.gameNodeId,
        },
      });
    }
    image = await this.fs.write(image.id, preview.bytes, { truncate: true });
    if (image.mime !== preview.mime) {
      image = await this.fs.setMetadata(image.id, {
        [JS_DOS_PROGRESS_PREVIEW_METADATA_KEY]: this.gameNodeId,
      });
    }

    await this.fs.setMetadata(save.id, resourcePreviewMetadata({
      nodeId: image.id,
      mime: preview.mime,
      byteSize: preview.bytes.length,
      width: preview.width,
      height: preview.height,
    }));
    return image;
  }

  private warn(message: string): void {
    this.onWarning(message);
  }
}

/**
 * Maps js-dos' supported fsChanges API onto the Plasmon filesystem. The key is
 * the stable game NodeId rather than the bundle Blob URL, filename, or path.
 * Browser-local js-dos progress storage is explicitly disabled.
 */
export function createJsDosFsChanges(
  fs: FsService,
  gameNodeId: NodeId,
  callbacks: JsDosProgressCallbacks = {},
): JsDosFsChangesOptions {
  const store = new JsDosProgressStore(fs, gameNodeId, callbacks.onWarning);
  const assertKey = (key: string) => {
    if (key !== gameNodeId) throw new Error("js-dos progress key does not match the opened game resource");
  };

  return {
    local: false,
    urlToKey: async () => gameNodeId,
    pull: async (key) => {
      assertKey(key);
      const bytes = await store.load();
      callbacks.onRestored?.(bytes !== null);
      return bytes;
    },
    push: async (key, data) => {
      assertKey(key);
      await store.save(data);
      callbacks.onSaved?.();
    },
  };
}
