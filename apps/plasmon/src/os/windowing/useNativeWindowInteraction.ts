import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { WindowGeometry, WindowManager, WindowState } from "../contracts/window.ts";
import {
  horizontalSnapGeometry,
  type HorizontalSnapSide,
  type WindowViewport,
} from "./geometry.ts";
import {
  anchoredRestoreGeometryForPointer,
  boundedDragGeometry,
  horizontalSnapSideAtPointer,
  resizeCursor,
  resizeGeometry,
  suspendDocumentSelection,
  suspendIframePointerEvents,
  type ResizeDirection,
} from "./interaction.ts";
import type {
  WindowGeometryCommitter,
  WindowSnapController,
  WindowStateReader,
} from "./NativeWindowManager.ts";

interface PointerInteraction {
  kind: "drag" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startGeometry: WindowGeometry;
  latestGeometry: WindowGeometry;
  direction?: ResizeDirection;
  captureTarget: HTMLElement;
  restoreIframePointerEvents: () => void;
  restoreDocumentSelection: () => void;
}

interface NativeWindowInteractionOptions {
  state: WindowState;
  manager: WindowManager;
  active: boolean;
  canResize: boolean;
  minWidth: number;
  minHeight: number;
}

interface PointerHandlers {
  onPointerDown(event: ReactPointerEvent<HTMLElement>): void;
  onPointerMove(event: ReactPointerEvent<HTMLElement>): void;
  onPointerUp(event: ReactPointerEvent<HTMLElement>): void;
  onPointerCancel(event: ReactPointerEvent<HTMLElement>): void;
  onLostPointerCapture(event: ReactPointerEvent<HTMLElement>): void;
}

interface NativeWindowSnapPreview {
  side: HorizontalSnapSide;
  geometry: WindowGeometry;
  host: HTMLElement;
}

interface NativeWindowInteractionBindings {
  rootRef: RefObject<HTMLDivElement | null>;
  snapSide: HorizontalSnapSide | null;
  snapped: boolean;
  snapPreview: NativeWindowSnapPreview | null;
  focusWindow(): void;
  titlebar: PointerHandlers;
  resize(direction: ResizeDirection): PointerHandlers;
}

function geometryOf(state: WindowState): WindowGeometry {
  return { x: state.x, y: state.y, width: state.width, height: state.height };
}

function viewportFor(element: HTMLElement): WindowViewport {
  const parent = element.parentElement;
  if (parent) {
    return {
      x: 0,
      y: 0,
      width: Math.max(1, parent.clientWidth),
      height: Math.max(1, parent.clientHeight),
    };
  }
  if (typeof window !== "undefined") {
    return {
      x: 0,
      y: 0,
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
    };
  }
  return { x: 0, y: 0, width: 1280, height: 720 };
}

function pointerFor(element: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const parent = element.parentElement;
  if (!parent) return { x: clientX, y: clientY };
  const bounds = parent.getBoundingClientRect();
  return { x: clientX - bounds.left, y: clientY - bounds.top };
}

function geometryCommitter(manager: WindowManager): WindowGeometryCommitter | null {
  const candidate = manager as WindowManager & Partial<WindowGeometryCommitter>;
  return typeof candidate.setGeometry === "function"
    ? candidate as WindowManager & WindowGeometryCommitter
    : null;
}

function stateReader(manager: WindowManager): WindowStateReader | null {
  const candidate = manager as WindowManager & Partial<WindowStateReader>;
  return typeof candidate.get === "function"
    ? candidate as WindowManager & WindowStateReader
    : null;
}

function snapController(manager: WindowManager): WindowSnapController | null {
  const candidate = manager as WindowManager & Partial<WindowSnapController>;
  return typeof candidate.snap === "function" && typeof candidate.getSnapSide === "function"
    ? candidate as WindowManager & WindowSnapController
    : null;
}

function pointerSnapSide(root: HTMLElement, clientX: number): HorizontalSnapSide | null {
  const parent = root.parentElement;
  if (!parent) return null;
  const bounds = parent.getBoundingClientRect();
  if (bounds.width <= 0) return null;
  return horizontalSnapSideAtPointer(clientX, { left: bounds.left, right: bounds.right });
}

export function useNativeWindowInteraction({
  state,
  manager,
  active,
  canResize,
  minWidth,
  minHeight,
}: NativeWindowInteractionOptions): NativeWindowInteractionBindings {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [snapPreviewSide, setSnapPreviewSide] = useState<HorizontalSnapSide | null>(null);
  const snapper = useMemo(() => snapController(manager), [manager]);
  const snapSide = snapper?.getSnapSide(state.id) ?? null;
  const snapped = snapSide !== null;
  const geometryConstraints = useMemo(() => ({ minWidth, minHeight }), [minHeight, minWidth]);

  const focusWindow = useCallback(() => {
    if (!active) manager.focus(state.id);
    rootRef.current?.focus({ preventScroll: true });
  }, [active, manager, state.id]);

  useEffect(() => {
    if (!active || state.minimized) return;
    const root = rootRef.current;
    if (!root || root.contains(document.activeElement)) return;
    root.focus({ preventScroll: true });
  }, [active, state.minimized, state.z]);

  const applyGeometry = useCallback((geometry: WindowGeometry) => {
    const root = rootRef.current;
    if (!root) return;
    root.style.left = `${geometry.x}px`;
    root.style.top = `${geometry.y}px`;
    root.style.width = `${geometry.width}px`;
    root.style.height = `${geometry.height}px`;
  }, []);

  const scheduleGeometry = useCallback((geometry: WindowGeometry) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    interaction.latestGeometry = geometry;
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const current = interactionRef.current;
      if (current) applyGeometry(current.latestGeometry);
    });
  }, [applyGeometry]);

  const clearInteraction = useCallback((
    commit: boolean,
    requestedSnapSide: HorizontalSnapSide | null = null,
  ) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    interactionRef.current = null;
    setSnapPreviewSide(null);
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const root = rootRef.current;
    if (root) delete root.dataset.interacting;
    interaction.restoreIframePointerEvents();
    interaction.restoreDocumentSelection();
    if (interaction.captureTarget.hasPointerCapture(interaction.pointerId)) {
      interaction.captureTarget.releasePointerCapture(interaction.pointerId);
    }

    if (!commit) {
      const authoritative = stateReader(manager)?.get(state.id);
      applyGeometry(authoritative ? geometryOf(authoritative) : geometryOf(state));
      return;
    }

    applyGeometry(interaction.latestGeometry);
    if (interaction.kind === "drag") {
      if (requestedSnapSide && snapper) {
        snapper.snap(state.id, requestedSnapSide, interaction.latestGeometry);
      } else {
        manager.move(state.id, interaction.latestGeometry.x, interaction.latestGeometry.y);
      }
      return;
    }

    const committer = geometryCommitter(manager);
    if (committer) {
      committer.setGeometry(state.id, interaction.latestGeometry);
    } else {
      manager.move(state.id, interaction.latestGeometry.x, interaction.latestGeometry.y);
      manager.resize(state.id, interaction.latestGeometry.width, interaction.latestGeometry.height);
    }
  }, [applyGeometry, manager, snapper, state]);

  useEffect(() => () => {
    const interaction = interactionRef.current;
    if (interaction) {
      interaction.restoreIframePointerEvents();
      interaction.restoreDocumentSelection();
    }
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const beginInteraction = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    kind: PointerInteraction["kind"],
    direction?: ResizeDirection,
  ) => {
    if (event.button !== 0 || state.minimized || (kind === "drag" && state.maximized)) return;
    if (kind === "resize" && (!canResize || state.maximized || snapped)) return;
    const root = rootRef.current;
    if (!root) return;

    event.preventDefault();
    event.stopPropagation();
    setSnapPreviewSide(null);

    let startGeometry = geometryOf(state);
    if (kind === "drag" && snapped) {
      const snappedGeometry = startGeometry;
      manager.restore(state.id);
      const restored = stateReader(manager)?.get(state.id);
      const restoreGeometry = restored ? geometryOf(restored) : state.restoreGeometry;
      if (restoreGeometry) {
        startGeometry = anchoredRestoreGeometryForPointer(
          snappedGeometry,
          restoreGeometry,
          pointerFor(root, event.clientX, event.clientY),
          viewportFor(root),
          geometryConstraints,
        );
        manager.move(state.id, startGeometry.x, startGeometry.y);
        applyGeometry(startGeometry);
      }
    }

    focusWindow();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    root.dataset.interacting = kind;
    const cursor = kind === "resize" && direction ? resizeCursor(direction) : "grabbing";
    interactionRef.current = {
      kind,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startGeometry,
      latestGeometry: startGeometry,
      ...(direction === undefined ? {} : { direction }),
      captureTarget: target,
      restoreIframePointerEvents: suspendIframePointerEvents(root.ownerDocument),
      restoreDocumentSelection: suspendDocumentSelection(cursor, root.ownerDocument),
    };
  }, [applyGeometry, canResize, focusWindow, geometryConstraints, manager, snapped, state]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    const root = rootRef.current;
    if (!interaction || !root || interaction.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - interaction.startClientX;
    const deltaY = event.clientY - interaction.startClientY;
    const viewport = viewportFor(root);
    if (interaction.kind === "drag") {
      setSnapPreviewSide(snapper ? pointerSnapSide(root, event.clientX) : null);
    }
    const next = interaction.kind === "resize" && interaction.direction
      ? resizeGeometry(
        interaction.startGeometry,
        interaction.direction,
        deltaX,
        deltaY,
        viewport,
        minWidth,
        minHeight,
      )
      : boundedDragGeometry(
        interaction.startGeometry,
        deltaX,
        deltaY,
        viewport,
        geometryConstraints,
      );
    scheduleGeometry(next);
  }, [geometryConstraints, minHeight, minWidth, scheduleGeometry, snapper]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    const root = rootRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    const requestedSnapSide = interaction.kind === "drag" && root && snapper
      ? pointerSnapSide(root, event.clientX)
      : null;
    clearInteraction(true, requestedSnapSide);
  }, [clearInteraction, snapper]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    clearInteraction(false);
  }, [clearInteraction]);

  const onLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    clearInteraction(true);
  }, [clearInteraction]);

  const titlebar = useMemo<PointerHandlers>(() => ({
    onPointerDown: (event) => beginInteraction(event, "drag"),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  }), [beginInteraction, onLostPointerCapture, onPointerCancel, onPointerMove, onPointerUp]);

  const resize = useCallback((direction: ResizeDirection): PointerHandlers => ({
    onPointerDown: (event) => beginInteraction(event, "resize", direction),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  }), [beginInteraction, onLostPointerCapture, onPointerCancel, onPointerMove, onPointerUp]);

  const previewRoot = rootRef.current;
  const previewHost = previewRoot?.parentElement ?? null;
  const snapPreview = snapPreviewSide && previewRoot && previewHost
    ? {
      side: snapPreviewSide,
      geometry: horizontalSnapGeometry(viewportFor(previewRoot), snapPreviewSide),
      host: previewHost,
    }
    : null;

  return {
    rootRef,
    snapSide,
    snapped,
    snapPreview,
    focusWindow,
    titlebar,
    resize,
  };
}
