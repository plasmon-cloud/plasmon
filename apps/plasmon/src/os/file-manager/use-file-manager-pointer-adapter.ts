import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { FsNode, FsService, NodeId } from "../contracts/index.ts";
import {
  captureMarqueeRectangles,
  clearSelection,
  decideEntryPointerSelection,
  marqueeSelection,
  moveNodesToDirectory,
  normalizeRect,
  validateDirectoryDrop,
  type RectLike,
  type SelectionState,
} from "./model.ts";
import { directoryDropCandidateId } from "./drop-target.ts";
import { finishEntryDragGesture } from "./drag.ts";
import {
  dragOperationFeedback,
  translatedDragPreviewRect,
  type DragPreviewRect,
} from "./drag-preview.ts";
import type { FileOperationState } from "./operation-state.ts";
import type { FileManagerPresentation } from "./render-state.ts";

export interface MarqueeVisual {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UseFileManagerPointerAdapterOptions {
  fs: FsService;
  nodes: readonly FsNode[];
  orderedIds: readonly NodeId[];
  selection: SelectionState;
  presentation: FileManagerPresentation;
  renameNodeId: NodeId | null;
  operationState: FileOperationState;
  refresh: () => Promise<void>;
  setSelection: Dispatch<SetStateAction<SelectionState>>;
  setError: Dispatch<SetStateAction<string | null>>;
  closeContextMenu: () => void;
  onDesktopReposition?: (
    ids: readonly NodeId[],
    delta: { dx: number; dy: number },
    bounds: { width: number; height: number },
  ) => void | Promise<void>;
}

interface EntryDragState {
  pointerId: number;
  startX: number;
  startY: number;
  sourceId: NodeId;
  sourceRect: DragPreviewRect;
  ids: NodeId[];
  moved: boolean;
  releaseSelection: SelectionState | null;
  captureElement: HTMLDivElement;
}

interface DragPendingVisual {
  dx: number;
  dy: number;
  clientX: number;
  clientY: number;
}

interface DragDropCandidate {
  id: NodeId;
  element: HTMLElement;
}

interface ActiveDropTarget {
  node: FsNode;
  element: HTMLElement;
}

interface MarqueePointerState {
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
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function cloneDragEntry(source: HTMLDivElement, sourceRect: DragPreviewRect): HTMLDivElement {
  const clone = source.cloneNode(true) as HTMLDivElement;
  clone.classList.remove("is-selected", "is-focused", "is-drop-target", "is-dragging", "is-renaming");
  clone.classList.add("fm-drag-preview__entry");
  clone.removeAttribute("data-fm-node-id");
  clone.removeAttribute("role");
  clone.removeAttribute("tabindex");
  clone.removeAttribute("aria-selected");
  clone.querySelectorAll("[data-fm-node-id]").forEach((element) => element.removeAttribute("data-fm-node-id"));
  clone.querySelectorAll(".fm-entry__expanded-name, .fm-entry__selection-mark, .fm-inline-error").forEach((element) => element.remove());
  Object.assign(clone.style, {
    left: "0px",
    top: "0px",
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
    transform: "none",
    pointerEvents: "none",
  });
  return clone;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function useFileManagerPointerAdapter(options: UseFileManagerPointerAdapterOptions) {
  const {
    fs,
    nodes,
    orderedIds,
    selection,
    presentation,
    renameNodeId,
    operationState,
    refresh,
    setSelection,
    setError,
    closeContextMenu,
    onDesktopReposition,
  } = options;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const entriesRef = useRef(new Map<NodeId, HTMLDivElement>());
  const dragFrameRef = useRef<number | null>(null);
  const dragPendingRef = useRef<DragPendingVisual>({
    dx: 0,
    dy: 0,
    clientX: 0,
    clientY: 0,
  });
  const dropTargetRef = useRef<ActiveDropTarget | null>(null);
  const dropCandidateRef = useRef<DragDropCandidate | null>(null);
  const dropTargetGenerationRef = useRef(0);
  const dragRef = useRef<EntryDragState | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const marqueeFrameRef = useRef<number | null>(null);
  const marqueePointerRef = useRef<MarqueePointerState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeVisual | null>(null);
  const [dropTargetId, setDropTargetId] = useState<NodeId | null>(null);

  const setEntryRef = (id: NodeId, element: HTMLDivElement | null) => {
    if (element) entriesRef.current.set(id, element);
    else entriesRef.current.delete(id);
  };

  const entryRectangles = (): ReadonlyMap<NodeId, RectLike> => {
    const rectangles = new Map<NodeId, RectLike>();
    for (const id of orderedIds) {
      const rect = entriesRef.current.get(id)?.getBoundingClientRect();
      if (rect) {
        rectangles.set(id, {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        });
      }
    }
    return rectangles;
  };

  const removeDropTargetVisual = () => {
    dropTargetRef.current?.element.classList.remove("is-drop-target");
    dropTargetRef.current = null;
  };

  const setActiveDropTarget = (target: ActiveDropTarget | null) => {
    const current = dropTargetRef.current;
    if (current?.node.id === target?.node.id && current?.element === target?.element) return;
    current?.element.classList.remove("is-drop-target");
    dropTargetRef.current = target;
    target?.element.classList.add("is-drop-target");
    const localEntry = target ? entriesRef.current.get(target.node.id) : null;
    setDropTargetId(target && localEntry === target.element ? target.node.id : null);
  };

  const clearDropTarget = () => {
    dropTargetGenerationRef.current += 1;
    dropCandidateRef.current = null;
    setActiveDropTarget(null);
  };

  const removeDragPreview = () => {
    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;
  };

  const createDragPreview = (active: EntryDragState): HTMLDivElement => {
    const preview = document.createElement("div");
    preview.className = "fm-drag-preview";
    preview.dataset.fmDragPreview = "true";
    preview.dataset.fmDragSourceId = String(active.sourceId);
    preview.dataset.fmDragCount = String(active.ids.length);
    preview.setAttribute("aria-hidden", "true");
    preview.append(cloneDragEntry(active.captureElement, active.sourceRect));

    if (active.ids.length > 1) {
      const count = document.createElement("span");
      count.className = "fm-drag-preview__count";
      count.textContent = String(active.ids.length);
      preview.append(count);
    }

    const feedback = document.createElement("span");
    feedback.className = "fm-drag-preview__feedback";
    feedback.dataset.fmDragFeedback = "true";
    feedback.hidden = true;
    preview.append(feedback);

    document.body.append(preview);
    dragPreviewRef.current = preview;
    return preview;
  };

  const updateDragPreview = (active: EntryDragState, dx: number, dy: number) => {
    const preview = dragPreviewRef.current ?? createDragPreview(active);
    const rect = translatedDragPreviewRect(active.sourceRect, { dx, dy });
    Object.assign(preview.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    const target = dropTargetRef.current?.node ?? null;
    const feedbackText = dragOperationFeedback("move", target?.name);
    const feedback = preview.querySelector<HTMLElement>("[data-fm-drag-feedback]");
    if (feedback) {
      feedback.textContent = feedbackText ?? "";
      feedback.hidden = feedbackText === null;
    }
    if (target) preview.dataset.fmDropTargetId = String(target.id);
    else delete preview.dataset.fmDropTargetId;
  };

  const applyDragVisual = () => {
    const active = dragRef.current;
    if (!active?.moved) return;
    updateDragPreview(active, dragPendingRef.current.dx, dragPendingRef.current.dy);
  };

  const restoreDraggedEntries = (active: EntryDragState | null = dragRef.current) => {
    if (!active) return;
    for (const id of active.ids) {
      const element = entriesRef.current.get(id);
      if (!element) continue;
      element.style.transform = "";
      element.style.pointerEvents = "";
      element.classList.remove("is-dragging");
    }
  };

  const clearDragVisual = () => {
    restoreDraggedEntries();
    removeDragPreview();
  };

  const resetDragFrame = () => {
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
  };

  const resetDragPending = () => {
    dragPendingRef.current = { dx: 0, dy: 0, clientX: 0, clientY: 0 };
  };

  const releaseDragCapture = (active: EntryDragState) => {
    if (active.captureElement.hasPointerCapture(active.pointerId)) {
      active.captureElement.releasePointerCapture(active.pointerId);
    }
  };

  const sourceNodesFor = (active: EntryDragState): FsNode[] => {
    const ids = new Set(active.ids);
    return nodes.filter((node) => ids.has(node.id));
  };

  const dragCandidateAtPoint = (
    active: EntryDragState,
    clientX: number,
    clientY: number,
  ): DragDropCandidate | null => {
    if (!active.moved) return null;
    const elements = typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter((element): element is Element => element !== null);

    const seenEntries = new Set<HTMLElement>();
    const seenSurfaces = new Set<HTMLElement>();
    for (const element of elements) {
      const entry = element.closest<HTMLElement>("[data-fm-node-id]");
      if (entry && !seenEntries.has(entry)) {
        seenEntries.add(entry);
        const id = entry.dataset.fmNodeId;
        if (!id) return null;
        const candidateId = directoryDropCandidateId([
          {
            kind: "entry",
            nodeId: id,
            nodeKind: entry.dataset.fmKind as FsNode["kind"] | undefined,
          },
        ], active.ids);
        // A visible resource entry blocks its containing directory surface. A
        // normal file therefore means "no target" instead of "drop in folder".
        return candidateId ? { id: candidateId, element: entry } : null;
      }

      const surface = element.closest<HTMLElement>("[data-fm-directory-id]");
      if (!surface || seenSurfaces.has(surface)) continue;
      seenSurfaces.add(surface);
      const directoryId = surface.dataset.fmDirectoryId;
      if (!directoryId) continue;
      const candidateId = directoryDropCandidateId([
        { kind: "surface", directoryId },
      ], active.ids);
      if (candidateId) return { id: candidateId, element: surface };
    }
    return null;
  };

  const resolveCanonicalDropTarget = async (
    active: EntryDragState,
    candidate: DragDropCandidate | null,
  ): Promise<FsNode | null> => {
    if (!candidate) return null;
    const source = sourceNodesFor(active);
    if (source.length !== active.ids.length) return null;
    try {
      const target = await fs.stat(candidate.id);
      await validateDirectoryDrop(fs, source, target);
      return target;
    } catch {
      return null;
    }
  };

  const resolveDropCandidate = (active: EntryDragState, candidate: DragDropCandidate | null) => {
    const previous = dropCandidateRef.current;
    if (previous?.id === candidate?.id && previous?.element === candidate?.element) return;
    dropCandidateRef.current = candidate;
    const generation = ++dropTargetGenerationRef.current;
    setActiveDropTarget(null);
    applyDragVisual();
    if (!candidate) return;

    void resolveCanonicalDropTarget(active, candidate).then((target) => {
      if (
        generation !== dropTargetGenerationRef.current
        || dragRef.current !== active
        || dropCandidateRef.current?.id !== candidate.id
        || dropCandidateRef.current.element !== candidate.element
      ) return;
      if (target) setActiveDropTarget({ node: target, element: candidate.element });
      applyDragVisual();
    });
  };

  const cancelActiveEntryDrag = (): boolean => {
    const active = dragRef.current;
    if (!active) return false;
    const outcome = finishEntryDragGesture(active, selectionRef.current, true);
    resetDragFrame();
    clearDropTarget();
    clearDragVisual();
    dragRef.current = null;
    resetDragPending();
    releaseDragCapture(active);
    setSelection(outcome.selection);
    return true;
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !cancelActiveEntryDrag()) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  });

  useEffect(() => () => {
    dropTargetGenerationRef.current += 1;
    resetDragFrame();
    removeDropTargetVisual();
    removeDragPreview();
  }, []);

  const handleEntryPointerDown = (
    node: FsNode,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || renameNodeId === node.id) return;
    closeContextMenu();
    clearDropTarget();
    clearDragVisual();
    rootRef.current?.focus({ preventScroll: true });
    const decision = decideEntryPointerSelection(selection, orderedIds, node.id, {
      additive: event.ctrlKey || event.metaKey,
      range: event.shiftKey,
    });
    setSelection(decision.selection);
    const sourceRect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      sourceId: node.id,
      sourceRect: {
        left: sourceRect.left,
        top: sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
      },
      ids: [...decision.dragIds],
      moved: false,
      releaseSelection: decision.releaseSelection,
      captureElement: event.currentTarget,
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
    dragPendingRef.current = {
      dx,
      dy,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    resolveDropCandidate(active, dragCandidateAtPoint(active, event.clientX, event.clientY));
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      applyDragVisual();
    });
  };

  const handleEntryPointerUp = async (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const { dx, dy } = dragPendingRef.current;
    const outcome = finishEntryDragGesture(active, selectionRef.current, false);
    const candidate = dragCandidateAtPoint(active, event.clientX, event.clientY);
    const resolved = dropTargetRef.current;
    const target = candidate && resolved?.node.id === candidate.id && resolved.element === candidate.element
      ? resolved.node
      : await resolveCanonicalDropTarget(active, candidate);

    resetDragFrame();
    clearDropTarget();
    restoreDraggedEntries(active);
    dragRef.current = null;
    resetDragPending();
    releaseDragCapture(active);
    if (!outcome.shouldDrop) {
      removeDragPreview();
      setSelection(outcome.selection);
      return;
    }

    const ids = [...outcome.ids];
    const source = sourceNodesFor(active);
    try {
      if (target?.kind === "directory") {
        removeDragPreview();
        if (!operationState.begin("move", source.length)) {
          setError("Another file operation is already running");
          return;
        }
        try {
          await moveNodesToDirectory(fs, source, target, {
            onItemStart: (index, node) => operationState.startItem(index, node.name),
            onItemSuccess: () => operationState.succeedItem(),
            onItemFailure: (_index, node, cause) => operationState.failItem(node.name, errorMessage(cause)),
          });
          operationState.complete();
          setError(null);
          await refresh();
        } catch (cause: unknown) {
          const message = errorMessage(cause);
          if (operationState.isRunning()) {
            if (operationState.snapshot().failedItems > 0) operationState.complete();
            else operationState.fail(message);
          }
          try {
            await refresh();
            setError(message);
          } catch (refreshCause: unknown) {
            setError(`${message} (refresh failed: ${errorMessage(refreshCause)})`);
          }
        }
        return;
      }
      if (presentation === "desktop" && onDesktopReposition && rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        const reposition = Promise.resolve(onDesktopReposition(
          ids,
          { dx, dy },
          { width: rect.width, height: rect.height },
        ));
        // Desktop queues the canonical position before its persistence await.
        // Keep the faithful ghost for one render frame so release transitions
        // directly from the previewed rectangle to the authoritative entry.
        await nextAnimationFrame();
        removeDragPreview();
        await reposition;
        setError(null);
        return;
      }
      removeDragPreview();
    } catch (cause: unknown) {
      removeDragPreview();
      setError(errorMessage(cause));
    }
  };

  const handleEntryPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    cancelActiveEntryDrag();
  };

  const processMarquee = () => {
    marqueeFrameRef.current = null;
    const active = marqueePointerRef.current;
    if (!active) return;
    const clientRect = normalizeRect(
      active.startX,
      active.startY,
      active.currentX,
      active.currentY,
    );
    setMarquee({
      left: clientRect.left - active.rootLeft,
      top: clientRect.top - active.rootTop,
      width: clientRect.right - clientRect.left,
      height: clientRect.bottom - clientRect.top,
    });
    const ids = marqueeSelection(
      active.base,
      active.entryRects,
      clientRect,
      active.toggle,
    );
    setSelection({ ids, anchor: active.anchor, focus: [...ids].at(-1) ?? null });
  };

  const handleBackgroundPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (presentation !== "desktop" || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-fm-node-id],button,input")) return;
    closeContextMenu();
    const toggle = event.ctrlKey || event.metaKey;
    const base = toggle ? new Set(selection.ids) : new Set<NodeId>();
    const rootRect = event.currentTarget.getBoundingClientRect();
    const entryRects = captureMarqueeRectangles(orderedIds, (id) => {
      const rect = entriesRef.current.get(id)?.getBoundingClientRect();
      return rect
        ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        : null;
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
    if (marqueeFrameRef.current === null) {
      marqueeFrameRef.current = requestAnimationFrame(processMarquee);
    }
  };

  const finishMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = marqueePointerRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (marqueeFrameRef.current !== null) cancelAnimationFrame(marqueeFrameRef.current);
    marqueeFrameRef.current = null;
    marqueePointerRef.current = null;
    setMarquee(null);
  };

  return {
    rootRef,
    marquee,
    dropTargetId,
    setEntryRef,
    entryRectangles,
    handleEntryPointerDown,
    handleEntryPointerMove,
    handleEntryPointerUp,
    handleEntryPointerCancel,
    handleBackgroundPointerDown,
    handleBackgroundPointerMove,
    finishMarquee,
  };
}