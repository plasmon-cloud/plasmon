import {
  describeApp,
  listApps,
  listEndpoints,
  offerAppInstall,
  openAppTile,
} from "neutron-tools/app";
import type { ExternalElement, NeutronBridge } from "../contracts/neutron.ts";
import {
  DiagnosticEvent,
  DiagnosticOperation,
  DiagnosticStage,
  type DiagnosticLogger,
} from "../diagnostics/index.ts";
import {
  declaredElementIconPath,
  resolveElementIcon,
} from "./icon-resolver.ts";
import {
  subscribeForegroundRefresh,
  type ForegroundLifecycleTargets,
} from "./lifecycle.ts";
import {
  cloneExternalElement,
  cloneExternalElements,
  type ElementIconResolver,
  type InstalledElementHint,
  type RuntimeSnapshot,
  type VanillaNeutronApi,
} from "./types.ts";

const SYSTEM_APP_IDS = new Set(["kernel", "plasmon"]);
const UNKNOWN_RUNTIME: RuntimeSnapshot = { known: false, liveAppIds: new Set() };

const defaultApi: VanillaNeutronApi = {
  listApps,
  describeApp,
  listEndpoints,
  openAppTile,
  offerAppInstall,
};

function errorType(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return error === null ? "null" : typeof error;
}

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

function withRuntimeState(
  element: ExternalElement,
  runtime: RuntimeSnapshot,
): ExternalElement {
  const clone = cloneExternalElement(element);
  clone.running = runningState(element.id, runtime);
  return clone;
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
  diagnosticLogger?: DiagnosticLogger;
}

type CachedElementMetadata = {
  discoveryDescription: string;
  element: ExternalElement;
};

type PendingElementMetadata = {
  discoveryDescription: string;
  promise: Promise<ExternalElement>;
};

/**
 * Vanilla-Neutron adapter. Launching always delegates to workspace.open_tile;
 * this class never obtains or embeds a Neutron application frame itself.
 */
export class VanillaNeutronBridge implements NeutronBridge {
  readonly mode = "neutron" as const;

  private readonly api: VanillaNeutronApi;
  private readonly resolveIcon: ElementIconResolver;
  private readonly lifecycleTargets: ForegroundLifecycleTargets | undefined;
  private readonly log: DiagnosticLogger | null;
  private elements: ExternalElement[] = [];
  private readonly metadataCache = new Map<string, CachedElementMetadata>();
  private readonly metadataLoads = new Map<string, PendingElementMetadata>();
  private readonly listeners = new Set<() => void>();
  private stopLifecycle: (() => void) | undefined;

  constructor(options: VanillaNeutronBridgeOptions = {}) {
    this.api = options.api ?? defaultApi;
    this.resolveIcon = options.resolveIcon ?? resolveElementIcon;
    this.lifecycleTargets = options.lifecycleTargets;
    this.log = options.diagnosticLogger ?? null;
  }

  async loadElements(): Promise<ExternalElement[]> {
    let listed: unknown;
    let runtime: RuntimeSnapshot;
    try {
      [listed, runtime] = await Promise.all([
        this.api.listApps(),
        this.readRuntimeSnapshot(),
      ]);
    } catch (error) {
      this.log?.error(DiagnosticEvent.Neutron.DiscoveryFailed, {
        message: "Neutron application discovery failed",
        operation: DiagnosticOperation.Discover,
        stage: DiagnosticStage.Discovery,
        errorType: errorType(error),
      });
      throw error;
    }

    let hints: InstalledElementHint[];
    try {
      hints = parseInstalledElementHints(listed);
    } catch (error) {
      this.log?.error(DiagnosticEvent.Neutron.DiscoveryInvalid, {
        message: "Neutron application discovery returned an invalid response",
        operation: DiagnosticOperation.Discover,
        stage: DiagnosticStage.Parse,
        errorType: errorType(error),
      });
      throw error;
    }
    this.pruneMetadataCache(hints);

    const elements = await Promise.all(
      hints.map((hint) => this.loadElementMetadata(hint, runtime)),
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
    if (!element) {
      this.log?.error(DiagnosticEvent.Neutron.OpenInvalid, {
        message: "Neutron Element is not installed",
        appId,
        stage: DiagnosticStage.ElementLookup,
      });
      throw new Error(`Unknown Neutron Element: ${appId}`);
    }

    const tile = options.tileId
      ? element.tiles.find((candidate) => candidate.id === options.tileId)
      : element.tiles[0];
    if (!tile) {
      this.log?.error(DiagnosticEvent.Neutron.OpenInvalid, {
        message: "Neutron Element does not expose the requested launch tile",
        appId: element.id,
        stage: DiagnosticStage.TileSelection,
        ...(element.version === undefined ? {} : { appVersion: element.version }),
      });
      const detail = options.tileId ? ` tile ${options.tileId}` : " a launchable tile";
      throw new Error(`${element.name} does not expose${detail}`);
    }

    try {
      await this.api.openAppTile({
        appId: element.id,
        tileId: tile.id,
        reuseExisting: true,
        ...(options.view === undefined ? {} : { view: options.view }),
      });
    } catch (error) {
      this.log?.error(DiagnosticEvent.Neutron.OpenFailed, {
        message: "Kernel rejected the Neutron Element launch operation",
        operation: DiagnosticOperation.Open,
        stage: DiagnosticStage.KernelOpenTile,
        appId: element.id,
        ...(element.version === undefined ? {} : { appVersion: element.version }),
        errorType: errorType(error),
      });
      throw error;
    }

    // Opening succeeded even if the snapshot endpoint is temporarily unavailable.
    await this.refreshRuntimeState();
  }

  async offerInstall(url: string): Promise<void> {
    try {
      await this.api.offerAppInstall({ kind: "package_url", url });
    } catch (error) {
      this.log?.error(DiagnosticEvent.Neutron.InstallFailed, {
        message: "Kernel rejected a Neutron package install offer",
        operation: DiagnosticOperation.Install,
        stage: DiagnosticStage.KernelInstallOffer,
        errorType: errorType(error),
      });
      throw error;
    }
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
    this.elements = this.elements.map((element) => withRuntimeState(element, runtime));
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

  private async loadElementMetadata(
    hint: InstalledElementHint,
    runtime: RuntimeSnapshot,
  ): Promise<ExternalElement> {
    const cached = this.metadataCache.get(hint.id);
    if (cached && cached.discoveryDescription === hint.description) {
      return withRuntimeState(cached.element, runtime);
    }

    const pending = this.metadataLoads.get(hint.id);
    if (pending && pending.discoveryDescription === hint.description) {
      return withRuntimeState(await pending.promise, runtime);
    }

    const promise = this.resolveElementMetadata(hint);
    this.metadataLoads.set(hint.id, {
      discoveryDescription: hint.description,
      promise,
    });

    try {
      const element = await promise;
      const current = this.metadataLoads.get(hint.id);
      if (current?.promise === promise) {
        this.metadataCache.set(hint.id, {
          discoveryDescription: hint.description,
          element: cloneExternalElement(element),
        });
      }
      return withRuntimeState(element, runtime);
    } finally {
      if (this.metadataLoads.get(hint.id)?.promise === promise) {
        this.metadataLoads.delete(hint.id);
      }
    }
  }

  private async resolveElementMetadata(
    hint: InstalledElementHint,
  ): Promise<ExternalElement> {
    let descriptor: unknown = null;
    try {
      descriptor = await this.api.describeApp(hint.id);
    } catch {
      // A failed descriptor is cached as fallback metadata until discovery
      // identity changes, avoiding repeated failure storms on every reload.
    }

    const declaredPath = declaredElementIconPath(descriptor, hint.id);
    let icon: string | undefined;
    try {
      // A missing safe descriptor path intentionally reaches the resolver:
      // current Kernel apps.describe strips tile/tray icon paths, so the
      // resolver performs only the bounded static/icon.svg compatibility path.
      icon = await this.resolveIcon(hint.id, declaredPath);
    } catch {
      // Icon failure must never hide the Element or poison other metadata.
    }

    return parseExternalElement(descriptor, hint, UNKNOWN_RUNTIME, icon);
  }

  private pruneMetadataCache(hints: readonly InstalledElementHint[]): void {
    const current = new Map(hints.map((hint) => [hint.id, hint.description]));
    for (const [appId, cached] of this.metadataCache) {
      const description = current.get(appId);
      if (description === undefined || description !== cached.discoveryDescription) {
        this.metadataCache.delete(appId);
      }
    }
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
