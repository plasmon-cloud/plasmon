import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { ProcessId, WindowId } from "../contracts/common.ts";
import type { WindowGeometry, WindowManager, WindowState } from "../contracts/window.ts";
import {
  DEFAULT_MIN_HEIGHT,
  DEFAULT_MIN_WIDTH,
  constrainGeometry,
  type HorizontalSnapSide,
  type WindowViewport,
} from "./geometry.ts";
import {
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
import "./windowing.scss";

const RESIZE_DIRECTIONS: readonly ResizeDirection[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const CLOSE_FALLBACK_MS = 500;

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

export interface NativeWindowProps {
  state: WindowState;
  manager: WindowManager;
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  active?: boolean;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  canResize?: boolean;
  /** Return false when the owning lifecycle rejects or defers this close request. */
  onRequestClose?: (id: WindowId, processId: ProcessId) => boolean | void;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function geometryOf(state: WindowState): WindowGeometry {
  return { x: state.x, y: state.y, width: state.width, height: state.height };
}

function viewportFor(element: HTMLElement): WindowViewport {
  const parent = element.parentElement;
  if (parent) return { x: 0, y: 0, width: Math.max(1, parent.clientWidth), height: Math.max(1, parent.clientHeight) };
  if (typeof window !== "undefined") return { x: 0, y: 0, width: Math.max(1, window.innerWidth), height: Math.max(1, window.innerHeight) };
  return { x: 0, y: 0, width: 1280, height: 720 };
}

function geometryCommitter(manager: WindowManager): WindowGeometryCommitter | null {
  const candidate = manager as WindowManager & Partial<WindowGeometryCommitter>;
  return typeof candidate.setGeometry === "function" ? candidate as WindowManager & WindowGeometryCommitter : null;
}

function stateReader(manager: WindowManager): WindowStateReader | null {
  const candidate = manager as WindowManager & Partial<WindowStateReader>;
  return typeof candidate.get === "function" ? candidate as WindowManager & WindowStateReader : null;
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

function MinimizeIcon(): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" focusable="false">
      <path d="M2 8.5h8" />
    </svg>
  );
}

function MaximizeIcon(): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" focusable="false">
      <rect x="2.25" y="2.25" width="7.5" height="7.5" rx="0.35" />
    </svg>
  );
}

function RestoreIcon(): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" focusable="false">
      <path d="M4 3.25h5.25V8.5H8" />
      <rect x="2.25" y="4.25" width="5.5" height="5.5" rx="0.35" />
    </svg>
  );
}

function CloseIcon(): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" focusable="false">
      <path d="m2.5 2.5 7 7m0-7-7 7" />
    </svg>
  );
}

export function NativeWindow({
  state,
  manager,
  title,
  icon,
  children,
  active = false,
  className,
  contentClassName,
  ariaLabel,
  canResize = true,
  onRequestClose,
}: NativeWindowProps): ReactNode {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const minWidth = state.minWidth ?? DEFAULT_MIN_WIDTH;
  const minHeight = state.minHeight ?? DEFAULT_MIN_HEIGHT;
  const snapper = snapController(manager);
  const snapSide = snapper?.getSnapSide(state.id) ?? null;
  const snapped = snapSide !== null;

  const style = useMemo<CSSProperties>(() => ({
    left: state.x,
    top: state.y,
    width: state.width,
    height: state.height,
    minWidth: state.maximized || snapped ? 0 : minWidth,
    minHeight: state.maximized || snapped ? 0 : minHeight,
    zIndex: state.z,
  }), [state.x, state.y, state.width, state.height, state.z, state.maximized, snapped, minWidth, minHeight]);

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

  const clearInteraction = useCallback((commit: boolean, requestedSnapSide: HorizontalSnapSide | null = null) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    interactionRef.current = null;
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
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
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

    let startGeometry = geometryOf(state);
    if (kind === "drag" && snapped) {
      manager.restore(state.id);
      const restored = stateReader(manager)?.get(state.id);
      if (restored) {
        startGeometry = geometryOf(restored);
        applyGeometry(startGeometry);
      } else if (state.restoreGeometry) {
        startGeometry = { ...state.restoreGeometry };
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
  }, [applyGeometry, canResize, focusWindow, manager, snapped, state]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    const root = rootRef.current;
    if (!interaction || !root || interaction.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - interaction.startClientX;
    const deltaY = event.clientY - interaction.startClientY;
    const viewport = viewportFor(root);
    const next = interaction.kind === "resize" && interaction.direction
      ? resizeGeometry(interaction.startGeometry, interaction.direction, deltaX, deltaY, viewport, minWidth, minHeight)
      : constrainGeometry({
          ...interaction.startGeometry,
          x: interaction.startGeometry.x + deltaX,
          y: interaction.startGeometry.y + deltaY,
        }, viewport, { minWidth, minHeight });
    scheduleGeometry(next);
  }, [minHeight, minWidth, scheduleGeometry]);

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

  const toggleMaximize = useCallback(() => {
    focusWindow();
    if (state.maximized) manager.restore(state.id);
    else manager.maximize(state.id);
  }, [focusWindow, manager, state.id, state.maximized]);

  const finalizeClose = useCallback(() => {
    if (!closingRef.current) return;
    closingRef.current = false;
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (onRequestClose) {
      const accepted = onRequestClose(state.id, state.processId) !== false;
      if (!accepted) setClosing(false);
      return;
    }
    manager.close(state.id);
  }, [manager, onRequestClose, state.id, state.processId]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(finalizeClose, CLOSE_FALLBACK_MS);
  }, [finalizeClose]);

  const rootClassName = classNames(
    "plasmon-window",
    active && "plasmon-window--active",
    state.minimized && "plasmon-window--minimized",
    state.maximized && "plasmon-window--maximized",
    snapped && "plasmon-window--snapped",
    closing && "plasmon-window--closing",
    className,
  );

  return (
    <div
      ref={rootRef}
      className={rootClassName}
      style={style}
      role="dialog"
      aria-label={ariaLabel ?? title}
      aria-hidden={state.minimized || undefined}
      inert={state.minimized}
      tabIndex={-1}
      data-window-id={state.id}
      data-window-snap={snapSide ?? undefined}
      onPointerDown={focusWindow}
      onAnimationEnd={closing ? finalizeClose : undefined}
    >
      <header
        className="plasmon-window__titlebar"
        onPointerDown={(event: ReactPointerEvent<HTMLElement>) => beginInteraction(event, "drag")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onDoubleClick={toggleMaximize}
      >
        <div className="plasmon-window__identity">
          {icon ? <span className="plasmon-window__icon" aria-hidden="true">{icon}</span> : null}
          <span className="plasmon-window__title">{title}</span>
        </div>
        <div className="plasmon-window__controls" role="group" aria-label="Window controls">
          <button
            type="button"
            className="plasmon-window__control"
            aria-label="Minimize"
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => event.stopPropagation()}
            onDoubleClick={(event: ReactMouseEvent<HTMLButtonElement>) => event.stopPropagation()}
            onClick={() => manager.minimize(state.id)}
          >
            <MinimizeIcon />
          </button>
          <button
            type="button"
            className="plasmon-window__control"
            aria-label={state.maximized ? "Restore" : "Maximize"}
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => event.stopPropagation()}
            onDoubleClick={(event: ReactMouseEvent<HTMLButtonElement>) => event.stopPropagation()}
            onClick={toggleMaximize}
          >
            {state.maximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button
            type="button"
            className="plasmon-window__control plasmon-window__control--close"
            aria-label="Close"
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => event.stopPropagation()}
            onDoubleClick={(event: ReactMouseEvent<HTMLButtonElement>) => event.stopPropagation()}
            onClick={requestClose}
          >
            <CloseIcon />
          </button>
        </div>
      </header>
      <div className={classNames("plasmon-window__content", contentClassName)}>{children}</div>
      {canResize && !state.maximized && !snapped ? RESIZE_DIRECTIONS.map((direction) => (
        <div
          key={direction}
          className={`plasmon-window__resize plasmon-window__resize--${direction}`}
          aria-hidden="true"
          onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => beginInteraction(event, "resize", direction)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onLostPointerCapture}
        />
      )) : null}
    </div>
  );
}
