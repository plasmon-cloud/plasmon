import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { allocateDesktopPositions } from "../desktop/layout.ts";
import {
  FileOperationClipboard,
  RefreshGate,
  captureMarqueeRectangles,
  clearSelection,
  decideEntryPointerSelection,
  emptySelection,
  isFsEventRelevant,
  marqueeSelection,
  moveNodesToDirectory,
  normalizeRect,
  reconcileSelection,
  renameNode,
  selectAll,
  selectNode,
  type RectLike,
  type SelectionState,
} from "./model.ts";
import { activateFileManagerNode, type FileManagerOpenAuthority } from "./activation.ts";
import { pasteClipboardCollisionAware } from "./clipboard.ts";
import {
  createDocument,
  createGeneratedFolder,
  importFileIntoFs,
  type NewDocumentKind,
} from "./create-import.ts";
import {
  createFileManagerShortcut,
  fileManagerShortcutTarget,
} from "./create-shortcut.ts";
import {
  deleteFailureMessage,
  deleteFilesystemNodes,
  type FileManagerTrashAuthority,
} from "./delete.ts";
import { downloadFsNode } from "./download.ts";
import { directoryDropTargetId } from "./drop-target.ts";
import { finishEntryDragGesture } from "./drag.ts";
import { ErrorBanner } from "./ErrorBanner.tsx";
import { FileEntry } from "./FileEntry.tsx";
import { fileManagerKeyboardCommand, isEditingKeyboardTarget } from "./keyboard.ts";
import type { InlineRenameState } from "./rename.ts";
import { readSharedShortcut } from "./shortcut.ts";
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
  openAuthority: FileManagerOpenAuthority;
  trashAuthority: FileManagerTrashAuthority;
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
type MarqueeVisual = { left: number; top: number; width: number; height: number } | null;

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function FileManager({
  directoryId,
  fs,
  openAuthority,
  trashAuthority,
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
  const [rename, setRename] = useState<InlineRenameState | null>(null);
  const [openWithNode, setOpenWithNode] = useState<FsNode | null>(null);
  const [propertiesNode, setPropertiesNode] = useState<FsNode | null>(null);
  const [marquee, setMarquee] = useState<MarqueeVisual>(null);
  const [dropTargetId, setDropTargetId] = useState<NodeId | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const entriesRef = useRef(new Map<NodeId, HTMLDivElement>());
  const refreshGateRef = useRef(new RefreshGate());
  const renameSessionRef = useRef(0);
  const renameCommitRef = useRef<NodeId | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const dragPendingRef = useRef({ dx: 0, dy: 0 });
  const dropTargetRef = useRef<NodeId | null>(null);
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
      setError(errorMessage(cause));
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
  const desktopRenderPositions = useMemo(
    () => presentation === "desktop" ? allocateDesktopPositions(positions ?? {}, visibleNodes) : {},
    [positions, presentation, visibleNodes],
  );

  useEffect(() => {
    onSnapshot?.({ nodes: visibleNodes, selectedIds: selection.ids });
  }, [onSnapshot, selection.ids, visibleNodes]);

  const selectedNodes = useCallback(() => {
    const ids = selection.ids;
    return nodes.filter((node) => ids.has(node.id));
  }, [nodes, selection.ids]);

  const beginInlineRename = (node: FsNode) => {
    renameSessionRef.current += 1;
    renameCommitRef.current = null;
    setRename({
      nodeId: node.id,
      value: node.name,
      initialName: node.name,
      session: renameSessionRef.current,
      error: null,
      busy: false,
    });
  };

  const openNode = useCallback(async (node: FsNode) => {
    setContextMenu(null);
    try {
      await activateFileManagerNode(
        openAuthority,
        node,
        onOpenDirectory ? { onOpenDirectory } : {},
      );
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  }, [onOpenDirectory, openAuthority]);

  const startRename = (node: FsNode) => {
    setContextMenu(null);
    beginInlineRename(node);
  };

  const commitRename = async () => {
    if (!rename || rename.busy || renameCommitRef.current === rename.nodeId) return;
    const state = rename;
    if (state.value === state.initialName) {
      setRename(null);
      setError(null);
      return;
    }
    renameCommitRef.current = state.nodeId;
    setRename({ ...state, busy: true, error: null });
    try {
      await renameNode(fs, state.nodeId, state.value);
      setRename(null);
      setError(null);
      await refresh();
    } catch (cause: unknown) {
      renameCommitRef.current = null;
      setRename({ ...state, busy: false, error: errorMessage(cause) });
    }
  };

  const cancelRename = () => {
    renameCommitRef.current = null;
    setRename(null);
  };

  const createNewFolder = async () => {
    setContextMenu(null);
    try {
      const created = await createGeneratedFolder(fs, directoryId);
      setError(null);
      await refresh();
      setSelection({ ids: new Set([created.id]), anchor: created.id, focus: created.id });
      beginInlineRename(created);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  };

  const removeNodes = async (items: readonly FsNode[]) => {
    if (items.length === 0) return;
    const permitted = confirmDelete ? await confirmDelete(items) : true;
    if (!permitted) return;
    try {
      const result = await deleteFilesystemNodes(trashAuthority, items);
      if (result.failures.length === 0) setSelection(clearSelection());
      setContextMenu(null);
      await refresh();
      const failure = deleteFailureMessage(result.failures);
      if (failure) setError(failure);
    } catch (cause: unknown) {
      await refresh();
      setError(errorMessage(cause));
    }
  };

  const removeSelected = async () => removeNodes(selectedNodes());

  const copySelection = (ids: Iterable<NodeId> = selection.ids) => {
    clipboard.copy(ids);
    setError(null);
  };

  const cutSelection = (ids: Iterable<NodeId> = selection.ids) => {
    clipboard.cut(ids);
    setError(null);
  };

  const paste = async () => {
    try {
      await pasteClipboardCollisionAware(fs, directoryId, clipboard);
      setError(null);
      await refresh();
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  };

  const createNewDocument = async (kind: NewDocumentKind) => {
    setContextMenu(null);
    try {
      const created = await createDocument(fs, directoryId, kind);
      setError(null);
      await refresh();
      setSelection({ ids: new Set([created.id]), anchor: created.id, focus: created.id });
      beginInlineRename(created);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  };

  const createShortcutFromSelection = async () => {
    const target = fileManagerShortcutTarget(nodes, selection.ids);
    if (!target) return;
    setContextMenu(null);
    try {
      const result = await createFileManagerShortcut(fs, directoryId, target);
      setError(null);
      await refresh();
      setSelection(result.selection);
      beginInlineRename(result.shortcut);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
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
        failures.push(`${file.name}: ${errorMessage(cause)}`);
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

  const downloadNode = async (node: FsNode) => {
    setContextMenu(null);
    try {
      await downloadFsNode(fs, node);
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  };

  const setActiveDropTarget = (id: NodeId | null) => {
    if (dropTargetRef.current === id) return;
    dropTargetRef.current = id;
    setDropTargetId(id);
  };

  const clearDropTarget = () => setActiveDropTarget(null);

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
      if (!element) continue;
      element.style.transform = "";
      element.style.pointerEvents = "";
      element.classList.remove("is-dragging");
    }
  };

  const dragTargetAtPoint = (clientX: number, clientY: number): NodeId | null => {
    const active = dragRef.current;
    if (!active?.moved) return null;
    const underPointer = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-fm-node-id]");
    return directoryDropTargetId(nodes, active.ids, underPointer?.dataset.fmNodeId);
  };

  const handleEntryPointerDown = (node: FsNode, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || rename?.nodeId === node.id) return;
    setContextMenu(null);
    clearDropTarget();
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
    setActiveDropTarget(dragTargetAtPoint(event.clientX, event.clientY));
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
    const targetId = dragTargetAtPoint(event.clientX, event.clientY);
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    clearDropTarget();
    clearDragVisual();
    dragRef.current = null;
    dragPendingRef.current = { dx: 0, dy: 0 };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!outcome.shouldDrop) {
      setSelection(outcome.selection);
      return;
    }

    const ids = [...outcome.ids];
    const target = targetId ? nodes.find((node) => node.id === targetId) : undefined;
    const source = nodes.filter((node) => ids.includes(node.id));
    try {
      if (target?.kind === "directory") {
        await moveNodesToDirectory(fs, source, target);
        setError(null);
        await refresh();
        return;
      }
      if (presentation === "desktop" && onDesktopReposition && rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        await onDesktopReposition(ids, { dx, dy }, { width: rect.width, height: rect.height });
        setError(null);
      }
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  };

  const handleEntryPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const outcome = finishEntryDragGesture(active, selection, true);
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    clearDropTarget();
    clearDragVisual();
    dragRef.current = null;
    dragPendingRef.current = { dx: 0, dy: 0 };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
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
    if (isEditingKeyboardTarget(event.target)) return;
    const commandModifier = event.ctrlKey || event.metaKey;
    const command = fileManagerKeyboardCommand(event.key, commandModifier);
    if (command) {
      event.preventDefault();
      if (command === "selectAll") setSelection(selectAll(orderedIds));
      else if (command === "copy") copySelection();
      else if (command === "cut") cutSelection();
      else if (command === "paste") void paste();
      else if (command === "delete") void removeSelected();
      else if (command === "rename") {
        const id = selection.focus ?? selection.ids.values().next().value as NodeId | undefined;
        const node = id ? nodes.find((entry) => entry.id === id) : undefined;
        if (node) startRename(node);
      }
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
      if (rename) cancelRename();
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
      if (nextId) setSelection(selectNode(selection, orderedIds, nextId, { range: event.shiftKey, additive: commandModifier }));
    }
  };

  const contextNode = contextMenu?.nodeId ? nodes.find((node) => node.id === contextMenu.nodeId) ?? null : null;
  const canOpenWith = Boolean(contextNode && contextNode.kind !== "directory" && !readSharedShortcut(contextNode) && associations && openService);
  const canCreateShortcut = fileManagerShortcutTarget(nodes, selection.ids) !== null;

  const menuAction = (action: "open" | "openWith" | "download" | "cut" | "copy" | "createShortcut" | "rename" | "delete" | "properties" | "newFolder" | "newText" | "newMarkdown" | "import" | "paste") => {
    if (action === "newFolder") { void createNewFolder(); return; }
    if (action === "newText") { void createNewDocument("text"); return; }
    if (action === "newMarkdown") { void createNewDocument("markdown"); return; }
    if (action === "import") { triggerImport(); return; }
    if (action === "paste") { setContextMenu(null); void paste(); return; }
    if (action === "createShortcut") { void createShortcutFromSelection(); return; }
    if (!contextNode) return;
    if (action === "open") { void openNode(contextNode); return; }
    if (action === "openWith") { setContextMenu(null); if (canOpenWith) setOpenWithNode(contextNode); return; }
    if (action === "download") { void downloadNode(contextNode); return; }
    if (action === "cut") { cutSelection(selection.ids.has(contextNode.id) ? selection.ids : [contextNode.id]); setContextMenu(null); return; }
    if (action === "copy") { copySelection(selection.ids.has(contextNode.id) ? selection.ids : [contextNode.id]); setContextMenu(null); return; }
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
      onKeyDownCapture={handleKeyDown}
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
          <button type="button" onClick={() => void createNewFolder()}>New Folder</button>
          <button type="button" onClick={() => void createNewDocument("text")}>New Text Document</button>
          <button type="button" onClick={() => void createNewDocument("markdown")}>New Markdown Document</button>
          <button type="button" onClick={triggerImport}>Import Files…</button>
          <button type="button" onClick={() => copySelection()} disabled={selection.ids.size === 0}>Copy</button>
          <button type="button" onClick={() => cutSelection()} disabled={selection.ids.size === 0}>Cut</button>
          <button type="button" onClick={() => void createShortcutFromSelection()} disabled={!canCreateShortcut}>Create Shortcut</button>
          <button type="button" onClick={() => void paste()} disabled={!clipboard.snapshot()}>Paste</button>
          <button type="button" onClick={() => void removeSelected()} disabled={selection.ids.size === 0}>Delete</button>
          <button type="button" onClick={() => void refresh()}>Refresh</button>
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={() => void refresh()} /> : null}
      {loading && nodes.length === 0 ? <p className="fm-empty">Loading…</p> : null}

      {presentation === "details" ? (
        <div className="fm-details-head" aria-hidden="true"><span>Name</span><span>Type</span><span>Size</span><span>Modified</span></div>
      ) : null}

      <div className="fm-entries">
        {visibleNodes.map((node) => (
          <FileEntry
            key={node.id}
            fs={fs}
            {...(associations ? { associations } : {})}
            node={node}
            selected={selection.ids.has(node.id)}
            focused={selection.focus === node.id}
            dropTarget={dropTargetId === node.id}
            presentation={presentation}
            {...(presentation === "desktop" ? { position: desktopRenderPositions[node.id] } : {})}
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
              event.preventDefault();
              event.stopPropagation();
              if (!selection.ids.has(node.id)) setSelection(selectNode(emptySelection(), orderedIds, node.id));
              setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
            }}
            onRenameChange={(value) => setRename((current) => current ? { ...current, value, error: null } : null)}
            onRenameCommit={() => void commitRename()}
            onRenameCancel={cancelRename}
          />
        ))}
      </div>

      {!loading && visibleNodes.length === 0 ? <p className="fm-empty">This folder is empty.</p> : null}
      {marquee ? <div className="fm-marquee" aria-hidden="true" style={marquee} /> : null}

      {contextMenu ? (
        <div
          className="fm-context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => event.preventDefault()}
        >
          {contextNode ? (
            <>
              <button type="button" role="menuitem" onClick={() => menuAction("open")}>Open</button>
              {contextNode.kind !== "directory" ? <button type="button" role="menuitem" disabled={!canOpenWith} title={canOpenWith ? undefined : "Association service unavailable"} onClick={() => menuAction("openWith")}>Open With…</button> : null}
              {contextNode.kind === "file" ? <button type="button" role="menuitem" onClick={() => menuAction("download")}>Download</button> : null}
              <div className="fm-menu-separator" role="separator" />
              <button type="button" role="menuitem" onClick={() => menuAction("cut")}>Cut</button>
              <button type="button" role="menuitem" onClick={() => menuAction("copy")}>Copy</button>
              <button type="button" role="menuitem" disabled={!canCreateShortcut} onClick={() => menuAction("createShortcut")}>Create Shortcut</button>
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
