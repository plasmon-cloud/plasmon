import type { FsNode, FsService, HandlerId } from "../contracts/index.ts";
import { classifyResource } from "../fs/resourcePolicy.ts";
import type { SharedShortcutTarget } from "../fs/shortcut.ts";

/**
 * Ask the filesystem whether a canonical node is visible under the ordinary
 * default hidden-resource policy. Shell consumers never infer hiddenness from
 * dot-prefixed names or duplicate filesystem metadata rules.
 */
export async function isNodeVisibleByDefault(fs: FsService, nodeId: string): Promise<boolean> {
  let node: FsNode;
  try {
    node = await fs.stat(nodeId);
  } catch {
    return false;
  }
  if (!node.parentId) return true;
  try {
    const visible = await fs.list(node.parentId, { includeHidden: false, sort: "name" });
    return visible.some((candidate) => candidate.id === node.id);
  } catch {
    return false;
  }
}

async function findClassifiedResource(
  fs: FsService,
  parentPath: string,
  predicate: (node: FsNode) => boolean,
): Promise<FsNode | null> {
  const parent = await fs.resolvePath(parentPath);
  if (!parent || parent.kind !== "directory") return null;
  const children = await fs.list(parent.id, { includeHidden: true, sort: "name" });
  return children.find(predicate) ?? null;
}

export function findSystemAppResource(fs: FsService, handlerId: HandlerId): Promise<FsNode | null> {
  return findClassifiedResource(fs, "/System", (node) => {
    const classification = classifyResource(node);
    return classification.kind === "system-app" && classification.systemApp?.handlerId === handlerId;
  });
}

export function findNeutronAppResource(fs: FsService, elementId: string): Promise<FsNode | null> {
  return findClassifiedResource(fs, "/Apps", (node) => {
    const classification = classifyResource(node);
    return classification.kind === "neutron-app" && classification.neutronApp?.elementId === elementId;
  });
}

export async function isNativeAppVisibleByDefault(
  fs: FsService,
  handlerId: HandlerId,
): Promise<boolean> {
  const resource = await findSystemAppResource(fs, handlerId);
  return !resource || isNodeVisibleByDefault(fs, resource.id);
}

export async function isElementVisibleByDefault(
  fs: FsService,
  elementId: string,
): Promise<boolean> {
  const resource = await findNeutronAppResource(fs, elementId);
  return !resource || isNodeVisibleByDefault(fs, resource.id);
}

export async function isShortcutTargetVisibleByDefault(
  fs: FsService,
  target: SharedShortcutTarget,
): Promise<boolean> {
  switch (target.kind) {
    case "node":
      return isNodeVisibleByDefault(fs, target.nodeId);
    case "native":
      return isNativeAppVisibleByDefault(fs, target.handlerId);
    case "element":
      return isElementVisibleByDefault(fs, target.elementId);
    case "url":
      return true;
  }
}
