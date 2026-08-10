import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  AssociationRegistry,
  FsEventSource,
  FsListOptions,
  FsNode,
  FsService,
  NodeId,
  OpenService,
  ProcessController,
} from "../contracts/index.ts";
import {
  FileOperationClipboard,
  RefreshGate,
  basenameSelectionRange,
  captureMarqueeRectangles,
  clearSelection,
  decideEntryPointerSelection,
  deleteNodes,
  emptySelection,
  isFsEventRelevant,
  marqueeSelection,
  moveNodesToDirectory,
  normalizeRect,
  openNodeWithAssociations,
  pasteClipboard,
  reconcileSelection,
  renameNode,
  selectAll,
  selectNode,
  type RectLike,
  type SelectionState,
} from "./model.ts";
import {
  createDocument,
  importFileIntoFs,
  type NewDocumentKind,
} from "./create-import.ts";
import { finishEntryDragGesture } from "./drag.ts";
import { OpenWithPanel, PropertiesPanel } from "./properties.tsx";
import "./file-manager.scss";

export type FileManagerPresentation = "desktop" | "grid" | "list" | "details";
export interface DesktopPosition { x: number; y: number }

export interface FileManagerSnapshot {
  nodes: readonly FsNode[];
  selectedIds: ReadonlySet<NodeId>;
}

export interface FileManagerProps {
  directoryId: NodeId;
  fs: FsService;
  fsEvents?: FsEventSource;
  associations?: AssociationRegistry;
  openService?: OpenService;
  process?: ProcessController;
  clipboard: FileOperationClipboard;
  presentation?: FileManagerPresentation;
  sort?: FsListOptions["sort"];
  filterQuery?: string;
  positions?: Readonly<Record<NodeId, DesktopPosition>>;
  onDesktopReposition?: (
    ids: readonly NodeId[],
    delta: { dx: number; dy: number },
    bounds: { width: number; height: number },
  ) => void | Promise<void>;
  onOpenDirectory?: (node: FsNode) => void | Promise<void>;
  onSnapshot?: (snapshot: FileManagerSnapshot) => void;
  confirmDelete?: (nodes: readonly FsNode[]) => boolean | Promise<boolean>;
  className?: string;
}

type ContextMenuState = { x: number; y: number; nodeId: NodeId | null } | null;
type RenameState = { nodeId: NodeId; value: string; error: string | null; busy: boolean } | null;
type MarqueeVisual = { left: number; top: number; width: number; height: number } | null;

interface EntryProps {
  node: FsNode;
  selected: boolean;
  focused: boolean;
  presentation: FileManagerPresentation;
  position?: DesktopPosition;
  rename: RenameState;
  setRef: (element: HTMLDivElement | null) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}

function iconFor(node: FsNode): string {
  if (node.kind === "directory") return "▰";
  if (node.kind === "atom") return "◈";
  if (node.kind === "shortcut") return "↗";
  const lower = node.name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "M↓";
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) return "▶";
  return "□";
}

function formatCompactSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FileEntry = memo(function FileEntry({
  node,
  selected,
  focused,
  presentation,
  position,
  rename,
  setRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  onContextMenu,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: EntryProps) {
  const isRenaming = rename?.nodeId === node.id;
  const style: CSSProperties | undefined = presentation === "desktop" && position
    ? { left: position.x, top: position.y }
    : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isRenaming || !inputRef.current) return;
    inputRef.current.focus();
    const [start, end] = basenameSelectionRange(rename.value);
    inputRef.current.setSelectionRange(start, end);
  }, [isRenaming, rename?.value]);

  return (
    <div
      ref={setRef}
      className={`fm-entry fm-entry--${presentation}${selected ? " is-selected" : ""}${focused ? " is-focused" : ""}`}
      style={style}
      role="option"
      aria-selected={selected}
      data-fm-node-id={node.id}
      data-fm-kind={node.kind}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <span className="fm-entry__icon" aria-hidden="true">{iconFor(node)}</span>
      <span className="fm-entry__selection-mark" aria-hidden="true">{selected ? "✓" : ""}</span>
      <span className="fm-entry__name">
        {isRenaming ? (
          <>
            <input
              ref={inputRef}
              value={rename.value}
              aria-label={`Rename ${node.name}`}
              disabled={rename.busy}
              onPointerDown={(event: ReactPointerEvent<HTMLInputElement>) => event.stopPropagation()}
              onChange={(event: ReactChangeEvent<HTMLInputElement>) => onRenameChange(event.target.value)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Enter") { event.preventDefault(); onRenameCommit(); }
                if (event.key === "Escape") { event.preventDefault(); onRenameCancel(); }
              }}
            />
            {rename.error ? <span className="fm-inline-error" role="alert">{rename.error}</span> : null}
          </>
        ) : node.name}
      </span>
      {presentation === "details" ? (
        <>
          <span className="fm-entry__type">{node.kind === "directory" ? "Folder" : node.mime ?? node.kind}</span>
          <span className="fm-entry__size">{node.kind === "directory" ? "—" : formatCompactSize(node.size)}</span>
          <span className="fm-entry__modified">{new Date(node.modifiedAt).toLocaleString()}</span>
        </>
      ) : null}
    </div>
  );
});

export function FileManager({
  directoryId,
  fs,
  fsEvents,
  associations,
  openService,
  process,
  clipboard,
  presentation = "grid",
  sort = "name",
  filterQuery = "",
  positions,
  onDesktopReposition,
  onOpenDirectory,
  onSnapshot,
  confirmDelete,
  className,
}: FileManagerProps) {
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [selection, setSelection] = useState<SelectionState>(() => emptySelection());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [rename, setRename] = useState<RenameState>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("New Folder");
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [openWithNode, setOpenWithNode] = useState<FsNode | null>(null);
  const [propertiesNode, setPropertiesNode] = useState<FsNode | null>(null);
  const [marquee, setMarquee] = useState<MarqueeVisual>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const entriesRef = useRef(new Map<NodeId, HTMLDivElement>());
  const refreshGateRef = useRef(new RefreshGate());
  const dragFrameRef = useRef<number | null>(null);
  const dragPendingRef = useRef({ dx: 0, dy: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    ids: NodeId[];
    moved: boolean;
    releaseSelection: SelectionState | null;
  } | null>(null);
  const marqueeFrameRef = useRef<number | null>(null);
  const marqueePointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    base: ReadonlySet<NodeId>;
    anchor: NodeId | null;
    toggle: boolean;
    entryRects: ReadonlyMap<NodeId, RectLike>;
    rootLeft: number;
    rootTop: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    const generation = refreshGateRef.current.begin();
    setLoading(true);
    try {
      const directory = await fs.stat(directoryId);
      if (directory.kind !== "directory") throw new Error(`${directory.name} is not a directory`);
      const listed = await fs.list(directoryId, { sort });
      if (!refreshGateRef.current.isCurrent(generation)) return;
      setNodes(listed);
      setSelection((current) => reconcileSelection(current, new Set(listed.map((node) => node.id))));
      setError(null);
    } catch (cause: unknown) {
      if (!refreshGateRef.current.isCurrent(generation)) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (refreshGateRef.current.isCurrent(generation)) setLoading(false);
    }
  }, [directoryId, fs, sort]);

  useEffect(() => {
    void refresh();
    return () => refreshGateRef.current.invalidate();
  }, [refresh]);

  useEffect(() => {
    if (!fsEvents) return undefined;
    return fsEvents.subscribe((event) => {
      if (isFsEventRelevant(event, directoryId)) void refresh();
    });
  }, [directoryId, fsEvents, refresh]);

  const visibleNodes = useMemo(() => {
    const query = filterQuery.trim().toLocaleLowerCase();
    return query ? nodes.filter((node) => node.name.toLocaleLowerCase().includes(query)) : nodes;
  }, [filterQuery, nodes]);
  const orderedIds = useMemo(() => visibleNodes.map((node) => node.id), [visibleNodes]);

  useEffect(() => {
    onSnapshot?.({ nodes: visibleNodes, selectedIds: selection.ids });
  }, [onSnapshot, selection.ids, visibleNodes]);

  const selectedNodes = useCallback(() => {
    const ids = selection.ids;
    return nodes.filter((node) => ids.has(node.id));
  }, [nodes, selection.ids]);

  const reportError = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));

  const openNode = useCallback(async (node: FsNode) => {
    setContextMenu(null);
    try {
      if (node.kind === "directory") {
        if (onOpenDirectory) {
          await onOpenDirectory(node);
          return;
        }
        if (!process) throw new Error("Explorer process service is unavailable");
        const id = await process.open("native:explorer", { nodeId: node.id });
        if (!id) throw new Error("Explorer is not registered yet");
        return;
      }
      if (!associations || !openService) throw new Error("File association/open service is unavailable");
      await openNodeWithAssociations(fs, associations, openService, node.id);
    } catch (cause: unknown) {
      reportError(cause);
    }
  }, [associations, fs, onOpenDirectory, openService, process]);

  const startRename = (node: FsNode) => {
    setContextMenu(null);
    setRename({ nodeId: node.id, value: node.name, error: null, busy: false });
  };

  const commitRename = async () => {
    if (!rename) return;
    const state = rename;
    setRename({ ...state, busy: true, error: null });
    try {
      await renameNode(fs, state.nodeId, state.value);
      setRename(null);
      await refresh();
    } catch (cause: unknown) {
      setRename({ ...state, busy: false, error: cause instanceof Error ? cause.message : String(cause) });
    }
  };

  const removeNodes = async (items: readonly FsNode[]) => {
    if (items.length === 0) return;
    const permitted = confirmDelete
      ? await confirmDelete(items)
      : typeof window === "undefined" || window.confirm(`Delete ${items.length === 1 ? items[0]?.name ?? "this item" : `${items.length} items`}?`);
    if (!permitted) return;
    try {
      await deleteNodes(fs, items);
      setSelection(clearSelection());
      setContextMenu(null);
      await refresh();
    } catch (cause: unknown) {
      reportError(cause);
    }
  };

  const removeSelected = async () => removeNodes(selectedNodes());

  const paste = async () => {
    try {
      await pasteClipboard(fs, directoryId, clipboard);
      await refresh();
    } catch (cause: unknown) {
      reportError(cause);
    }
  };

  const commitNewFolder = async () => {
    setNewFolderError(null);
    try {
      await fs.mkdir(directoryId, newFolderName.trim());
      setCreatingFolder(false);
      setNewFolderName("New Folder");
      await refresh();
    } catch (cause: unknown) {
      setNewFolderError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const createNewDocument = async (kind: NewDocumentKind) => {
    setContextMenu(null);
    try {
      const created = await createDocument(fs, directoryId, kind);
      await refresh();
      setSelection({ ids: new Set([created.id]), anchor: created.id, focus: created.id });
      setRename({ nodeId: created.id, value: created.name, error: null, busy: false });
      setError(null);
    } catch (cause: unknown) {
      reportError(cause);
    }
  };

  const importFiles = async (files: readonly File[]) => {
    if (files.length === 0) return;
    setContextMenu(null);
    const imported: FsNode[] = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        imported.push(await importFileIntoFs(fs, directoryId, file));
      } catch (cause: unknown) {
        failures.push(`${file.name}: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
    await refresh();
    if (imported.length > 0) {
      const ids = imported.map((node) => node.id);
      setSelection({ ids: new Set(ids), anchor: ids[0] ?? null, focus: ids.at(-1) ?? null });
    }
    setError(failures.length > 0 ? `Import failed — ${failures.join("; ")}` : null);
  };

  const triggerImport = () => {
    setContextMenu(null);
    fileInputRef.current?.click();
  };

  const applyDragTransform = (dx: number, dy: number) => {
    const active = dragRef.current;
    if (!active) return;
    for (const id of active.ids) {
      const element = entriesRef.current.get(id);
      if (element) element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }
  };

  const clearDragVisual = () => {
    const active = dragRef.current;
    if (!active) return;
    for (const id of active.ids) {
      const element = entriesRef.current.get(id);
      if (element) {
        element.style.transform = "";
        element.style.pointerEvents = "";
        element.classList.remove("is-dragging");
      }
    }
  };

  const handleEntryPointerDown = (node: FsNode, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || rename?.nodeId === node.id) return;
    setContextMenu(null);
    rootRef.current?.focus({ preventScroll: true });
    const decision = decideEntryPointerSelection(selection, orderedIds, node.id, {
      additive: event.ctrlKey || event.metaKey,
      range: event.shiftKey,
    });
    setSelection(decision.selection);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      ids: [...decision.dragIds],
      moved: false,
      releaseSelection: decision.releaseSelection,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleEntryPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (!active.moved && Math.hypot(dx, dy) < 5) return;
    if (!active.moved) {
      active.moved = true;
      for (const id of active.ids) {
        const element = entriesRef.current.get(id);
        if (element) {
          element.classList.add("is-dragging");
          element.style.pointerEvents = "none";
        }
      }
    }
    dragPendingRef.current = { dx, dy };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      applyDragTransform(dragPendingRef.current.dx, dragPendingRef.current.dy);
    });
  };

  const handleEntryPointerUp = async (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const { dx, dy } = dragPendingRef.current;
    const outcome = finishEntryDragGesture(active, selection, false);
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    clearDragVisual();
    dragRef.current = null;
    dragPendingRef.current = { dx: 0, dy: 0 };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!outcome.shouldDrop) {
      setSelection(outcome.selection);
      return;
    }

    const ids = [...outcome.ids];
    const underPointer = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-fm-node-id]");
    const targetId = underPointer?.dataset.fmNodeId;
    const target = targetId ? nodes.find((node) => node.id === targetId) : undefined;
    const source = nodes.filter((node) => ids.includes(node.id));
    try {
      if (target?.kind === "directory" && !ids.includes(target.id)) {
        await moveNodesToDirectory(fs, source, target);
        await refresh();
        return;
      }
      if (presentation === "desktop" && onDesktopReposition && rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        await onDesktopReposition(ids, { dx, dy }, { width: rect.width, height: rect.height });
      }
    } catch (cause: unknown) {
      reportError(cause);
    }
  };

  const handleEntryPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const outcome = finishEntryDragGesture(active, selection, true);
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    clearDragVisual();
    dragRef.current = null;
    dragPendingRef.current = { dx: 0, dy: 0 };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setSelection(outcome.selection);
  };

  const processMarquee = () => {
    marqueeFrameRef.current = null;
    const active = marqueePointerRef.current;
    if (!active) return;
    const clientRect = normalizeRect(active.startX, active.startY, active.currentX, active.currentY);
    setMarquee({
      left: clientRect.left - active.rootLeft,
      top: clientRect.top - active.rootTop,
      width: clientRect.right - clientRect.left,
      height: clientRect.bottom - clientRect.top,
    });
    const ids = marqueeSelection(active.base, active.entryRects, clientRect, active.toggle);
    setSelection({ ids, anchor: active.anchor, focus: [...ids].at(-1) ?? null });
  };

  const handleBackgroundPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (presentation !== "desktop" || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-fm-node-id],button,input")) return;
    setContextMenu(null);
    const toggle = event.ctrlKey || event.metaKey;
    const base = toggle ? new Set(selection.ids) : new Set<NodeId>();
    const rootRect = event.currentTarget.getBoundingClientRect();
    const entryRects = captureMarqueeRectangles(orderedIds, (id) => {
      const rect = entriesRef.current.get(id)?.getBoundingClientRect();
      return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null;
    });
    marqueePointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      base,
      anchor: selection.anchor,
      toggle,
      entryRects,
      rootLeft: rootRect.left,
      rootTop: rootRect.top,
    };
    if (!toggle) setSelection(clearSelection());
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBackgroundPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = marqueePointerRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    active.currentX = event.clientX;
    active.currentY = event.clientY;
    if (marqueeFrameRef.current === null) marqueeFrameRef.current = requestAnimationFrame(processMarquee);
  };

  const finishMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = marqueePointerRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (marqueeFrameRef.current !== null) cancelAnimationFrame(marqueeFrameRef.current);
    marqueeFrameRef.current = null;
    marqueePointerRef.current = null;
    setMarquee(null);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).matches("input,textarea,select")) return;
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (command && key === "a") {
      event.preventDefault();
      setSelection(selectAll(orderedIds));
      return;
    }
    if (command && key === "c") {
      event.preventDefault();
      clipboard.copy(selection.ids);
      return;
    }
    if (command && key === "x") {
      event.preventDefault();
      clipboard.cut(selection.ids);
      return;
    }
    if (command && key === "v") {
      event.preventDefault();
      void paste();
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      void removeSelected();
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      const id = selection.focus ?? selection.ids.values().next().value as NodeId | undefined;
      const node = id ? nodes.find((entry) => entry.id === id) : undefined;
      if (node) startRename(node);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const id = selection.focus ?? selection.ids.values().next().value as NodeId | undefined;
      const node = id ? nodes.find((entry) => entry.id === id) : undefined;
      if (node) void openNode(node);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (rename) setRename(null);
      else if (contextMenu || openWithNode || propertiesNode) {
        setContextMenu(null); setOpenWithNode(null); setPropertiesNode(null);
      } else setSelection(clearSelection());
      return;
    }
    if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key) && orderedIds.length > 0) {
      event.preventDefault();
      const currentId = selection.focus ?? orderedIds[0] ?? null;
      const index = currentId ? Math.max(0, orderedIds.indexOf(currentId)) : 0;
      const delta = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
      const nextId = orderedIds[Math.max(0, Math.min(orderedIds.length - 1, index + delta))];
      if (nextId) setSelection(selectNode(selection, orderedIds, nextId, { range: event.shiftKey, additive: command }));
    }
  };

  const contextNode = contextMenu?.nodeId ? nodes.find((node) => node.id === contextMenu.nodeId) ?? null : null;
  const canOpenWith = Boolean(contextNode && contextNode.kind !== "directory" && associations && openService);

  const menuAction = (action: "open" | "openWith" | "cut" | "copy" | "rename" | "delete" | "properties" | "newFolder" | "newText" | "newMarkdown" | "import" | "paste") => {
    if (action === "newFolder") {
      setContextMenu(null); setCreatingFolder(true); setNewFolderName("New Folder"); setNewFolderError(null); return;
    }
    if (action === "newText") { void createNewDocument("text"); return; }
    if (action === "newMarkdown") { void createNewDocument("markdown"); return; }
    if (action === "import") { triggerImport(); return; }
    if (action === "paste") { setContextMenu(null); void paste(); return; }
    if (!contextNode) return;
    if (action === "open") { void openNode(contextNode); return; }
    if (action === "openWith") { setContextMenu(null); if (canOpenWith) setOpenWithNode(contextNode); return; }
    if (action === "cut") { clipboard.cut(selection.ids.has(contextNode.id) ? selection.ids : [contextNode.id]); setContextMenu(null); return; }
    if (action === "copy") { clipboard.copy(selection.ids.has(contextNode.id) ? selection.ids : [contextNode.id]); setContextMenu(null); return; }
    if (action === "rename") { startRename(contextNode); return; }
    if (action === "delete") {
      const items = selection.ids.has(contextNode.id) ? selectedNodes() : [contextNode];
      setContextMenu(null);
      void removeNodes(items);
      return;
    }
    if (action === "properties") {
      setContextMenu(null);
      if (associations && openService) setPropertiesNode(contextNode);
      else if (process) void process.open("native:properties", { nodeId: contextNode.id });
    }
  };

  return (
    <div
      ref={rootRef}
      className={`fm-root fm-root--${presentation}${className ? ` ${className}` : ""}`}
      tabIndex={0}
      role="listbox"
      aria-label="Files"
      aria-multiselectable="true"
      onKeyDown={handleKeyDown}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handleBackgroundPointerMove}
      onPointerUp={finishMarquee}
      onPointerCancel={finishMarquee}
      onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        const element = (event.target as HTMLElement).closest<HTMLElement>("[data-fm-node-id]");
        const id = element?.dataset.fmNodeId ?? null;
        if (id && !selection.ids.has(id)) setSelection(selectNode(emptySelection(), orderedIds, id));
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: id });
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event: ReactChangeEvent<HTMLInputElement>) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void importFiles(files);
        }}
      />

      {presentation !== "desktop" ? (
        <div className="fm-commandbar" role="toolbar" aria-label="File commands">
          <button type="button" onClick={() => { setCreatingFolder(true); setNewFolderName("New Folder"); setNewFolderError(null); }}>New Folder</button>
          <button type="button" onClick={() => void createNewDocument("text")}>New Text Document</button>
          <button type="button" onClick={() => void createNewDocument("markdown")}>New Markdown Document</button>
          <button type="button" onClick={triggerImport}>Import Files…</button>
          <button type="button" onClick={() => clipboard.copy(selection.ids)} disabled={selection.ids.size === 0}>Copy</button>
          <button type="button" onClick={() => clipboard.cut(selection.ids)} disabled={selection.ids.size === 0}>Cut</button>
          <button type="button" onClick={() => void paste()} disabled={!clipboard.snapshot()}>Paste</button>
          <button type="button" onClick={() => void removeSelected()} disabled={selection.ids.size === 0}>Delete</button>
          <button type="button" onClick={() => void refresh()}>Refresh</button>
        </div>
      ) : null}

      {error ? (
        <div className="fm-error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()}>Retry</button></div>
      ) : null}
      {loading && nodes.length === 0 ? <p className="fm-empty">Loading…</p> : null}

      {presentation === "details" ? (
        <div className="fm-details-head" aria-hidden="true"><span>Name</span><span>Type</span><span>Size</span><span>Modified</span></div>
      ) : null}

      <div className="fm-entries">
        {creatingFolder ? (
          <div className={`fm-entry fm-entry--${presentation} fm-entry--new-folder`}>
            <span className="fm-entry__icon" aria-hidden="true">▰</span>
            <span className="fm-entry__name">
              <input
                autoFocus
                value={newFolderName}
                aria-label="New folder name"
                onChange={(event: ReactChangeEvent<HTMLInputElement>) => { setNewFolderName(event.target.value); setNewFolderError(null); }}
                onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter") { event.preventDefault(); void commitNewFolder(); }
                  if (event.key === "Escape") { event.preventDefault(); setCreatingFolder(false); setNewFolderError(null); }
                }}
              />
              {newFolderError ? <span className="fm-inline-error" role="alert">{newFolderError}</span> : null}
            </span>
          </div>
        ) : null}

        {visibleNodes.map((node, index) => (
          <FileEntry
            key={node.id}
            node={node}
            selected={selection.ids.has(node.id)}
            focused={selection.focus === node.id}
            presentation={presentation}
            {...(presentation === "desktop" ? { position: positions?.[node.id] ?? { x: 16 + Math.floor(index / 6) * 104, y: 16 + (index % 6) * 104 } } : {})}
            rename={rename}
            setRef={(element) => {
              if (element) entriesRef.current.set(node.id, element);
              else entriesRef.current.delete(node.id);
            }}
            onPointerDown={(event) => handleEntryPointerDown(node, event)}
            onPointerMove={handleEntryPointerMove}
            onPointerUp={(event) => void handleEntryPointerUp(event)}
            onPointerCancel={handleEntryPointerCancel}
            onDoubleClick={() => void openNode(node)}
            onContextMenu={(event) => {
              event.preventDefault(); event.stopPropagation();
              if (!selection.ids.has(node.id)) setSelection(selectNode(emptySelection(), orderedIds, node.id));
              setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
            }}
            onRenameChange={(value) => setRename((current) => current ? { ...current, value, error: null } : null)}
            onRenameCommit={() => void commitRename()}
            onRenameCancel={() => setRename(null)}
          />
        ))}
      </div>

      {!loading && visibleNodes.length === 0 && !creatingFolder ? <p className="fm-empty">This folder is empty.</p> : null}
      {marquee ? <div className="fm-marquee" aria-hidden="true" style={marquee} /> : null}

      {contextMenu ? (
        <div className="fm-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextNode ? (
            <>
              <button type="button" role="menuitem" onClick={() => menuAction("open")}>Open</button>
              {contextNode.kind !== "directory" ? <button type="button" role="menuitem" disabled={!canOpenWith} title={canOpenWith ? undefined : "Association service unavailable"} onClick={() => menuAction("openWith")}>Open With…</button> : null}
              <div className="fm-menu-separator" role="separator" />
              <button type="button" role="menuitem" onClick={() => menuAction("cut")}>Cut</button>
              <button type="button" role="menuitem" onClick={() => menuAction("copy")}>Copy</button>
              <button type="button" role="menuitem" onClick={() => menuAction("rename")}>Rename</button>
              <button type="button" role="menuitem" onClick={() => menuAction("delete")}>Delete</button>
              <div className="fm-menu-separator" role="separator" />
              <button type="button" role="menuitem" onClick={() => menuAction("properties")}>Properties</button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => menuAction("newFolder")}>New Folder</button>
              <button type="button" role="menuitem" onClick={() => menuAction("newText")}>New Text Document</button>
              <button type="button" role="menuitem" onClick={() => menuAction("newMarkdown")}>New Markdown Document</button>
              <button type="button" role="menuitem" onClick={() => menuAction("import")}>Import Files…</button>
              <div className="fm-menu-separator" role="separator" />
              <button type="button" role="menuitem" disabled={!clipboard.snapshot()} onClick={() => menuAction("paste")}>Paste</button>
            </>
          )}
        </div>
      ) : null}

      {openWithNode && associations && openService ? (
        <OpenWithPanel fs={fs} node={openWithNode} registry={associations} openService={openService} onClose={() => setOpenWithNode(null)} onChanged={() => void refresh()} />
      ) : null}
      {propertiesNode && associations && openService ? (
        <div className="fm-modal-backdrop" role="presentation" onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) setPropertiesNode(null); }}>
          <section className="fm-dialog fm-dialog--properties" role="dialog" aria-modal="true">
            <PropertiesPanel nodeId={propertiesNode.id} fs={fs} {...(fsEvents ? { fsEvents } : {})} registry={associations} openService={openService} onClose={() => setPropertiesNode(null)} />
          </section>
        </div>
      ) : null}
    </div>
  );
}
