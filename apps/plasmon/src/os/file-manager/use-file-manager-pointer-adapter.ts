import {
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
  ids: NodeId[];
  moved: boolean;
  releaseSelection: SelectionState | null;
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

export function useFileManagerPointerAdapter(options: UseFileManagerPointerAdapterOptions) {
  const {
    fs,
    nodes,
    orderedIds,
    selection,
    presentation,
    renameNodeId,
    refresh,
    setSelection,
    setError,
    closeContextMenu,
    onDesktopReposition,
  } = options;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const entriesRef = useRef(new Map<NodeId, HTMLDivElement>());
  const dragFrameRef = useRef<number | null>(null);
  const dragPendingRef = useRef({ dx: 0, dy: 0 });
  const dropTargetRef = useRef<NodeId | null>(null);
  const dragRef = useRef<EntryDragState | null>(null);
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
    const underPointer = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-fm-node-id]");
    return directoryDropTargetId(nodes, active.ids, underPointer?.dataset.fmNodeId);
  };

  const handleEntryPointerDown = (
    node: FsNode,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || renameNodeId === node.id) return;
    closeContextMenu();
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!outcome.shouldDrop) {
      setSelection(outcome.selection);
      return;
    }

    const ids = [...outcome.ids];
    const target = targetId ? nodes.find((node) => node.id === targetId) : undefined;
    const source = nodes.filter((node) => ids.includes(node.id));
    try {
      if (target?.kind === "directory") {
        // #92 remains separate: this preserves the existing direct drag-move path.
        await moveNodesToDirectory(fs, source, target);
        setError(null);
        await refresh();
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
    const outcome = finishEntryDragGesture(active, selection, true);
    if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    clearDropTarget();
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
