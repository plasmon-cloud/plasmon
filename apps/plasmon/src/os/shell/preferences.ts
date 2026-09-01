import type { FsNode, FsService, JsonValue, NodeId } from "../contracts/index.ts";

export const SHELL_PREFERENCES_KEY = "plasmon.shell.preferences.v1";

export const SHELL_THEME_IDS = [
  "plasmon-graphite",
  "plasmon-verdant",
  "plasmon-midnight",
  "plasmon-ember",
  "plasmon-glacier",
  "plasmon-rosewood",
] as const;
export type ShellThemeId = (typeof SHELL_THEME_IDS)[number];

export const SHELL_THEME_LABELS = Object.freeze({
  "plasmon-graphite": "Graphite",
  "plasmon-verdant": "Verdant",
  "plasmon-midnight": "Midnight",
  "plasmon-ember": "Ember",
  "plasmon-glacier": "Glacier",
  "plasmon-rosewood": "Rosewood",
} satisfies Readonly<Record<ShellThemeId, string>>);

export const SHELL_APPEARANCE_MODES = ["dark", "light"] as const;
export type ShellAppearanceMode = (typeof SHELL_APPEARANCE_MODES)[number];

export const SHELL_GENERATED_WALLPAPER_IDS = [
  "plasmon-lattice",
  "midnight-orbit",
  "ember-horizon",
  "glacier-prism",
  "rosewood-bloom",
] as const;

export const SHELL_JPG_WALLPAPER_ID = "graphite-sand" as const;

export const SHELL_WALLPAPER_IDS = [
  SHELL_JPG_WALLPAPER_ID,
  ...SHELL_GENERATED_WALLPAPER_IDS,
] as const;
export type ShellWallpaperId = (typeof SHELL_WALLPAPER_IDS)[number];

export const SHELL_THEME_WALLPAPER_IDS = SHELL_WALLPAPER_IDS;
export type ShellThemeWallpaperId = ShellWallpaperId;

export const SHELL_WALLPAPER_LABELS = Object.freeze({
  "graphite-sand": "Graphite Sand",
  "plasmon-lattice": "Plasmon Lattice",
  "midnight-orbit": "Midnight Orbit",
  "ember-horizon": "Ember Horizon",
  "glacier-prism": "Glacier Prism",
  "rosewood-bloom": "Rosewood Bloom",
} satisfies Readonly<Record<ShellWallpaperId, string>>);

export const SHELL_THEME_WALLPAPERS = Object.freeze({
  "plasmon-graphite": "graphite-sand",
  "plasmon-verdant": "plasmon-lattice",
  "plasmon-midnight": "midnight-orbit",
  "plasmon-ember": "ember-horizon",
  "plasmon-glacier": "glacier-prism",
  "plasmon-rosewood": "rosewood-bloom",
} satisfies Readonly<Record<ShellThemeId, ShellThemeWallpaperId>>);

export type ShellWallpaperPreference =
  | { mode: "follow-theme" }
  | { mode: "pinned"; id: ShellWallpaperId };

export const SHELL_TASKBAR_ALIGNMENTS = ["center", "left"] as const;
export type ShellTaskbarAlignment = (typeof SHELL_TASKBAR_ALIGNMENTS)[number];

export interface ShellPreferences {
  version: 1;
  pinnedNative: string[];
  pinnedElements: string[];
  themeId: ShellThemeId;
  /** Defaults to dark for legacy v1 preference objects that predate appearance mode. */
  appearanceMode: ShellAppearanceMode;
  wallpaper: ShellWallpaperPreference;
  /** Defaults to true for legacy v1 preference objects that predate the watermark preference. */
  showBrandWatermark?: boolean;
  taskbarAlignment: ShellTaskbarAlignment;
}

export const DEFAULT_SHELL_PREFERENCES: ShellPreferences = Object.freeze({
  version: 1,
  pinnedNative: ["native:terminal"],
  pinnedElements: [],
  themeId: "plasmon-graphite",
  appearanceMode: "dark",
  wallpaper: Object.freeze({ mode: "pinned" as const, id: "rosewood-bloom" as const }),
  showBrandWatermark: true,
  taskbarAlignment: "center",
});

export function cloneShellPreferences(preferences: ShellPreferences = DEFAULT_SHELL_PREFERENCES): ShellPreferences {
  return {
    version: 1,
    pinnedNative: [...preferences.pinnedNative],
    pinnedElements: [...preferences.pinnedElements],
    themeId: preferences.themeId,
    appearanceMode: preferences.appearanceMode,
    wallpaper: preferences.wallpaper.mode === "pinned"
      ? { mode: "pinned", id: preferences.wallpaper.id }
      : { mode: "follow-theme" },
    showBrandWatermark: preferences.showBrandWatermark !== false,
    taskbarAlignment: preferences.taskbarAlignment,
  };
}

export function effectiveShellWallpaper(
  themeId: ShellThemeId,
  wallpaper: ShellWallpaperPreference,
): ShellWallpaperId {
  return wallpaper.mode === "pinned" ? wallpaper.id : SHELL_THEME_WALLPAPERS[themeId];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || item.trim() !== item || !item) return null;
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function isTheme(value: unknown): value is ShellThemeId {
  return typeof value === "string" && (SHELL_THEME_IDS as readonly string[]).includes(value);
}

function normalizeTheme(value: unknown): ShellThemeId | null {
  if (value === "plasmon-dark") return "plasmon-verdant";
  return isTheme(value) ? value : null;
}

function isAppearanceMode(value: unknown): value is ShellAppearanceMode {
  return typeof value === "string" && (SHELL_APPEARANCE_MODES as readonly string[]).includes(value);
}

function isWallpaperId(value: unknown): value is ShellWallpaperId {
  return typeof value === "string" && (SHELL_WALLPAPER_IDS as readonly string[]).includes(value);
}

function normalizeWallpaperPreference(value: unknown): ShellWallpaperPreference {
  if (isRecord(value)) {
    if (value.mode === "follow-theme") return { mode: "follow-theme" };
    if (value.mode === "pinned" && value.id === "plasmon-aurora") {
      return { mode: "pinned", id: "plasmon-lattice" };
    }
    if (value.mode === "pinned" && value.id === "digital-dusk") {
      return { mode: "pinned", id: "graphite-sand" };
    }
    if (value.mode === "pinned" && isWallpaperId(value.id)) return { mode: "pinned", id: value.id };
    return { mode: "follow-theme" };
  }

  if (value === "aurora" || value === "plain" || value === undefined) return { mode: "follow-theme" };
  return { mode: "follow-theme" };
}

function isTaskbarAlignment(value: unknown): value is ShellTaskbarAlignment {
  return typeof value === "string" && (SHELL_TASKBAR_ALIGNMENTS as readonly string[]).includes(value);
}

export function validateShellPreferences(value: unknown): ShellPreferences | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const pinnedNative = stringList(value.pinnedNative);
  const pinnedElements = stringList(value.pinnedElements);
  const themeId = normalizeTheme(value.themeId);
  const appearanceMode = value.appearanceMode === undefined ? "dark" : value.appearanceMode;
  const taskbarAlignment = value.taskbarAlignment === undefined ? "center" : value.taskbarAlignment;
  const showBrandWatermark = value.showBrandWatermark === undefined ? true : value.showBrandWatermark;
  if (
    !pinnedNative
    || !pinnedElements
    || !themeId
    || !isAppearanceMode(appearanceMode)
    || typeof showBrandWatermark !== "boolean"
    || !isTaskbarAlignment(taskbarAlignment)
  ) {
    return null;
  }
  return {
    version: 1,
    pinnedNative,
    pinnedElements,
    themeId,
    appearanceMode,
    wallpaper: normalizeWallpaperPreference(value.wallpaper),
    showBrandWatermark,
    taskbarAlignment,
  };
}

export function parseShellPreferences(serialized: string): ShellPreferences | null {
  try {
    return validateShellPreferences(JSON.parse(serialized) as unknown);
  } catch {
    return null;
  }
}

function preferenceMetadataValue(preferences: ShellPreferences): JsonValue {
  return {
    version: 1,
    pinnedNative: [...preferences.pinnedNative],
    pinnedElements: [...preferences.pinnedElements],
    themeId: preferences.themeId,
    appearanceMode: preferences.appearanceMode,
    wallpaper: preferences.wallpaper.mode === "pinned"
      ? { mode: "pinned", id: preferences.wallpaper.id }
      : { mode: "follow-theme" },
    showBrandWatermark: preferences.showBrandWatermark !== false,
    taskbarAlignment: preferences.taskbarAlignment,
  };
}

function requireFilesystemRoot(root: FsNode | null): FsNode {
  if (!root) throw new Error("Filesystem root is unavailable");
  if (root.kind !== "directory") throw new Error("Filesystem root is not a directory");
  return root;
}

export class ShellPreferenceStore {
  private rootId: NodeId | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly fs: FsService) {}

  async load(): Promise<ShellPreferences> {
    const root = requireFilesystemRoot(await this.fs.resolvePath("/"));
    this.rootId = root.id;
    const stored = validateShellPreferences(root.metadata[SHELL_PREFERENCES_KEY]);
    return stored ?? cloneShellPreferences();
  }

  save(preferences: ShellPreferences): Promise<void> {
    const checked = validateShellPreferences(preferences);
    if (!checked) return Promise.reject(new Error("Shell preferences are invalid"));

    const write = async (): Promise<void> => {
      const rootId = await this.resolveRootId();
      await this.fs.setMetadata(rootId, {
        [SHELL_PREFERENCES_KEY]: preferenceMetadataValue(checked),
      });
    };

    const operation = this.writeChain.then(write);
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  private async resolveRootId(): Promise<NodeId> {
    if (this.rootId) return this.rootId;
    const root = requireFilesystemRoot(await this.fs.resolvePath("/"));
    this.rootId = root.id;
    return root.id;
  }
}

export interface ShellPreferenceSaveOutcome {
  preferences: ShellPreferences;
  saved: boolean;
  error: unknown | null;
}

export interface ShellPreferencesAuthority {
  getSnapshot(): ShellPreferences;
  isReady(): boolean;
  subscribe(listener: (preferences: ShellPreferences, ready: boolean) => void): () => void;
  load(): Promise<ShellPreferences>;
  save(preferences: ShellPreferences): Promise<ShellPreferenceSaveOutcome>;
}

/**
 * Shared Shell preference authority for Shell and native Settings. The
 * controller owns the in-memory snapshot while ShellPreferenceStore remains
 * the filesystem persistence boundary.
 */
export class ShellPreferencesController implements ShellPreferencesAuthority {
  private preferences = cloneShellPreferences();
  private ready = false;
  private readonly listeners = new Set<(preferences: ShellPreferences, ready: boolean) => void>();

  constructor(private readonly store: ShellPreferenceStore) {}

  getSnapshot(): ShellPreferences {
    return cloneShellPreferences(this.preferences);
  }

  isReady(): boolean {
    return this.ready;
  }

  subscribe(listener: (preferences: ShellPreferences, ready: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async load(): Promise<ShellPreferences> {
    try {
      this.preferences = await this.store.load();
    } catch (error: unknown) {
      this.preferences = cloneShellPreferences();
      this.ready = true;
      this.notify();
      throw error;
    }
    this.ready = true;
    this.notify();
    return this.getSnapshot();
  }

  async save(preferences: ShellPreferences): Promise<ShellPreferenceSaveOutcome> {
    const checked = validateShellPreferences(preferences);
    if (!checked) throw new Error("Shell preferences are invalid");
    this.preferences = cloneShellPreferences(checked);
    this.notify();
    return saveShellPreferencesNonDestructive(this.store, this.preferences);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot, this.ready);
  }
}

export async function saveShellPreferencesNonDestructive(
  store: ShellPreferenceStore,
  preferences: ShellPreferences,
): Promise<ShellPreferenceSaveOutcome> {
  const checked = validateShellPreferences(preferences);
  if (!checked) throw new Error("Shell preferences are invalid");
  const current = cloneShellPreferences(checked);
  try {
    await store.save(current);
    return { preferences: current, saved: true, error: null };
  } catch (error: unknown) {
    return { preferences: current, saved: false, error };
  }
}

export function togglePinned(values: readonly string[], id: string): string[] {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}
