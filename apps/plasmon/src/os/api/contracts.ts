export type OsResourceKind = "directory" | "file" | "shortcut" | "atom";

/** Stable dependency-light filesystem resource exposed through the production OS API. */
export interface OsResource {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly kind: OsResourceKind;
  readonly size: number;
  readonly mimeType?: string;
}

/** Semantic result of opening one filesystem resource through the canonical dispatcher. */
export interface OpenResult {
  readonly resource: OsResource;
  /** Present when the open operation resolves to a Plasmon-native process. */
  readonly handlerId?: string;
  /** Present when the operation launches or reuses a Plasmon-native process. */
  readonly processId?: string;
  /** Present when the resulting Plasmon-native process owns a window. */
  readonly windowId?: string;
}

export interface OsProcess {
  readonly id: string;
  readonly appId: string;
  readonly handlerId: string;
  readonly title: string;
  readonly state: "starting" | "running" | "closing";
  readonly windowId?: string;
}

export interface OsWindow {
  readonly id: string;
  readonly processId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly minimized: boolean;
  readonly maximized: boolean;
}

export interface OsListOptions {
  readonly includeHidden?: boolean;
}

export interface OsFileSystemApi {
  stat(path: string): Promise<OsResource | null>;
  exists(path: string): Promise<boolean>;
  /** List the direct children of one absolute directory path through normal filesystem semantics. */
  list(path: string, options?: OsListOptions): Promise<readonly OsResource[]>;
  readText(path: string): Promise<string>;
  /** Create or replace one UTF-8 text file through normal filesystem policy. */
  writeText(path: string, content: string): Promise<OsResource>;
  /** Create one directory. The parent must already exist. */
  createDirectory(path: string): Promise<OsResource>;
  /** Copy one resource into an existing destination directory through normal filesystem policy. */
  copy(sourcePath: string, destinationPath: string): Promise<OsResource>;
  /** Move one resource into an existing destination directory through normal filesystem policy. */
  move(sourcePath: string, destinationPath: string): Promise<OsResource>;
  /** Rename one resource in place through normal filesystem policy. */
  rename(path: string, newName: string): Promise<OsResource>;
  /** Perform the normal user-facing removal operation for one resource. */
  remove(path: string): Promise<void>;
}

export interface OsProcessesApi {
  list(): readonly OsProcess[];
}

export interface OsWindowsApi {
  list(): readonly OsWindow[];
}

/**
 * Stable semantic operating-system capability surface.
 *
 * This contract intentionally contains no Plasmon service/controller types and
 * no test-only powers. Production adapters bind it to the authorities available
 * in their composition; deterministic tests and scripting runtimes can consume
 * the same contract without depending on implementation classes.
 */
export interface OsApi {
  readonly fs: OsFileSystemApi;
  readonly processes: OsProcessesApi;
  readonly windows: OsWindowsApi;
  open(path: string): Promise<OpenResult>;
  /** Open a resource with one explicitly selected registered handler. */
  openWith(path: string, handlerId: string): Promise<OpenResult>;
}
