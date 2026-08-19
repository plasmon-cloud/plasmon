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
  type RectLike,
  type SelectionState,
} from "./model.ts";
import { directoryDropTargetId } from "./drop-target.ts";
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
  const dropTargetRef = useRef<NodeId | null>(null);
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

  const setActiveDropTarget = (id: NodeId | null) => {
    if (dropTargetRef.current === id) return;
    dropTargetRef.current = id;
    setDropTargetId(id);
  };

  const clearDropTarget = () => setActiveDropTarget(null);

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

    const targetId = dropTargetRef.current;
    const targetName = targetId ? nodes.find((node) => node.id === targetId)?.name : null;
    const feedbackText = dragOperationFeedback("move", targetName);
    const feedback = preview.querySelector<HTMLElement>("[data-fm-drag-feedback]");
    if (feedback) {
      feedback.textContent = feedbackText ?? "";
      feedback.hidden = feedbackText === null;
    }
    if (targetId) preview.dataset.fmDropTargetId = String(targetId);
    else delete preview.dataset.fmDropTargetId;
  };

  const applyDragVisual = () => {
    const active = dragRef.current;
    if (!active?.moved) return;
    updateDragPreview(active, dragPendingRef.current.dx, dragPendingRef.current.dy);
  };

  const clearDragVisual = () => {
    const active = dragRef.current;
    if (active) {
      for (const id of active.ids) {
        const element = entriesRef.current.get(id);
        if (!element) continue;
        element.style.transform = "";
        element.style.pointerEvents = "";
        element.classList.remove("is-dragging");
      }
    }
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
    resetDragFrame();
    removeDragPreview();
  }, []);

  const dragTargetAtPoint = (clientX: number, clientY: number): NodeId | null => {
    const active = dragRef.current;
    if (!active?.moved) return null;
    const elements = typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter((element): element is Element => element !== null);
    for (const element of elements) {
      const entry = element.closest<HTMLElement>("[data-fm-node-id]");
      const targetId = directoryDropTargetId(nodes, active.ids, entry?.dataset.fmNodeId);
      if (targetId) return targetId;
    }
    return null;
  };

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
    setActiveDropTarget(dragTargetAtPoint(event.clientX, event.clientY));
    dragPendingRef.current = {
      dx,
      dy,
      clientX: event.clientX,
      clientY: event.clientY,
    };
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
    const targetId = dragTargetAtPoint(event.clientX, event.clientY);
    resetDragFrame();
    clearDropTarget();
    clearDragVisual();
    dragRef.current = null;
    resetDragPending();
    releaseDragCapture(active);
    if (!outcome.shouldDrop) {
      setSelection(outcome.selection);
      return;
    }

    const ids = [...outcome.ids];
    const target = targetId ? nodes.find((node) => node.id === targetId) : undefined;
    const source = nodes.filter((node) => ids.includes(node.id));
    try {
      if (target?.kind === "directory") {
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
        await onDesktopReposition(
          ids,
          { dx, dy },
          { width: rect.width, height: rect.height },
        );
        setError(null);
      }
    } catch (cause: unknown) {
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
