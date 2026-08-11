import type { FsService, HandlerId, JsonValue, NodeId } from "../contracts/index.ts";
import type { AssociationDefaultStore } from "./defaults.ts";

export const FS_ASSOCIATION_DEFAULTS_METADATA_KEY = "plasmon.association.defaults.v1";

interface LoadedDefaults {
  rootId: NodeId;
  defaults: Map<string, HandlerId>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function parsePersistedDefaults(value: unknown): Map<string, HandlerId> {
  if (value === undefined) return new Map();
  try {
    if (!isPlainRecord(value) || value.version !== 1 || !isPlainRecord(value.defaults)) return new Map();
    const entries = Object.entries(value.defaults);
    if (entries.some(([, handlerId]) => typeof handlerId !== "string")) return new Map();
    return new Map(entries as Array<[string, HandlerId]>);
  } catch {
    return new Map();
  }
}

function serializeDefaults(defaults: ReadonlyMap<string, HandlerId>): JsonValue {
  return {
    version: 1,
    defaults: Object.fromEntries([...defaults.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

export class FsServiceAssociationDefaultStore implements AssociationDefaultStore {
  private readonly fs: FsService;
  private readonly metadataKey: string;
  private loaded: LoadedDefaults | null = null;
  private loadPromise: Promise<LoadedDefaults> | null = null;
  private writeTail: Promise<void> = Promise.resolve();

  constructor(fs: FsService, metadataKey = FS_ASSOCIATION_DEFAULTS_METADATA_KEY) {
    this.fs = fs;
    this.metadataKey = metadataKey;
  }

  private async load(): Promise<LoadedDefaults> {
    const root = await this.fs.resolvePath("/");
    if (!root) throw new Error("Filesystem root is unavailable");
    if (root.kind !== "directory") throw new Error("Filesystem root must be a directory");
    return {
      rootId: root.id,
      defaults: parsePersistedDefaults(root.metadata[this.metadataKey]),
    };
  }

  private async ensureLoaded(): Promise<LoadedDefaults> {
    if (this.loaded) return this.loaded;
    if (!this.loadPromise) {
      this.loadPromise = this.load().then(
        (loaded) => {
          this.loaded = loaded;
          return loaded;
        },
        (error: unknown) => {
          this.loadPromise = null;
          throw error;
        },
      );
    }
    return this.loadPromise;
  }

  private invalidateLoadedState(): void {
    this.loaded = null;
    this.loadPromise = null;
  }

  private enqueueWrite(update: (defaults: Map<string, HandlerId>) => boolean): Promise<void> {
    const operation = this.writeTail.then(async () => {
      const current = await this.ensureLoaded();
      const next = new Map(current.defaults);
      if (!update(next)) return;

      try {
        await this.fs.setMetadata(current.rootId, {
          [this.metadataKey]: serializeDefaults(next),
        });
      } catch (error) {
        this.invalidateLoadedState();
        throw error;
      }

      this.loaded = { rootId: current.rootId, defaults: next };
    });

    this.writeTail = operation.catch(() => undefined);
    return operation;
  }

  async get(typeKey: string): Promise<HandlerId | null> {
    return (await this.ensureLoaded()).defaults.get(typeKey) ?? null;
  }

  set(typeKey: string, handlerId: HandlerId): Promise<void> {
    return this.enqueueWrite((defaults) => {
      if (defaults.get(typeKey) === handlerId) return false;
      defaults.set(typeKey, handlerId);
      return true;
    });
  }

  delete(typeKey: string): Promise<void> {
    return this.enqueueWrite((defaults) => defaults.delete(typeKey));
  }
}
