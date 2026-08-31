import type { FsNode, FsService, OpenTarget } from "../../os/contracts/index.ts";

export const SETTINGS_DESTINATION_IDS = [
  "home",
  "personalization",
  "taskbar",
  "files",
  "storage",
  "diagnostics",
] as const;

export type SettingsDestinationId = (typeof SETTINGS_DESTINATION_IDS)[number];

export interface SettingsSectionDefinition {
  id: SettingsDestinationId;
  label: string;
  heading: string;
}

export const DEFAULT_SETTINGS_DESTINATION: SettingsDestinationId = "home";
export const SETTINGS_DESTINATION_URL_PREFIX = "plasmon-settings:";

export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
  { id: "home", label: "Home", heading: "Settings" },
  { id: "personalization", label: "Personalization", heading: "Personalization" },
  { id: "taskbar", label: "Taskbar", heading: "Taskbar" },
  { id: "files", label: "Files & Explorer", heading: "Files & Explorer" },
  { id: "storage", label: "Storage", heading: "Storage" },
  { id: "diagnostics", label: "Diagnostics", heading: "Diagnostics" },
] as const;

const settingsDestinationSet = new Set<string>(SETTINGS_DESTINATION_IDS);

export function normalizeSettingsDestination(value: unknown): SettingsDestinationId {
  return typeof value === "string" && settingsDestinationSet.has(value)
    ? value as SettingsDestinationId
    : DEFAULT_SETTINGS_DESTINATION;
}

export function settingsDestinationFromTarget(target: OpenTarget): SettingsDestinationId {
  const destination = target.url?.startsWith(SETTINGS_DESTINATION_URL_PREFIX)
    ? target.url.slice(SETTINGS_DESTINATION_URL_PREFIX.length)
    : undefined;
  return normalizeSettingsDestination(destination);
}

export function createSettingsOpenTarget(
  destination: SettingsDestinationId = DEFAULT_SETTINGS_DESTINATION,
): OpenTarget {
  return { url: `${SETTINGS_DESTINATION_URL_PREFIX}${destination}` };
}

export function withSettingsDestination(
  target: OpenTarget,
  destination: SettingsDestinationId,
): OpenTarget {
  return { ...target, url: `${SETTINGS_DESTINATION_URL_PREFIX}${destination}` };
}

export interface StorageSummary {
  files: number;
  directories: number;
  bytes: number;
  unavailableReason?: string;
}

export async function summarizeStorage(fs: FsService, startId?: string): Promise<StorageSummary> {
  try {
    const root = startId ? await fs.stat(startId) : await fs.resolvePath("/");
    if (!root) {
      return { files: 0, directories: 0, bytes: 0, unavailableReason: "Filesystem root is unavailable" };
    }
    let files = 0;
    let directories = 0;
    let bytes = 0;
    const pending: FsNode[] = [root];
    while (pending.length) {
      const node = pending.pop()!;
      if (node.kind === "directory") {
        directories += 1;
        pending.push(...await fs.list(node.id));
      } else {
        files += 1;
        bytes += node.size;
      }
    }
    return { files, directories, bytes };
  } catch (error) {
    return {
      files: 0,
      directories: 0,
      bytes: 0,
      unavailableReason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unit]}`;
}
