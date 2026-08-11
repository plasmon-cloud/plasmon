import type { PlasmonApp, PlatformMode, PlasmonTile } from "./types.ts";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function parseInstalledAppIds(value: unknown): Array<{
  id: string;
  description: string;
}> {
  const root = record(value);
  if (!root || !Array.isArray(root.apps)) {
    throw new Error("Kernel returned an invalid apps.list response");
  }

  return root.apps.map((entry) => {
    const item = record(entry);
    if (!item || typeof item.id !== "string" || typeof item.description !== "string") {
      throw new Error("Kernel returned invalid installed app metadata");
    }
    return { id: item.id, description: item.description };
  });
}

export function parseAppDescription(
  value: unknown,
  fallbackDescription: string,
): PlasmonApp {
  const app = record(value);
  if (!app || typeof app.id !== "string" || typeof app.name !== "string") {
    throw new Error("Kernel returned an invalid apps.describe response");
  }
  if (!Array.isArray(app.tiles)) {
    throw new Error("Kernel app description is missing tiles");
  }

  const tiles: PlasmonTile[] = app.tiles.map((entry) => {
    const tile = record(entry);
    if (!tile || typeof tile.id !== "string" || typeof tile.title !== "string") {
      throw new Error("Kernel returned invalid tile metadata");
    }
    const description = text(tile.description);
    return {
      id: tile.id,
      title: tile.title,
      ...(description ? { description } : {}),
    };
  });

  const description = text(app.description, fallbackDescription);
  const version =
    typeof app.version === "number" && Number.isSafeInteger(app.version)
      ? app.version
      : undefined;
  const tray = record(app.tray);
  const trayTitle = text(tray?.title);

  return {
    id: app.id,
    name: app.name,
    description,
    ...(version === undefined ? {} : { version }),
    tiles,
    ...(trayTitle ? { tray: { title: trayTitle } } : {}),
  };
}

export function parseLiveAppIds(value: unknown): Set<string> {
  const root = record(value);
  if (!root || !Array.isArray(root.endpoints)) return new Set();
  const result = new Set<string>();
  for (const entry of root.endpoints) {
    const endpoint = record(entry);
    if (
      endpoint?.role === "tile" &&
      typeof endpoint.appId === "string" &&
      endpoint.appId !== "plasmon" &&
      endpoint.appId !== "kernel"
    ) {
      result.add(endpoint.appId);
    }
  }
  return result;
}

export function toolNames(value: unknown): Set<string> {
  if (!Array.isArray(value)) throw new Error("Kernel returned an invalid tool list");
  const names = new Set<string>();
  for (const entry of value) {
    const tool = record(entry);
    if (tool && typeof tool.name === "string") names.add(tool.name);
  }
  return names;
}

export function modeFromTools(tools: ReadonlySet<string>): PlatformMode {
  return tools.has("apps.catalog") && tools.has("apps.allocate")
    ? "tenant-capable"
    : "neutron";
}

export function normalizePackageUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid package URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Package URLs must use HTTP or HTTPS.");
  }
  if (!parsed.pathname.toLowerCase().endsWith(".neutron")) {
    throw new Error("The package URL must end in .neutron.");
  }
  return parsed.href;
}
