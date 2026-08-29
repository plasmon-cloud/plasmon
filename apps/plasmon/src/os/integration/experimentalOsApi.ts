import type {
  FsNode,
  FsService,
  ProcessController,
  WindowManager,
} from "../contracts/index.ts";
import type { FilesystemCoreServices } from "../fs/index.ts";
import type {
  OpenResult,
  OsApi,
  OsProcess,
  OsResource,
  OsWindow,
} from "../../scripting/os-api/types.ts";

export interface ExperimentalPlasmonOsApiOptions {
  fs: FsService;
  filesystem: FilesystemCoreServices;
  process: ProcessController;
  windows: WindowManager;
}

function normalizeAbsolutePath(path: string): string {
  if (!path.startsWith("/")) throw new Error(`OsApi paths must be absolute: ${path}`);
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function parentAndName(path: string): { parent: string; name: string } {
  const normalized = normalizeAbsolutePath(path);
  if (normalized === "/") throw new Error("The filesystem root cannot be created as a file");
  const slash = normalized.lastIndexOf("/");
  return { parent: slash === 0 ? "/" : normalized.slice(0, slash), name: normalized.slice(slash + 1) };
}

function mimeForWritablePath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".run")) return "text/typescript";
  if (lower.endsWith(".cmd")) return "application/x-sh";
  return "text/plain";
}

/**
 * R4/R5 experiment-only adapter. Replace this with the canonical
 * createPlasmonOsApi(...) implementation when the production OsApi lands.
 */
export function createExperimentalPlasmonOsApi(options: ExperimentalPlasmonOsApiOptions): OsApi {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const required = async (path: string): Promise<FsNode> => {
    const normalized = normalizeAbsolutePath(path);
    const node = await options.fs.resolvePath(normalized);
    if (!node) throw new Error(`Path does not exist: ${normalized}`);
    return node;
  };

  const resource = async (node: FsNode): Promise<OsResource> => ({
    id: node.id,
    path: await options.fs.pathOf(node.id),
    name: node.name,
    kind: node.kind,
    size: node.size,
    ...(node.mime ? { mimeType: node.mime } : {}),
  });

  const stat = async (path: string): Promise<OsResource> => resource(await required(path));

  const createDirectory = async (path: string): Promise<OsResource> => {
    const normalized = normalizeAbsolutePath(path);
    if (normalized === "/") return stat("/");
    let current = await required("/");
    for (const part of normalized.split("/").filter(Boolean)) {
      const nextPath = `${await options.fs.pathOf(current.id)}/${part}`.replace(/^\/\//u, "/");
      const existing = await options.fs.resolvePath(nextPath);
      if (existing) {
        if (existing.kind !== "directory") throw new Error(`Path component is not a directory: ${nextPath}`);
        current = existing;
      } else {
        current = await options.fs.mkdir(current.id, part);
      }
    }
    return resource(current);
  };

  const processes = (): readonly OsProcess[] => options.process.list().map((record) => ({
    id: record.id,
    appId: record.appId,
    handlerId: record.handlerId,
    state: record.state,
    ...(record.windowId ? { windowId: record.windowId } : {}),
  }));

  const windows = (): readonly OsWindow[] => {
    const titles = new Map(options.process.list().map((record) => [record.id, record.title] as const));
    return options.windows.list().map((window) => ({
      id: window.id,
      processId: window.processId,
      minimized: window.minimized,
      maximized: window.maximized,
      ...(titles.get(window.processId) ? { title: titles.get(window.processId)! } : {}),
    }));
  };

  return {
    fs: {
      stat,
      exists: async (path) => (await options.fs.resolvePath(normalizeAbsolutePath(path))) !== null,
      readText: async (path) => {
        const node = await required(path);
        if (node.kind === "directory") throw new Error(`Cannot read a directory as text: ${path}`);
        return decoder.decode(await options.fs.read(node.id));
      },
      writeText: async (path, text) => {
        const normalized = normalizeAbsolutePath(path);
        let node = await options.fs.resolvePath(normalized);
        if (!node) {
          const split = parentAndName(normalized);
          const parent = await required(split.parent);
          if (parent.kind !== "directory") throw new Error(`Parent is not a directory: ${split.parent}`);
          node = await options.fs.createFile(parent.id, split.name, { mime: mimeForWritablePath(normalized) });
        }
        if (node.kind === "directory") throw new Error(`Cannot write text to a directory: ${normalized}`);
        const written = await options.fs.write(node.id, encoder.encode(text), { truncate: true });
        return resource(written);
      },
      createDirectory,
      list: async (path = "/") => {
        const directory = await required(path);
        if (directory.kind !== "directory") throw new Error(`Cannot list a non-directory: ${path}`);
        return Promise.all((await options.fs.list(directory.id)).map(resource));
      },
    },
    processes: { list: processes },
    windows: { list: windows },
    open: async (path): Promise<OpenResult> => {
      const node = await required(path);
      const before = new Set(options.process.list().map((record) => record.id));
      await options.filesystem.open.openNode(node.id);
      const current = options.process.list();
      const opened = current.find((record) => !before.has(record.id))
        ?? [...current].reverse().find((record) => record.target.nodeId === node.id);
      return {
        resource: await resource(node),
        ...(opened ? {
          handlerId: opened.handlerId,
          processId: opened.id,
          ...(opened.windowId ? { windowId: opened.windowId } : {}),
        } : {}),
      };
    },
  };
}
