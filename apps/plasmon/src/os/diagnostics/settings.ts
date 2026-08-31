import type { FsNode, FsService, JsonValue, NodeId } from "../contracts/index.ts";
import type { DiagnosticLevel } from "./service.ts";

export const DIAGNOSTIC_SETTINGS_KEY = "plasmon.diagnostics.settings.v1";

export const DIAGNOSTIC_LEVELS = [
  "debug",
  "info",
  "notice",
  "warn",
  "error",
  "critical",
] as const satisfies readonly DiagnosticLevel[];

export interface DiagnosticSettingsCapabilities {
  remoteReporting: boolean;
}

export interface DiagnosticSettings {
  version: 1;
  fileMinLevel: DiagnosticLevel;
  consoleMinLevel: DiagnosticLevel;
  /** Present only when this build actually includes a remote incident sink. */
  remoteReportingEnabled?: boolean;
}

/**
 * Safe defaults for missing or invalid persisted diagnostic settings.
 * Local diagnostics remain useful by default while browser-console noise stays bounded.
 * Remote reporting, when the build supports it, defaults off.
 */
export const DEFAULT_FILE_MIN_LEVEL: DiagnosticLevel = "info";
export const DEFAULT_CONSOLE_MIN_LEVEL: DiagnosticLevel = "warn";
export const DEFAULT_REMOTE_REPORTING_ENABLED = false;

export function resolveDiagnosticSettingsCapabilities(options: {
  slimProfile: boolean;
  remoteIncidentSinkAvailable: boolean;
}): DiagnosticSettingsCapabilities {
  return {
    remoteReporting: !options.slimProfile && options.remoteIncidentSinkAvailable,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDiagnosticLevel(value: unknown): value is DiagnosticLevel {
  return typeof value === "string" && (DIAGNOSTIC_LEVELS as readonly string[]).includes(value);
}

export function normalizeDiagnosticSettings(
  value: unknown,
  capabilities: DiagnosticSettingsCapabilities,
): DiagnosticSettings {
  const record = isRecord(value) && value.version === 1 ? value : {};
  return {
    version: 1,
    fileMinLevel: isDiagnosticLevel(record.fileMinLevel)
      ? record.fileMinLevel
      : DEFAULT_FILE_MIN_LEVEL,
    consoleMinLevel: isDiagnosticLevel(record.consoleMinLevel)
      ? record.consoleMinLevel
      : DEFAULT_CONSOLE_MIN_LEVEL,
    ...(capabilities.remoteReporting
      ? {
          remoteReportingEnabled: typeof record.remoteReportingEnabled === "boolean"
            ? record.remoteReportingEnabled
            : DEFAULT_REMOTE_REPORTING_ENABLED,
        }
      : {}),
  };
}

function cloneDiagnosticSettings(settings: DiagnosticSettings): DiagnosticSettings {
  return {
    version: 1,
    fileMinLevel: settings.fileMinLevel,
    consoleMinLevel: settings.consoleMinLevel,
    ...(settings.remoteReportingEnabled === undefined
      ? {}
      : { remoteReportingEnabled: settings.remoteReportingEnabled }),
  };
}

function metadataValue(settings: DiagnosticSettings): JsonValue {
  return cloneDiagnosticSettings(settings) as unknown as JsonValue;
}

function requireRoot(root: FsNode | null): FsNode {
  if (!root) throw new Error("Filesystem root is unavailable");
  if (root.kind !== "directory") throw new Error("Filesystem root is not a directory");
  return root;
}

/**
 * Canonical persisted diagnostic sink policy. The filesystem root metadata is
 * the existing OS preferences authority; Settings only consumes this store.
 */
export class DiagnosticSettingsStore {
  private rootId: NodeId | null = null;
  private snapshot: DiagnosticSettings;
  private loadPromise: Promise<DiagnosticSettings> | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(settings: DiagnosticSettings) => void>();

  constructor(
    private readonly fs: FsService,
    private readonly capabilities: DiagnosticSettingsCapabilities = { remoteReporting: false },
  ) {
    this.snapshot = normalizeDiagnosticSettings(undefined, capabilities);
  }

  getCapabilities(): DiagnosticSettingsCapabilities {
    return { remoteReporting: this.capabilities.remoteReporting };
  }

  getSnapshot(): DiagnosticSettings {
    return cloneDiagnosticSettings(this.snapshot);
  }

  subscribe(listener: (settings: DiagnosticSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  load(): Promise<DiagnosticSettings> {
    if (this.loadPromise) return this.loadPromise.then(() => this.getSnapshot());
    this.loadPromise = this.loadOnce().catch((error) => {
      this.loadPromise = null;
      throw error;
    });
    return this.loadPromise;
  }

  setFileMinLevel(fileMinLevel: DiagnosticLevel): Promise<void> {
    return this.update((current) => ({ ...current, fileMinLevel }));
  }

  setConsoleMinLevel(consoleMinLevel: DiagnosticLevel): Promise<void> {
    return this.update((current) => ({ ...current, consoleMinLevel }));
  }

  setRemoteReportingEnabled(remoteReportingEnabled: boolean): Promise<void> {
    if (!this.capabilities.remoteReporting) {
      return Promise.reject(new Error("Remote diagnostic reporting is unavailable in this build"));
    }
    return this.update((current) => ({ ...current, remoteReportingEnabled }));
  }

  private async loadOnce(): Promise<DiagnosticSettings> {
    const root = requireRoot(await this.fs.resolvePath("/"));
    this.rootId = root.id;
    this.snapshot = normalizeDiagnosticSettings(root.metadata[DIAGNOSTIC_SETTINGS_KEY], this.capabilities);
    this.emit();
    return this.getSnapshot();
  }

  private update(mutator: (current: DiagnosticSettings) => DiagnosticSettings): Promise<void> {
    const write = async (): Promise<void> => {
      const rootId = await this.resolveRootId();
      const next = normalizeDiagnosticSettings(mutator(this.snapshot), this.capabilities);
      await this.fs.setMetadata(rootId, { [DIAGNOSTIC_SETTINGS_KEY]: metadataValue(next) });
      this.snapshot = next;
      this.emit();
    };
    const operation = this.writeChain.then(write);
    this.writeChain = operation.catch(() => undefined);
    return operation;
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private async resolveRootId(): Promise<NodeId> {
    if (this.rootId) return this.rootId;
    const root = requireRoot(await this.fs.resolvePath("/"));
    this.rootId = root.id;
    return root.id;
  }
}
