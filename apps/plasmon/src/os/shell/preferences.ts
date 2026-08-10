export const SHELL_PREFERENCES_KEY = "plasmon.shell.preferences.v1";

export const SHELL_THEME_IDS = ["plasmon-dark", "plasmon-midnight"] as const;
export type ShellThemeId = (typeof SHELL_THEME_IDS)[number];

export const SHELL_WALLPAPERS = ["aurora", "plain"] as const;
export type ShellWallpaper = (typeof SHELL_WALLPAPERS)[number];

export interface ShellPreferences {
  version: 1;
  pinnedNative: string[];
  pinnedElements: string[];
  themeId: ShellThemeId;
  wallpaper: ShellWallpaper;
}

export interface ShellStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_SHELL_PREFERENCES: ShellPreferences = Object.freeze({
  version: 1,
  pinnedNative: [],
  pinnedElements: [],
  themeId: "plasmon-dark",
  wallpaper: "aurora",
});

function cloneDefaults(): ShellPreferences {
  return {
    version: 1,
    pinnedNative: [],
    pinnedElements: [],
    themeId: DEFAULT_SHELL_PREFERENCES.themeId,
    wallpaper: DEFAULT_SHELL_PREFERENCES.wallpaper,
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

function isWallpaper(value: unknown): value is ShellWallpaper {
  return typeof value === "string" && (SHELL_WALLPAPERS as readonly string[]).includes(value);
}

export function validateShellPreferences(value: unknown): ShellPreferences | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const pinnedNative = stringList(value.pinnedNative);
  const pinnedElements = stringList(value.pinnedElements);
  if (!pinnedNative || !pinnedElements || !isTheme(value.themeId) || !isWallpaper(value.wallpaper)) {
    return null;
  }
  return {
    version: 1,
    pinnedNative,
    pinnedElements,
    themeId: value.themeId,
    wallpaper: value.wallpaper,
  };
}

export function parseShellPreferences(serialized: string): ShellPreferences | null {
  try {
    return validateShellPreferences(JSON.parse(serialized) as unknown);
  } catch {
    return null;
  }
}

export function safeBrowserStorage(): ShellStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    // Accessing localStorage can itself throw in sandboxed/private contexts.
    void storage.length;
    return storage;
  } catch {
    return null;
  }
}

export class ShellPreferenceStore {
  constructor(private readonly storage: ShellStorage | null = safeBrowserStorage()) {}

  load(): ShellPreferences {
    if (!this.storage) return cloneDefaults();
    try {
      const raw = this.storage.getItem(SHELL_PREFERENCES_KEY);
      if (raw === null) return cloneDefaults();
      return parseShellPreferences(raw) ?? cloneDefaults();
    } catch {
      return cloneDefaults();
    }
  }

  save(preferences: ShellPreferences): boolean {
    const checked = validateShellPreferences(preferences);
    if (!checked || !this.storage) return false;
    try {
      this.storage.setItem(SHELL_PREFERENCES_KEY, JSON.stringify(checked));
      return true;
    } catch {
      return false;
    }
  }
}

export function togglePinned(values: readonly string[], id: string): string[] {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}
