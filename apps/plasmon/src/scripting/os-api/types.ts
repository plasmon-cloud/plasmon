export type OsResourceKind = "file" | "directory" | "shortcut" | "atom";

export interface OsResource {
  id: string;
  path: string;
  name: string;
  kind: OsResourceKind;
  size: number;
  mimeType?: string;
}

export interface OpenResult {
  resource: OsResource;
  handlerId?: string;
  processId?: string;
  windowId?: string;
}

export interface OsProcess {
  id: string;
  appId: string;
  handlerId: string;
  state: "starting" | "running" | "closing";
  windowId?: string;
}

export interface OsWindow {
  id: string;
  processId: string;
  title?: string;
  minimized: boolean;
  maximized: boolean;
}

export interface OsFileSystemApi {
  stat(path: string): Promise<OsResource>;
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<OsResource>;
  createDirectory(path: string): Promise<OsResource>;
  /** Experimental R4/R5 addition used by shell-style directory listing. */
  list(path?: string): Promise<readonly OsResource[]>;
}

export interface OsProcessesApi {
  list(): readonly OsProcess[];
}

export interface OsWindowsApi {
  list(): readonly OsWindow[];
}

/**
 * Experimental compatibility contract pending the canonical production OsApi.
 * Shell commands, stdio, cwd, and runtime helpers intentionally live above it.
 */
export interface OsApi {
  readonly fs: OsFileSystemApi;
  readonly processes: OsProcessesApi;
  readonly windows: OsWindowsApi;
  open(path: string): Promise<OpenResult>;
}
