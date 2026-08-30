import type { FsEvent, FsEventSource, FsService, JsonValue, NodeId } from "../../os/contracts/index.ts";
import type { ProgramFilesService } from "../../os/fs/index.ts";

export const MONACO_RUNTIME_CONFIG_SCHEMA = "plasmon.monaco-runtime-config-v1" as const;
export const MONACO_RUNTIME_CONFIG_RUNTIME_NAME = "MonacoEditor";
export const MONACO_RUNTIME_CONFIG_FILE_NAME = "config.json";
export const MONACO_RUNTIME_CONFIG_PATH = "/System/Program Files/MonacoEditor/config.json";
export const MONACO_RUNTIME_CONFIG_METADATA_KEY = "plasmon.monacoRuntimeConfig";

export interface MonacoRuntimeConfigSnapshot {
  readonly schema: typeof MONACO_RUNTIME_CONFIG_SCHEMA;
  readonly editor: Readonly<{
    minimap: Readonly<{
      enabled: boolean;
    }>;
  }>;
}

export type MonacoRuntimeConfigDiagnosticCode =
  | "malformed-json"
  | "invalid-root"
  | "unsupported-schema"
  | "invalid-minimap-enabled"
  | "filesystem-read-failed"
  | "filesystem-write-failed";

export interface MonacoRuntimeConfigDiagnostic {
  readonly code: MonacoRuntimeConfigDiagnosticCode;
  readonly message: string;
}

export interface ParsedMonacoRuntimeConfig {
  readonly accepted: boolean;
  readonly snapshot: MonacoRuntimeConfigSnapshot;
  readonly diagnostics: readonly MonacoRuntimeConfigDiagnostic[];
  readonly document: Record<string, unknown> | null;
}

export interface MonacoRuntimeConfigServiceOptions {
  fs: FsService;
  fsEvents: FsEventSource;
  programFiles: ProgramFilesService;
  onDiagnostic: (diagnostic: MonacoRuntimeConfigDiagnostic) => void;
}

export interface MonacoRuntimeConfigStore {
  readonly ready: Promise<void>;
  getSnapshot(): MonacoRuntimeConfigSnapshot;
  subscribe(listener: () => void): () => void;
  setMinimapEnabled(enabled: boolean): Promise<void>;
  restoreDefaults(): Promise<void>;
  dispose(): void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function makeSnapshot(minimapEnabled = true): MonacoRuntimeConfigSnapshot {
  return Object.freeze({
    schema: MONACO_RUNTIME_CONFIG_SCHEMA,
    editor: Object.freeze({
      minimap: Object.freeze({ enabled: minimapEnabled }),
    }),
  });
}

export const DEFAULT_MONACO_RUNTIME_CONFIG = makeSnapshot(true);
export const DEFAULT_MONACO_RUNTIME_CONFIG_TEXT = `${JSON.stringify(DEFAULT_MONACO_RUNTIME_CONFIG, null, 2)}\n`;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function diagnostic(
  code: MonacoRuntimeConfigDiagnosticCode,
  message: string,
): MonacoRuntimeConfigDiagnostic {
  return Object.freeze({ code, message });
}

export function parseMonacoRuntimeConfigText(text: string): ParsedMonacoRuntimeConfig {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      accepted: false,
      snapshot: DEFAULT_MONACO_RUNTIME_CONFIG,
      diagnostics: [diagnostic("malformed-json", "Monaco runtime configuration is not valid JSON")],
      document: null,
    };
  }

  const root = record(value);
  if (!root) {
    return {
      accepted: false,
      snapshot: DEFAULT_MONACO_RUNTIME_CONFIG,
      diagnostics: [diagnostic("invalid-root", "Monaco runtime configuration must be a JSON object")],
      document: null,
    };
  }

  if (root.schema !== MONACO_RUNTIME_CONFIG_SCHEMA) {
    return {
      accepted: false,
      snapshot: DEFAULT_MONACO_RUNTIME_CONFIG,
      diagnostics: [diagnostic(
        "unsupported-schema",
        `Unsupported Monaco runtime configuration schema: ${typeof root.schema === "string" ? root.schema : "<missing>"}`,
      )],
      document: root,
    };
  }

  const diagnostics: MonacoRuntimeConfigDiagnostic[] = [];
  const editor = record(root.editor);
  const minimap = record(editor?.minimap);
  const rawEnabled = minimap?.enabled;
  let enabled = DEFAULT_MONACO_RUNTIME_CONFIG.editor.minimap.enabled;
  if (rawEnabled !== undefined) {
    if (typeof rawEnabled === "boolean") {
      enabled = rawEnabled;
    } else {
      diagnostics.push(diagnostic(
        "invalid-minimap-enabled",
        "Monaco runtime configuration editor.minimap.enabled must be boolean; using the default value",
      ));
    }
  }

  return {
    accepted: true,
    snapshot: makeSnapshot(enabled),
    diagnostics,
    document: root,
  };
}

function sameSnapshot(left: MonacoRuntimeConfigSnapshot, right: MonacoRuntimeConfigSnapshot): boolean {
  return left.editor.minimap.enabled === right.editor.minimap.enabled;
}

function setMinimapInDocument(document: Record<string, unknown>, enabled: boolean): Record<string, unknown> {
  const next = structuredClone(document);
  const editor = record(next.editor) ?? {};
  const minimap = record(editor.minimap) ?? {};
  minimap.enabled = enabled;
  editor.minimap = minimap;
  next.editor = editor;
  return next;
}

function serializedDocument(document: Record<string, unknown>): Uint8Array {
  return encoder.encode(`${JSON.stringify(document, null, 2)}\n`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Monaco owns this schema and effective runtime snapshot. Filesystem remains the
 * durable byte/identity authority and Program Files remains the privileged
 * create-if-missing location authority.
 */
export class MonacoRuntimeConfigService implements MonacoRuntimeConfigStore {
  private snapshot = DEFAULT_MONACO_RUNTIME_CONFIG;
  private lastKnownGood: MonacoRuntimeConfigSnapshot | null = null;
  private fileId: NodeId | null = null;
  private runtimeDirectoryId: NodeId | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly stopFsEvents: () => void;
  private reloadTail: Promise<void> = Promise.resolve();
  private disposed = false;
  private lastDiagnosticKey: string | null = null;
  readonly ready: Promise<void>;

  constructor(private readonly options: MonacoRuntimeConfigServiceOptions) {
    this.stopFsEvents = options.fsEvents.subscribe((event) => {
      if (this.disposed || !this.isRelevantEvent(event)) return;
      void this.scheduleReload(false);
    });
    this.ready = this.scheduleReload(true);
  }

  readonly getSnapshot = (): MonacoRuntimeConfigSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async setMinimapEnabled(enabled: boolean): Promise<void> {
    await this.ready;
    try {
      const file = await this.ensureFile();
      const text = decoder.decode(await this.options.fs.read(file.id));
      const parsed = parseMonacoRuntimeConfigText(text);
      this.reportDiagnostics(parsed.diagnostics);
      if (!parsed.accepted || !parsed.document) return;

      const next = setMinimapInDocument(parsed.document, enabled);
      await this.options.fs.write(file.id, serializedDocument(next), { truncate: true });
      await this.scheduleReload(false);
    } catch (error) {
      this.report(diagnostic(
        "filesystem-write-failed",
        `Unable to update Monaco runtime configuration: ${errorMessage(error)}`,
      ));
    }
  }

  async restoreDefaults(): Promise<void> {
    await this.ready;
    try {
      const file = await this.ensureFile();
      await this.options.fs.write(file.id, encoder.encode(DEFAULT_MONACO_RUNTIME_CONFIG_TEXT), { truncate: true });
      await this.scheduleReload(false);
    } catch (error) {
      this.report(diagnostic(
        "filesystem-write-failed",
        `Unable to restore Monaco runtime configuration defaults: ${errorMessage(error)}`,
      ));
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopFsEvents();
    this.listeners.clear();
  }

  private scheduleReload(coldStart: boolean): Promise<void> {
    const next = this.reloadTail.then(() => this.reload(coldStart));
    this.reloadTail = next.catch(() => undefined);
    return next;
  }

  private async ensureFile() {
    const file = await this.options.programFiles.ensureRuntimeFile(
      MONACO_RUNTIME_CONFIG_RUNTIME_NAME,
      MONACO_RUNTIME_CONFIG_FILE_NAME,
      {
        initialBytes: encoder.encode(DEFAULT_MONACO_RUNTIME_CONFIG_TEXT),
        mime: "application/json",
        metadata: {
          [MONACO_RUNTIME_CONFIG_METADATA_KEY]: {
            format: "plasmon.monaco-runtime-config",
            version: 1,
          } satisfies JsonValue,
        },
      },
    );
    this.fileId = file.id;
    this.runtimeDirectoryId = file.parentId;
    return file;
  }

  private async reload(coldStart: boolean): Promise<void> {
    if (this.disposed) return;
    try {
      const file = await this.ensureFile();
      const text = decoder.decode(await this.options.fs.read(file.id));
      const parsed = parseMonacoRuntimeConfigText(text);
      this.reportDiagnostics(parsed.diagnostics);
      if (parsed.accepted) {
        this.lastKnownGood = parsed.snapshot;
        this.publish(parsed.snapshot);
        if (parsed.diagnostics.length === 0) this.lastDiagnosticKey = null;
        return;
      }
      this.publish(this.lastKnownGood ?? DEFAULT_MONACO_RUNTIME_CONFIG);
    } catch (error) {
      this.report(diagnostic(
        "filesystem-read-failed",
        `Unable to read Monaco runtime configuration: ${errorMessage(error)}`,
      ));
      if (coldStart || !this.lastKnownGood) this.publish(DEFAULT_MONACO_RUNTIME_CONFIG);
    }
  }

  private publish(next: MonacoRuntimeConfigSnapshot): void {
    if (sameSnapshot(this.snapshot, next)) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private reportDiagnostics(diagnostics: readonly MonacoRuntimeConfigDiagnostic[]): void {
    for (const item of diagnostics) this.report(item);
  }

  private report(item: MonacoRuntimeConfigDiagnostic): void {
    const key = `${item.code}:${item.message}`;
    if (key === this.lastDiagnosticKey) return;
    this.lastDiagnosticKey = key;
    this.options.onDiagnostic(item);
  }

  private isRelevantEvent(event: FsEvent): boolean {
    if (event.type === "reset") return true;
    if (!this.fileId || !this.runtimeDirectoryId) return true;

    if (event.type === "removed") {
      return event.id === this.fileId || event.parentId === this.runtimeDirectoryId;
    }

    if (event.node.id === this.fileId) return true;
    if (event.node.parentId === this.runtimeDirectoryId
      && event.node.name.toLocaleLowerCase() === MONACO_RUNTIME_CONFIG_FILE_NAME.toLocaleLowerCase()) {
      return true;
    }
    return event.type === "moved" && event.oldParentId === this.runtimeDirectoryId;
  }
}