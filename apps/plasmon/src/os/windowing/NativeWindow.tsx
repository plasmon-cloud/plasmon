import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { ProcessId, WindowId } from "../contracts/common.ts";
import type { WindowManager, WindowState } from "../contracts/window.ts";
import { DEFAULT_MIN_HEIGHT, DEFAULT_MIN_WIDTH } from "./geometry.ts";
import type { ResizeDirection } from "./interaction.ts";
import { useNativeWindowInteraction } from "./useNativeWindowInteraction.ts";
import "./windowing.scss";

const RESIZE_DIRECTIONS: readonly ResizeDirection[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const CLOSE_FALLBACK_MS = 500;

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
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const minWidth = state.minWidth ?? DEFAULT_MIN_WIDTH;
  const minHeight = state.minHeight ?? DEFAULT_MIN_HEIGHT;
  const {
    rootRef,
    snapSide,
    snapped,
    snapPreview,
    focusWindow,
    titlebar,
    resize,
  } = useNativeWindowInteraction({
    state,
    manager,
    active,
    canResize,
    minWidth,
    minHeight,
  });

  const style = useMemo<CSSProperties>(() => ({
    left: state.x,
    top: state.y,
    width: state.width,
    height: state.height,
    minWidth: state.maximized || snapped ? 0 : minWidth,
    minHeight: state.maximized || snapped ? 0 : minHeight,
    zIndex: state.z,
  }), [state.x, state.y, state.width, state.height, state.z, state.maximized, snapped, minWidth, minHeight]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

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
      {snapPreview ? createPortal(
        <div
          className="plasmon-window__snap-preview"
          data-window-snap-preview={snapPreview.side}
          aria-hidden="true"
          style={{
            left: snapPreview.geometry.x,
            top: snapPreview.geometry.y,
            width: snapPreview.geometry.width,
            height: snapPreview.geometry.height,
            zIndex: Math.max(0, state.z - 1),
          }}
        />,
        snapPreview.host,
      ) : null}
      <header
        className="plasmon-window__titlebar"
        {...titlebar}
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
          {...resize(direction)}
        />
      )) : null}
    </div>
  );
}
