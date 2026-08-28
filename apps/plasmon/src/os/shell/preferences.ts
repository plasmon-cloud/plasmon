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

export const SHELL_WALLPAPERS = ["aurora", "plain"] as const;
export type ShellWallpaper = (typeof SHELL_WALLPAPERS)[number];

export const SHELL_TASKBAR_ALIGNMENTS = ["center", "left"] as const;
export type ShellTaskbarAlignment = (typeof SHELL_TASKBAR_ALIGNMENTS)[number];

export interface ShellPreferences {
  version: 1;
  pinnedNative: string[];
  pinnedElements: string[];
  themeId: ShellThemeId;
  wallpaper: ShellWallpaper;
  taskbarAlignment: ShellTaskbarAlignment;
}

export const DEFAULT_SHELL_PREFERENCES: ShellPreferences = Object.freeze({
  version: 1,
  pinnedNative: [],
  pinnedElements: [],
  themeId: "plasmon-graphite",
  wallpaper: "aurora",
  taskbarAlignment: "center",
});

export function cloneShellPreferences(preferences: ShellPreferences = DEFAULT_SHELL_PREFERENCES): ShellPreferences {
  return {
    version: 1,
    pinnedNative: [...preferences.pinnedNative],
    pinnedElements: [...preferences.pinnedElements],
    themeId: preferences.themeId,
    wallpaper: preferences.wallpaper,
    taskbarAlignment: preferences.taskbarAlignment,
  };
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
  // Preview builds exposed the green/teal palette as plasmon-dark. Preserve
  // that user choice while giving the identity its final descriptive name.
  if (value === "plasmon-dark") return "plasmon-verdant";
  return isTheme(value) ? value : null;
}

function isWallpaper(value: unknown): value is ShellWallpaper {
  return typeof value === "string" && (SHELL_WALLPAPERS as readonly string[]).includes(value);
}

function isTaskbarAlignment(value: unknown): value is ShellTaskbarAlignment {
  return typeof value === "string" && (SHELL_TASKBAR_ALIGNMENTS as readonly string[]).includes(value);
}

export function validateShellPreferences(value: unknown): ShellPreferences | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const pinnedNative = stringList(value.pinnedNative);
  const pinnedElements = stringList(value.pinnedElements);
  const themeId = normalizeTheme(value.themeId);
  const taskbarAlignment = value.taskbarAlignment === undefined ? "center" : value.taskbarAlignment;
  if (
    !pinnedNative
    || !pinnedElements
    || !themeId
    || !isWallpaper(value.wallpaper)
    || !isTaskbarAlignment(taskbarAlignment)
  ) {
    return null;
  }
  return {
    version: 1,
    pinnedNative,
    pinnedElements,
    themeId,
    wallpaper: value.wallpaper,
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
    wallpaper: preferences.wallpaper,
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
      await this.fs.setMetadata(rootId, { [SHELL_PREFERENCES_KEY]: preferenceMetadataValue(checked) });
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
