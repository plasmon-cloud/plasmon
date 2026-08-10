import {
  describeApp,
  listApps,
  listEndpoints,
  offerAppInstall,
  openAppTile,
} from "neutron-tools/app";
import type { ExternalElement, NeutronBridge } from "../contracts/neutron.ts";
import { resolveElementIcon } from "./icon-resolver.ts";
import {
  subscribeForegroundRefresh,
  type ForegroundLifecycleTargets,
} from "./lifecycle.ts";
import {
  cloneExternalElements,
  type ElementIconResolver,
  type InstalledElementHint,
  type RuntimeSnapshot,
  type VanillaNeutronApi,
} from "./types.ts";

const SYSTEM_APP_IDS = new Set(["kernel", "plasmon"]);

const defaultApi: VanillaNeutronApi = {
  listApps,
  describeApp,
  listEndpoints,
  openAppTile,
  offerAppInstall,
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function fallbackDescription(hint: InstalledElementHint): string {
  return hint.description || "Installed Neutron application.";
}

export function parseInstalledElementHints(value: unknown): InstalledElementHint[] {
  const root = record(value);
  if (!root || !Array.isArray(root.apps)) {
    throw new Error("Kernel returned an invalid apps.list response");
  }

  const result: InstalledElementHint[] = [];
  const seen = new Set<string>();
  for (const entry of root.apps) {
    const item = record(entry);
    const id = text(item?.id).trim();
    if (!id || seen.has(id) || SYSTEM_APP_IDS.has(id)) continue;
    seen.add(id);
    result.push({ id, description: text(item?.description) });
  }
  return result;
}

export function parseRuntimeSnapshot(value: unknown): RuntimeSnapshot {
  const root = record(value);
  if (!root || !Array.isArray(root.endpoints)) {
    return { known: false, liveAppIds: new Set() };
  }

  const liveAppIds = new Set<string>();
  for (const entry of root.endpoints) {
    const endpoint = record(entry);
    if (
      endpoint?.role === "tile"
      && typeof endpoint.appId === "string"
      && !SYSTEM_APP_IDS.has(endpoint.appId)
    ) {
      liveAppIds.add(endpoint.appId);
    }
  }
  return { known: true, liveAppIds };
}

function parseTiles(value: unknown): Array<{ id: string; title: string }> {
  if (!Array.isArray(value)) return [];
  const tiles: Array<{ id: string; title: string }> = [];
  for (const entry of value) {
    const tile = record(entry);
    if (!tile || typeof tile.id !== "string" || typeof tile.title !== "string") continue;
    tiles.push({ id: tile.id, title: tile.title });
  }
  return tiles;
}

function parseTray(value: unknown): ExternalElement["tray"] | undefined {
  const tray = record(value);
  if (!tray || typeof tray.title !== "string") return undefined;
  return { title: tray.title };
}

function runningState(appId: string, runtime: RuntimeSnapshot): ExternalElement["running"] {
  if (!runtime.known) return "unknown";
  return runtime.liveAppIds.has(appId) ? "yes" : "no";
}

export function parseExternalElement(
  value: unknown,
  hint: InstalledElementHint,
  runtime: RuntimeSnapshot,
  icon?: string,
): ExternalElement {
  const app = record(value);
  if (!app || app.id !== hint.id || typeof app.name !== "string") {
    return {
      id: hint.id,
      name: hint.id,
      description: fallbackDescription(hint),
      ...(icon ? { icon } : {}),
      tiles: [],
      running: runningState(hint.id, runtime),
    };
  }

  const version = typeof app.version === "number" && Number.isSafeInteger(app.version)
    ? app.version
    : undefined;
  const description = text(app.description, fallbackDescription(hint));
  const tray = parseTray(app.tray);

  return {
    id: hint.id,
    name: app.name,
    description,
    ...(version === undefined ? {} : { version }),
    ...(icon ? { icon } : {}),
    ...(tray === undefined ? {} : { tray }),
    tiles: parseTiles(app.tiles),
    running: runningState(hint.id, runtime),
  };
}

export interface VanillaNeutronBridgeOptions {
  api?: VanillaNeutronApi;
  resolveIcon?: ElementIconResolver;
  lifecycleTargets?: ForegroundLifecycleTargets;
}

/**
 * Vanilla-Neutron adapter. Launching always delegates to workspace.open_tile;
 * this class never obtains or embeds a Neutron application frame itself.
 */
export class VanillaNeutronBridge implements NeutronBridge {
  readonly mode = "neutron" as const;

  private readonly api: VanillaNeutronApi;
  private readonly resolveIcon: ElementIconResolver;
  private readonly lifecycleTargets: ForegroundLifecycleTargets | undefined;
  private elements: ExternalElement[] = [];
  private readonly listeners = new Set<() => void>();
  private stopLifecycle: (() => void) | undefined;

  constructor(options: VanillaNeutronBridgeOptions = {}) {
    this.api = options.api ?? defaultApi;
    this.resolveIcon = options.resolveIcon ?? resolveElementIcon;
    this.lifecycleTargets = options.lifecycleTargets;
  }

  async loadElements(): Promise<ExternalElement[]> {
    const [listed, runtime] = await Promise.all([
      this.api.listApps(),
      this.readRuntimeSnapshot(),
    ]);
    const hints = parseInstalledElementHints(listed);

    const elements = await Promise.all(
      hints.map(async (hint): Promise<ExternalElement> => {
        const icon = this.resolveIcon(hint.id);
        try {
          return parseExternalElement(
            await this.api.describeApp(hint.id),
            hint,
            runtime,
            icon,
          );
        } catch {
          return parseExternalElement(null, hint, runtime, icon);
        }
      }),
    );

    elements.sort((left, right) => left.name.localeCompare(right.name));
    this.elements = elements;
    return cloneExternalElements(elements);
  }

  async openElement(
    appId: string,
    options: { tileId?: string; view?: string } = {},
  ): Promise<void> {
    let element = this.elements.find((candidate) => candidate.id === appId);
    if (!element) {
      element = (await this.loadElements()).find((candidate) => candidate.id === appId);
    }
    if (!element) throw new Error(`Unknown Neutron Element: ${appId}`);

    const tile = options.tileId
      ? element.tiles.find((candidate) => candidate.id === options.tileId)
      : element.tiles[0];
    if (!tile) {
      const detail = options.tileId ? ` tile ${options.tileId}` : " a launchable tile";
      throw new Error(`${element.name} does not expose${detail}`);
    }

    await this.api.openAppTile({
      appId: element.id,
      tileId: tile.id,
      reuseExisting: true,
      ...(options.view === undefined ? {} : { view: options.view }),
    });

    // Opening succeeded even if the snapshot endpoint is temporarily unavailable.
    await this.refreshRuntimeState();
  }

  async offerInstall(url: string): Promise<void> {
    await this.api.offerAppInstall({ kind: "package_url", url });
  }

  async refreshRuntimeState(): Promise<void> {
    if (this.elements.length === 0) {
      try {
        await this.loadElements();
      } finally {
        this.emit();
      }
      return;
    }

    const runtime = await this.readRuntimeSnapshot();
    this.elements = this.elements.map((element) => ({
      ...element,
      tiles: element.tiles.map((tile) => ({ ...tile })),
      running: runningState(element.id, runtime),
    }));
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.startLifecycleRefresh();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopLifecycleRefresh();
    };
  }

  private async readRuntimeSnapshot(): Promise<RuntimeSnapshot> {
    try {
      return parseRuntimeSnapshot(await this.api.listEndpoints());
    } catch {
      return { known: false, liveAppIds: new Set() };
    }
  }

  private startLifecycleRefresh(): void {
    if (this.stopLifecycle) return;
    this.stopLifecycle = subscribeForegroundRefresh(() => {
      void this.refreshRuntimeState().catch(() => {
        // Lifecycle refresh is best effort; explicit calls still report discovery errors.
      });
    }, this.lifecycleTargets);
  }

  private stopLifecycleRefresh(): void {
    this.stopLifecycle?.();
    this.stopLifecycle = undefined;
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // One subscriber cannot prevent other shell/desktop observers from updating.
      }
    }
  }
}
