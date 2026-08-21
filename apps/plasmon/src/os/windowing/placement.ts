import type { FsService } from "../contracts/fs.ts";
import type { JsonValue, NodeId, WindowId } from "../contracts/common.ts";
import type { WindowGeometry, WindowManager, WindowState } from "../contracts/window.ts";
import { geometryEqual } from "./geometry.ts";
import type { WindowGeometryCommitter } from "./NativeWindowManager.ts";

export const FS_WINDOW_PLACEMENTS_METADATA_KEY = "plasmon.window.placements.v1";

interface LoadedPlacements {
  rootId: NodeId;
  placements: Map<string, WindowGeometry>;
}

export interface WindowPlacementStore {
  get(key: string): Promise<WindowGeometry | null>;
  set(key: string, geometry: WindowGeometry): Promise<void>;
  flush(): Promise<void>;
}

export interface NativeWindowPlacementControllerOptions {
  onPersistenceError?: (error: unknown) => void;
}

interface TrackedPlacement {
  key: string;
  last: WindowGeometry;
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

function parseGeometry(value: unknown): WindowGeometry | null {
  if (!isPlainRecord(value)) return null;
  const { x, y, width, height } = value;
  if (
    typeof x !== "number" || !Number.isFinite(x)
    || typeof y !== "number" || !Number.isFinite(y)
    || typeof width !== "number" || !Number.isFinite(width)
    || typeof height !== "number" || !Number.isFinite(height)
  ) return null;
  return { x, y, width, height };
}

function parsePlacements(value: unknown): Map<string, WindowGeometry> {
  const parsed = new Map<string, WindowGeometry>();
  try {
    if (!isPlainRecord(value) || value.version !== 1 || !isPlainRecord(value.placements)) return parsed;
    for (const [key, candidate] of Object.entries(value.placements)) {
      const geometry = parseGeometry(candidate);
      if (geometry) parsed.set(key, geometry);
    }
  } catch {
    return new Map();
  }
  return parsed;
}

function serializePlacements(placements: ReadonlyMap<string, WindowGeometry>): JsonValue {
  const serialized: { [key: string]: JsonValue } = {};
  for (const [key, geometry] of [...placements.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    serialized[key] = {
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
    };
  }
  return { version: 1, placements: serialized };
}

function cloneGeometry(geometry: WindowGeometry): WindowGeometry {
  return {
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
  };
}

function normalGeometry(state: WindowState): WindowGeometry {
  return cloneGeometry(state.restoreGeometry ?? state);
}

/** Filesystem-backed durable placement records; this store does not validate runtime geometry. */
export class FsServiceWindowPlacementStore implements WindowPlacementStore {
  private loaded: LoadedPlacements | null = null;
  private loadPromise: Promise<LoadedPlacements> | null = null;
  private writeTail: Promise<void> = Promise.resolve();
  private lastWrite: Promise<void> = Promise.resolve();

  constructor(
    private readonly fs: FsService,
    private readonly metadataKey = FS_WINDOW_PLACEMENTS_METADATA_KEY,
  ) {}

  private async load(): Promise<LoadedPlacements> {
    const root = await this.fs.resolvePath("/");
    if (!root) throw new Error("Filesystem root is unavailable");
    if (root.kind !== "directory") throw new Error("Filesystem root must be a directory");
    return {
      rootId: root.id,
      placements: parsePlacements(root.metadata[this.metadataKey]),
    };
  }

  private async ensureLoaded(): Promise<LoadedPlacements> {
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

  private invalidate(): void {
    this.loaded = null;
    this.loadPromise = null;
  }

  async get(key: string): Promise<WindowGeometry | null> {
    const geometry = (await this.ensureLoaded()).placements.get(key);
    return geometry ? cloneGeometry(geometry) : null;
  }

  set(key: string, geometry: WindowGeometry): Promise<void> {
    const accepted = cloneGeometry(geometry);
    const operation = this.writeTail.then(async () => {
      const current = await this.ensureLoaded();
      const previous = current.placements.get(key);
      if (previous && geometryEqual(previous, accepted)) return;
      const next = new Map(current.placements);
      next.set(key, accepted);
      try {
        await this.fs.setMetadata(current.rootId, {
          [this.metadataKey]: serializePlacements(next),
        });
      } catch (error) {
        this.invalidate();
        throw error;
      }
      this.loaded = { rootId: current.rootId, placements: next };
    });
    this.lastWrite = operation;
    this.writeTail = operation.catch(() => undefined);
    return operation;
  }

  flush(): Promise<void> {
    return this.lastWrite;
  }
}

/**
 * Connects stable native-app placement identity to the authoritative WindowManager.
 * It never owns live geometry: manager snapshots are observed only to persist an
 * accepted normal/restorable rectangle, and restored rectangles are applied back
 * through manager mutation methods so normal viewport/min-size constraints win.
 */
export class NativeWindowPlacementController {
  private readonly tracked = new Map<WindowId, TrackedPlacement>();
  private readonly activeKeys = new Set<string>();
  private readonly restoring = new Set<WindowId>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly manager: WindowManager,
    private readonly store: WindowPlacementStore,
    private readonly options: NativeWindowPlacementControllerOptions = {},
  ) {
    this.unsubscribe = manager.subscribe(() => this.captureAcceptedPlacements());
  }

  /**
   * Tracks only the first live window for a stable native application id. This
   * gives current apps one durable primary placement without serializing a
   * multi-window session or replacing the manager's normal cascade behavior.
   */
  async attach(appId: string, windowId: WindowId): Promise<void> {
    const state = this.manager.list().find((candidate) => candidate.id === windowId);
    if (!state || this.activeKeys.has(appId)) return;

    this.activeKeys.add(appId);
    this.tracked.set(windowId, { key: appId, last: normalGeometry(state) });

    let persisted: WindowGeometry | null = null;
    try {
      persisted = await this.store.get(appId);
    } catch (error) {
      this.options.onPersistenceError?.(error);
      return;
    }
    if (!persisted || this.tracked.get(windowId)?.key !== appId) return;
    if (!this.manager.list().some((candidate) => candidate.id === windowId)) return;

    this.restoring.add(windowId);
    try {
      const committer = this.manager as WindowManager & Partial<WindowGeometryCommitter>;
      if (typeof committer.setGeometry === "function") {
        committer.setGeometry(windowId, persisted);
      } else {
        this.manager.resize(windowId, persisted.width, persisted.height);
        this.manager.move(windowId, persisted.x, persisted.y);
      }
    } finally {
      this.restoring.delete(windowId);
    }

    const restored = this.manager.list().find((candidate) => candidate.id === windowId);
    if (!restored) return;
    const accepted = normalGeometry(restored);
    const tracked = this.tracked.get(windowId);
    if (tracked) tracked.last = accepted;
    if (!geometryEqual(accepted, persisted)) this.persist(appId, accepted);
  }

  flush(): Promise<void> {
    return this.store.flush();
  }

  dispose(): void {
    this.unsubscribe();
    this.tracked.clear();
    this.activeKeys.clear();
    this.restoring.clear();
  }

  private captureAcceptedPlacements(): void {
    const states = new Map(this.manager.list().map((state) => [state.id, state]));
    for (const [windowId, tracked] of this.tracked) {
      const state = states.get(windowId);
      if (!state) {
        this.tracked.delete(windowId);
        this.activeKeys.delete(tracked.key);
        this.restoring.delete(windowId);
        continue;
      }
      if (this.restoring.has(windowId)) continue;
      const accepted = normalGeometry(state);
      if (geometryEqual(accepted, tracked.last)) continue;
      tracked.last = accepted;
      this.persist(tracked.key, accepted);
    }
  }

  private persist(key: string, geometry: WindowGeometry): void {
    void this.store.set(key, geometry).catch((error: unknown) => {
      this.options.onPersistenceError?.(error);
    });
  }
}
