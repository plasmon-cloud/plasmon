import type { FsNode, FsService, HandlerId, JsonValue, NodeId } from "./contracts/index.ts";
import { classifyResource } from "./fs/resourcePolicy.ts";
import type { SharedShortcutTarget } from "./fs/shortcut.ts";

export const HIDDEN_VISIBILITY_PREFERENCES_KEY = "plasmon.hiddenVisibility.preferences.v1";

export interface HiddenVisibilityPreferences {
  version: 1;
  alwaysShowHiddenFiles: boolean;
}

export const DEFAULT_HIDDEN_VISIBILITY_PREFERENCES: HiddenVisibilityPreferences = Object.freeze({
  version: 1,
  alwaysShowHiddenFiles: false,
});

export function cloneHiddenVisibilityPreferences(
  preferences: HiddenVisibilityPreferences = DEFAULT_HIDDEN_VISIBILITY_PREFERENCES,
): HiddenVisibilityPreferences {
  return { version: 1, alwaysShowHiddenFiles: preferences.alwaysShowHiddenFiles };
}

export interface ExplorerHiddenVisibilityState {
  effectiveShowHiddenFiles: boolean;
  checkboxChecked: boolean;
  checkboxDisabled: boolean;
}

export function composeExplorerHiddenVisibility(
  alwaysShowHiddenFiles: boolean,
  explorerShowHiddenFiles: boolean,
): ExplorerHiddenVisibilityState {
  const effectiveShowHiddenFiles = alwaysShowHiddenFiles || explorerShowHiddenFiles;
  return {
    effectiveShowHiddenFiles,
    checkboxChecked: effectiveShowHiddenFiles,
    checkboxDisabled: alwaysShowHiddenFiles,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateHiddenVisibilityPreferences(value: unknown): HiddenVisibilityPreferences | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.alwaysShowHiddenFiles !== "boolean") return null;
  return { version: 1, alwaysShowHiddenFiles: value.alwaysShowHiddenFiles };
}

function metadataValue(preferences: HiddenVisibilityPreferences): JsonValue {
  return { version: 1, alwaysShowHiddenFiles: preferences.alwaysShowHiddenFiles };
}

function requireRoot(root: FsNode | null): FsNode {
  if (!root) throw new Error("Filesystem root is unavailable");
  if (root.kind !== "directory") throw new Error("Filesystem root is not a directory");
  return root;
}

export async function readHiddenVisibilityPreferences(fs: FsService): Promise<HiddenVisibilityPreferences> {
  const root = requireRoot(await fs.resolvePath("/"));
  return validateHiddenVisibilityPreferences(root.metadata[HIDDEN_VISIBILITY_PREFERENCES_KEY])
    ?? cloneHiddenVisibilityPreferences();
}

/**
 * Shared OS hidden-resource visibility preference. Persistence stays on the
 * filesystem/background boundary; Settings, Search, Start, and Explorer all
 * consume this one authority rather than maintaining surface-specific copies.
 */
export class HiddenVisibilityPreferenceStore {
  private rootId: NodeId | null = null;
  private snapshot = cloneHiddenVisibilityPreferences();
  private writeChain: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(preferences: HiddenVisibilityPreferences) => void>();

  constructor(private readonly fs: FsService) {}

  getSnapshot(): HiddenVisibilityPreferences {
    return cloneHiddenVisibilityPreferences(this.snapshot);
  }

  subscribe(listener: (preferences: HiddenVisibilityPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async load(): Promise<HiddenVisibilityPreferences> {
    const root = requireRoot(await this.fs.resolvePath("/"));
    this.rootId = root.id;
    this.snapshot = validateHiddenVisibilityPreferences(root.metadata[HIDDEN_VISIBILITY_PREFERENCES_KEY])
      ?? cloneHiddenVisibilityPreferences();
    this.emit();
    return this.getSnapshot();
  }

  setAlwaysShowHiddenFiles(alwaysShowHiddenFiles: boolean): Promise<void> {
    const next: HiddenVisibilityPreferences = { version: 1, alwaysShowHiddenFiles };
    const write = async (): Promise<void> => {
      const rootId = await this.resolveRootId();
      await this.fs.setMetadata(rootId, { [HIDDEN_VISIBILITY_PREFERENCES_KEY]: metadataValue(next) });
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

/**
 * Ask the filesystem whether a node survives its ordinary hidden-resource
 * listing policy. This intentionally does not infer hiddenness from names or
 * metadata in a consumer.
 */
export async function isNodeEligibleForHiddenVisibility(
  fs: FsService,
  nodeId: NodeId,
  alwaysShowHiddenFiles: boolean,
): Promise<boolean> {
  let node: FsNode;
  try {
    node = await fs.stat(nodeId);
  } catch {
    return false;
  }
  if (alwaysShowHiddenFiles) return true;
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

export async function isNativeAppEligibleForHiddenVisibility(
  fs: FsService,
  handlerId: HandlerId,
  alwaysShowHiddenFiles: boolean,
): Promise<boolean> {
  const resource = await findSystemAppResource(fs, handlerId);
  return !resource || isNodeEligibleForHiddenVisibility(fs, resource.id, alwaysShowHiddenFiles);
}

export async function isShortcutTargetEligibleForHiddenVisibility(
  fs: FsService,
  target: SharedShortcutTarget,
  alwaysShowHiddenFiles: boolean,
): Promise<boolean> {
  switch (target.kind) {
    case "node":
      return isNodeEligibleForHiddenVisibility(fs, target.nodeId, alwaysShowHiddenFiles);
    case "native":
      return isNativeAppEligibleForHiddenVisibility(fs, target.handlerId, alwaysShowHiddenFiles);
    case "element": {
      const resource = await findNeutronAppResource(fs, target.elementId);
      return !resource || isNodeEligibleForHiddenVisibility(fs, resource.id, alwaysShowHiddenFiles);
    }
    case "url":
      return true;
  }
}
