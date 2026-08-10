import type {
  AssociationRegistry,
  FsEvent,
  FsNode,
  FsService,
  HandlerId,
  NodeId,
  OpenService,
} from "../contracts/index.ts";
import { OpenWithServiceModel } from "../associations/index.ts";

export interface SelectionState {
  ids: ReadonlySet<NodeId>;
  anchor: NodeId | null;
  focus: NodeId | null;
}

export interface SelectOptions {
  additive?: boolean;
  range?: boolean;
}

export function emptySelection(): SelectionState {
  return { ids: new Set<NodeId>(), anchor: null, focus: null };
}

export function clearSelection(): SelectionState {
  return emptySelection();
}

export function selectAll(orderedIds: readonly NodeId[]): SelectionState {
  const first = orderedIds[0] ?? null;
  const last = orderedIds.at(-1) ?? null;
  return { ids: new Set(orderedIds), anchor: first, focus: last };
}

export function selectNode(
  current: SelectionState,
  orderedIds: readonly NodeId[],
  id: NodeId,
  options: SelectOptions = {},
): SelectionState {
  if (options.range && current.anchor) {
    const anchorIndex = orderedIds.indexOf(current.anchor);
    const targetIndex = orderedIds.indexOf(id);
    if (anchorIndex >= 0 && targetIndex >= 0) {
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangeIds = orderedIds.slice(start, end + 1);
      const next = options.additive ? new Set(current.ids) : new Set<NodeId>();
      for (const rangeId of rangeIds) next.add(rangeId);
      return { ids: next, anchor: current.anchor, focus: id };
    }
  }

  if (options.additive) {
    const next = new Set(current.ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { ids: next, anchor: id, focus: id };
  }

  return { ids: new Set([id]), anchor: id, focus: id };
}

export interface EntryPointerSelectionDecision {
  selection: SelectionState;
  dragIds: readonly NodeId[];
  releaseSelection: SelectionState | null;
}

/**
 * Pointer-down must preserve an existing multi-selection long enough to decide
 * whether the gesture becomes a group drag. A normal no-drag release may then
 * collapse to the clicked entry, matching ordinary click semantics.
 */
export function decideEntryPointerSelection(
  current: SelectionState,
  orderedIds: readonly NodeId[],
  id: NodeId,
  options: SelectOptions = {},
): EntryPointerSelectionDecision {
  const modified = options.additive === true || options.range === true;
  if (!modified && current.ids.size > 1 && current.ids.has(id)) {
    return {
      selection: { ids: new Set(current.ids), anchor: current.anchor, focus: id },
      dragIds: [...current.ids],
      releaseSelection: selectNode(current, orderedIds, id),
    };
  }

  const next = selectNode(current, orderedIds, id, options);
  return {
    selection: next,
    dragIds: next.ids.has(id) ? [...next.ids] : [id],
    releaseSelection: null,
  };
}

export function reconcileSelection(
  current: SelectionState,
  visibleIds: ReadonlySet<NodeId>,
): SelectionState {
  const ids = new Set([...current.ids].filter((id) => visibleIds.has(id)));
  return {
    ids,
    anchor: current.anchor && visibleIds.has(current.anchor) ? current.anchor : null,
    focus: current.focus && visibleIds.has(current.focus) ? current.focus : null,
  };
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): RectLike {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}

export function rectsIntersect(a: RectLike, b: RectLike): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

/** Captures plain rectangle values once for a marquee gesture. */
export function captureMarqueeRectangles(
  ids: readonly NodeId[],
  readRect: (id: NodeId) => RectLike | null | undefined,
): ReadonlyMap<NodeId, RectLike> {
  const captured = new Map<NodeId, RectLike>();
  for (const id of ids) {
    const rect = readRect(id);
    if (!rect) continue;
    captured.set(id, {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  }
  return captured;
}

export function marqueeSelection(
  base: ReadonlySet<NodeId>,
  entries: ReadonlyMap<NodeId, RectLike>,
  marquee: RectLike,
  toggleFromBase: boolean,
): ReadonlySet<NodeId> {
  const next = toggleFromBase ? new Set(base) : new Set<NodeId>();
  for (const [id, rect] of entries) {
    if (!rectsIntersect(rect, marquee)) continue;
    if (toggleFromBase && next.has(id)) next.delete(id);
    else next.add(id);
  }
  return next;
}

export type ClipboardMode = "copy" | "cut";
export interface ClipboardSnapshot {
  mode: ClipboardMode;
  ids: readonly NodeId[];
}

export class FileOperationClipboard {
  private value: ClipboardSnapshot | null = null;

  copy(ids: Iterable<NodeId>): void {
    this.set("copy", ids);
  }

  cut(ids: Iterable<NodeId>): void {
    this.set("cut", ids);
  }

  clear(): void {
    this.value = null;
  }

  snapshot(): ClipboardSnapshot | null {
    return this.value ? { mode: this.value.mode, ids: [...this.value.ids] } : null;
  }

  remove(ids: Iterable<NodeId>): void {
    if (!this.value) return;
    const removed = new Set(ids);
    const remaining = this.value.ids.filter((id) => !removed.has(id));
    this.value = remaining.length > 0 ? { mode: this.value.mode, ids: remaining } : null;
  }

  private set(mode: ClipboardMode, ids: Iterable<NodeId>): void {
    const unique = [...new Set(ids)];
    this.value = unique.length > 0 ? { mode, ids: unique } : null;
  }
}

export class RefreshGate {
  private generation = 0;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  invalidate(): void {
    this.generation += 1;
  }
}

export function isFsEventRelevant(event: FsEvent, directoryId: NodeId): boolean {
  if (event.type === "reset") return true;
  if (event.type === "removed") return event.parentId === directoryId || event.id === directoryId;
  if (event.type === "moved") {
    return event.oldParentId === directoryId || event.node.parentId === directoryId || event.node.id === directoryId;
  }
  return event.node.parentId === directoryId || event.node.id === directoryId;
}

export function normalizedNewName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Name cannot be empty");
  if (trimmed === "." || trimmed === "..") throw new Error("That name is reserved");
  return trimmed;
}

export function basenameSelectionRange(name: string): readonly [number, number] {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return [0, name.length];
  return [0, lastDot];
}

export interface RenameDraft {
  nodeId: NodeId;
  originalName: string;
  value: string;
}

export function beginRename(node: FsNode): RenameDraft {
  return { nodeId: node.id, originalName: node.name, value: node.name };
}

export function updateRename(draft: RenameDraft, value: string): RenameDraft {
  return { ...draft, value };
}

export function cancelRename(_draft: RenameDraft): null {
  return null;
}

export async function commitRename(fs: FsService, draft: RenameDraft): Promise<FsNode> {
  return renameNode(fs, draft.nodeId, draft.value);
}

export async function renameNode(fs: FsService, nodeId: NodeId, value: string): Promise<FsNode> {
  return fs.rename(nodeId, normalizedNewName(value));
}

export async function deleteNodes(fs: FsService, nodes: readonly FsNode[]): Promise<void> {
  for (const node of nodes) {
    await fs.remove(node.id, node.kind === "directory" ? { recursive: true } : undefined);
  }
}

export async function pasteClipboard(
  fs: FsService,
  destinationId: NodeId,
  clipboard: FileOperationClipboard,
): Promise<readonly FsNode[]> {
  const snapshot = clipboard.snapshot();
  if (!snapshot) return [];
  const completed: FsNode[] = [];
  for (const id of snapshot.ids) {
    const result = snapshot.mode === "copy"
      ? await fs.copy(id, destinationId)
      : await fs.move(id, destinationId);
    completed.push(result);
    if (snapshot.mode === "cut") clipboard.remove([id]);
  }
  return completed;
}

async function isAncestor(fs: FsService, ancestorId: NodeId, candidateId: NodeId): Promise<boolean> {
  let cursor: NodeId | null = candidateId;
  const visited = new Set<NodeId>();
  while (cursor) {
    if (cursor === ancestorId) return true;
    if (visited.has(cursor)) throw new Error("Filesystem parent cycle detected");
    visited.add(cursor);
    const node = await fs.stat(cursor);
    cursor = node.parentId;
  }
  return false;
}

export async function validateDirectoryDrop(
  fs: FsService,
  sourceNodes: readonly FsNode[],
  target: FsNode,
): Promise<void> {
  if (target.kind !== "directory") throw new Error("Drop target is not a directory");
  const sourceIds = new Set(sourceNodes.map((node) => node.id));
  if (sourceIds.has(target.id)) throw new Error("A directory cannot be moved into itself");

  for (const source of sourceNodes) {
    if (source.parentId === target.id) throw new Error(`${source.name} is already in ${target.name}`);
    if (source.kind === "directory" && await isAncestor(fs, source.id, target.id)) {
      throw new Error(`Cannot move ${source.name} into one of its descendants`);
    }
  }
}

export async function moveNodesToDirectory(
  fs: FsService,
  sourceNodes: readonly FsNode[],
  target: FsNode,
): Promise<readonly FsNode[]> {
  await validateDirectoryDrop(fs, sourceNodes, target);
  const moved: FsNode[] = [];
  for (const source of sourceNodes) moved.push(await fs.move(source.id, target.id));
  return moved;
}

const ASSOCIATION_PROBE_BYTES = 256 * 1024;

export async function readAssociationProbe(fs: FsService, node: FsNode): Promise<Uint8Array | undefined> {
  const lower = node.name.toLowerCase();
  const needsProbe = node.kind === "shortcut" || node.kind === "atom" || lower.endsWith(".url") || lower.endsWith(".atom");
  if (!needsProbe || node.size <= 0) return undefined;
  return fs.read(node.id, { offset: 0, length: Math.min(node.size, ASSOCIATION_PROBE_BYTES) });
}

export async function openNodeWithAssociations(
  fs: FsService,
  registry: AssociationRegistry,
  openService: OpenService,
  nodeId: NodeId,
  handlerId?: HandlerId,
): Promise<void> {
  const node = await fs.stat(nodeId);
  if (node.kind === "directory") throw new Error("Directories are navigated by FileManager/Explorer");
  const probe = await readAssociationProbe(fs, node);
  const model = new OpenWithServiceModel(registry, openService);
  const resolved = await model.model(node, probe);
  const selected = handlerId ?? resolved.defaultHandlerId;
  if (!selected) throw new Error(`No compatible application is registered for ${node.name}`);
  await model.open(node, selected, probe);
}

export function extensionOf(name: string): string | null {
  const lastSlash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const base = name.slice(lastSlash + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 && dot < base.length - 1 ? base.slice(dot).toLowerCase() : null;
}

export function parentPath(path: string): string {
  if (path === "/") return "/";
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const slash = normalized.lastIndexOf("/");
  return slash <= 0 ? "/" : normalized.slice(0, slash);
}
