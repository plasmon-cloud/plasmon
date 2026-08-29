import type { FsNode, ProcessRecord, WindowState } from "../contracts/index.ts";
import type { PlasmonServices } from "../integration/services.ts";
import type {
  OpenResult,
  OsApi,
  OsProcess,
  OsResource,
  OsWindow,
} from "./contracts.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface CreatePlasmonOsApiOptions {
  /**
   * Production authority composition backing this API instance. The current
   * service facades already enforce their owning policy (for example protected
   * filesystem mutation). A future script-specific authority belongs on this
   * construction context only when a real production authorization contract
   * exists; do not invent a test-only capability token here.
   */
  services: PlasmonServices;
}

function requireAbsolutePath(path: string): void {
  if (!path.startsWith("/")) throw new Error(`OsApi requires an absolute path: ${path}`);
}

function splitAbsolutePath(path: string): { parentPath: string; name: string } {
  if (!path.startsWith("/") || path === "/" || path.endsWith("/")) {
    throw new Error(`OsApi requires an absolute non-root path: ${path}`);
  }
  const separator = path.lastIndexOf("/");
  const name = path.slice(separator + 1);
  if (!name) throw new Error(`OsApi path has no resource name: ${path}`);
  return {
    parentPath: separator === 0 ? "/" : path.slice(0, separator),
    name,
  };
}

async function toResource(services: PlasmonServices, node: FsNode): Promise<OsResource> {
  const path = await services.fs.pathOf(node.id);
  return {
    id: node.id,
    path,
    name: node.name,
    kind: node.kind,
    size: node.size,
    ...(node.mime ? { mimeType: node.mime } : {}),
  };
}

function toProcess(process: ProcessRecord): OsProcess {
  return {
    id: process.id,
    appId: process.appId,
    handlerId: process.handlerId,
    title: process.title,
    state: process.state,
    ...(process.windowId ? { windowId: process.windowId } : {}),
  };
}

function toWindow(window: WindowState): OsWindow {
  return {
    id: window.id,
    processId: window.processId,
    x: window.x,
    y: window.y,
    width: window.width,
    height: window.height,
    minimized: window.minimized,
    maximized: window.maximized,
  };
}

async function requireNode(services: PlasmonServices, path: string): Promise<FsNode> {
  requireAbsolutePath(path);
  await services.filesystem.ready;
  const node = await services.fs.resolvePath(path);
  if (!node) throw new Error(`OsApi path does not exist: ${path}`);
  return node;
}

async function requireDirectory(services: PlasmonServices, path: string): Promise<FsNode> {
  const node = await requireNode(services, path);
  if (node.kind !== "directory") throw new Error(`OsApi path is not a directory: ${path}`);
  return node;
}

async function requireParent(
  services: PlasmonServices,
  path: string,
): Promise<{ parent: FsNode; name: string }> {
  const { parentPath, name } = splitAbsolutePath(path);
  const parent = await requireDirectory(services, parentPath);
  return { parent, name };
}

function openedProcess(
  before: readonly ProcessRecord[],
  after: readonly ProcessRecord[],
  requestedNodeId: string,
): ProcessRecord | undefined {
  const beforeIds = new Set(before.map((process) => process.id));
  return after.find(
    (process) => !beforeIds.has(process.id) && process.target.nodeId === requestedNodeId,
  ) ?? after.find(
    (process) => !beforeIds.has(process.id),
  ) ?? after.find(
    (process) => process.target.nodeId === requestedNodeId && process.state !== "closing",
  );
}

/**
 * Bind the dependency-light OsApi contract to one concrete production Plasmon
 * service composition. The supplied services remain the authority for
 * filesystem protection, associations, opening, process lifecycle and windows;
 * this adapter does not recreate those policies.
 */
export function createPlasmonOsApi(options: CreatePlasmonOsApiOptions): OsApi {
  const { services } = options;
  const fs = {
    stat: async (path: string): Promise<OsResource | null> => {
      requireAbsolutePath(path);
      await services.filesystem.ready;
      const node = await services.fs.resolvePath(path);
      return node ? toResource(services, node) : null;
    },

    exists: async (path: string): Promise<boolean> => {
      requireAbsolutePath(path);
      await services.filesystem.ready;
      return (await services.fs.resolvePath(path)) !== null;
    },

    list: async (path: string): Promise<readonly OsResource[]> => {
      const directory = await requireDirectory(services, path);
      const children = await services.fs.list(directory.id);
      return Promise.all(children.map((node) => toResource(services, node)));
    },

    readText: async (path: string): Promise<string> => {
      const node = await requireNode(services, path);
      return textDecoder.decode(await services.fs.read(node.id));
    },

    writeText: async (path: string, content: string): Promise<OsResource> => {
      requireAbsolutePath(path);
      await services.filesystem.ready;
      let node = await services.fs.resolvePath(path);
      if (!node) {
        const { parent, name } = await requireParent(services, path);
        node = await services.fs.createFile(parent.id, name, { mime: "text/plain" });
      }
      const written = await services.fs.write(node.id, textEncoder.encode(content), {
        offset: 0,
        truncate: true,
      });
      return toResource(services, written);
    },

    createDirectory: async (path: string): Promise<OsResource> => {
      const { parent, name } = await requireParent(services, path);
      return toResource(services, await services.fs.mkdir(parent.id, name));
    },

    copy: async (sourcePath: string, destinationPath: string): Promise<OsResource> => {
      const source = await requireNode(services, sourcePath);
      const destination = await requireDirectory(services, destinationPath);
      return toResource(services, await services.fs.copy(source.id, destination.id));
    },

    move: async (sourcePath: string, destinationPath: string): Promise<OsResource> => {
      const source = await requireNode(services, sourcePath);
      const destination = await requireDirectory(services, destinationPath);
      return toResource(services, await services.fs.move(source.id, destination.id));
    },

    remove: async (path: string): Promise<void> => {
      const node = await requireNode(services, path);
      await services.filesystem.trash.trash(node.id);
    },
  } satisfies OsApi["fs"];

  return {
    fs,
    processes: {
      list: () => services.process.list().map(toProcess),
    },
    windows: {
      list: () => services.windows.list().map(toWindow),
    },
    open: async (path: string): Promise<OpenResult> => {
      const node = await requireNode(services, path);
      const resource = await toResource(services, node);
      const before = services.process.list();
      await services.filesystem.open.openNode(node.id);
      const process = openedProcess(before, services.process.list(), node.id);
      return {
        resource,
        ...(process ? {
          handlerId: process.handlerId,
          processId: process.id,
          ...(process.windowId ? { windowId: process.windowId } : {}),
        } : {}),
      };
    },
  };
}
