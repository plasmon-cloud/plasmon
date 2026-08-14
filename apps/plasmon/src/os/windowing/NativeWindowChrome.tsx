import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { WindowGeometry, WindowState } from "../contracts/window.ts";
import type { HorizontalSnapSide } from "./geometry.ts";
import type { ResizeDirection } from "./interaction.ts";

const RESIZE_DIRECTIONS: readonly ResizeDirection[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

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

interface NativeWindowChromeProps {
  rootRef: RefObject<HTMLDivElement | null>;
  state: WindowState;
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  rootClassName: string;
  contentClassName?: string;
  style: CSSProperties;
  ariaLabel?: string;
  canResize: boolean;
  snapped: boolean;
  snapSide: HorizontalSnapSide | null;
  snapPreview: NativeWindowSnapPreview | null;
  focusWindow(): void;
  titlebar: PointerHandlers;
  resize(direction: ResizeDirection): PointerHandlers;
  minimize(): void;
  toggleMaximize(): void;
  requestClose(): void;
  onCloseAnimationEnd?: () => void;
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

export function NativeWindowChrome({
  rootRef,
  state,
  title,
  icon,
  children,
  rootClassName,
  contentClassName,
  style,
  ariaLabel,
  canResize,
  snapped,
  snapSide,
  snapPreview,
  focusWindow,
  titlebar,
  resize,
  minimize,
  toggleMaximize,
  requestClose,
  onCloseAnimationEnd,
}: NativeWindowChromeProps): ReactNode {
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
      onAnimationEnd={onCloseAnimationEnd}
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
            onClick={minimize}
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
