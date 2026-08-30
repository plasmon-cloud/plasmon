import type {
  AssociationRegistry,
  FsNode,
  FsService,
  HandlerId,
  NeutronBridge,
  NodeId,
  OpenService,
  ProcessController,
} from "../contracts/index.ts";
import { OpenWithServiceModel } from "../associations/index.ts";
import { classifyResource } from "./resourcePolicy.ts";
import { readSharedShortcut, type SharedShortcutTarget } from "./shortcut.ts";
import { TRASH_PATH } from "./managed.ts";

const ASSOCIATION_PROBE_BYTES = 256 * 1024;
const MAX_SHORTCUT_DEPTH = 24;

export interface FilesystemOpenDispatcherOptions {
  fs: FsService;
  associations: AssociationRegistry;
  openService: OpenService;
  process: ProcessController;
  neutron: NeutronBridge;
}

export interface OpenFilesystemNodeOptions {
  handlerId?: HandlerId;
  /**
   * Optional presentation-owned directory action. The dispatcher still owns
   * resource classification and shortcut dereference; callers such as an
   * existing Explorer window may choose same-window navigation instead of the
   * default behavior of opening another Explorer process.
   */
  onOpenDirectory?: (node: FsNode) => void | Promise<void>;
}

async function associationProbe(fs: FsService, node: FsNode): Promise<Uint8Array | undefined> {
  const lower = node.name.toLowerCase();
  const needsProbe = node.kind === "shortcut" || node.kind === "atom" || lower.endsWith(".url") || lower.endsWith(".atom");
  if (!needsProbe || node.size <= 0) return undefined;
  return fs.read(node.id, { offset: 0, length: Math.min(node.size, ASSOCIATION_PROBE_BYTES) });
}

async function isInsideTrash(fs: FsService, nodeId: NodeId): Promise<boolean> {
  const trash = await fs.resolvePath(TRASH_PATH);
  if (!trash) return false;
  let cursor: NodeId | null = nodeId;
  const visited = new Set<NodeId>();
  while (cursor) {
    if (cursor === trash.id) return true;
    if (visited.has(cursor)) throw new Error("Filesystem parent cycle detected");
    visited.add(cursor);
    const node = await fs.stat(cursor);
    cursor = node.parentId;
  }
  return false;
}

export class FilesystemOpenDispatcher {
  private readonly fs: FsService;
  private readonly associations: AssociationRegistry;
  private readonly openService: OpenService;
  private readonly process: ProcessController;
  private readonly neutron: NeutronBridge;

  constructor(options: FilesystemOpenDispatcherOptions) {
    this.fs = options.fs;
    this.associations = options.associations;
    this.openService = options.openService;
    this.process = options.process;
    this.neutron = options.neutron;
  }

  async openNode(nodeId: NodeId, options: OpenFilesystemNodeOptions = {}): Promise<void> {
    await this.openNodeRecursive(nodeId, options, new Set(), 0);
  }

  async openShortcut(nodeId: NodeId): Promise<void> {
    const node = await this.fs.stat(nodeId);
    if (!readSharedShortcut(node)) throw new Error(`${node.name} is not a valid shortcut`);
    await this.openNodeRecursive(nodeId, {}, new Set(), 0);
  }

  private async openNodeRecursive(
    nodeId: NodeId,
    options: OpenFilesystemNodeOptions,
    visited: Set<NodeId>,
    depth: number,
  ): Promise<void> {
    if (depth > MAX_SHORTCUT_DEPTH) throw new Error("Shortcut target chain is too deep");
    if (visited.has(nodeId)) throw new Error("This shortcut points to another shortcut in a loop");
    if (await isInsideTrash(this.fs, nodeId)) {
      throw new Error("This item is in Recycle Bin. Restore it before opening it.");
    }
    const node = await this.fs.stat(nodeId);
    if (node.kind === "shortcut") {
      const shortcut = readSharedShortcut(node);
      if (!shortcut) throw new Error(`${node.name} is a damaged or unsupported shortcut`);
      visited.add(node.id);
      await this.openTarget(shortcut.target, options, visited, depth + 1);
      return;
    }

    if (node.kind === "directory") {
      if (options.onOpenDirectory) {
        await options.onOpenDirectory(node);
        return;
      }
      const processId = await this.process.open("native:explorer", { nodeId: node.id });
      if (processId === null) throw new Error("File Manager is unavailable");
      return;
    }

    const classification = classifyResource(node);
    if (classification.kind === "system-app" && classification.systemApp) {
      await this.openService.open(classification.systemApp.handlerId, { nodeId: node.id });
      return;
    }
    if (classification.kind === "neutron-app" && classification.neutronApp) {
      await this.neutron.openElement(classification.neutronApp.elementId);
      return;
    }

    const probe = await associationProbe(this.fs, node);
    const model = new OpenWithServiceModel(this.associations, this.openService);
    const resolved = await model.model(node, probe);
    const selected = options.handlerId ?? resolved.defaultHandlerId;
    if (!selected) throw new Error(`No compatible application is registered for ${node.name}`);
    await model.open(node, selected, probe);
  }

  private async openTarget(
    target: SharedShortcutTarget,
    options: OpenFilesystemNodeOptions,
    visited: Set<NodeId>,
    depth: number,
  ): Promise<void> {
    switch (target.kind) {
      case "node":
        await this.openNodeRecursive(target.nodeId, options, visited, depth);
        return;
      case "native":
        await this.openService.open(target.handlerId, {});
        return;
      case "element":
        await this.neutron.openElement(target.elementId, {
          ...(target.tileId ? { tileId: target.tileId } : {}),
          ...(target.view ? { view: target.view } : {}),
        });
        return;
      case "url": {
        const handlerId = this.associations.getHandler("native:browser")
          ? "native:browser"
          : this.associations.getHandler("external:url")
            ? "external:url"
            : null;
        if (!handlerId) throw new Error("No URL-capable browser handler is registered");
        await this.openService.open(handlerId, { url: target.url });
        return;
      }
    }
  }
}
