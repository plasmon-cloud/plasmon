import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { claimFirstPartyContextMenu } from "../context-menu-boundary.ts";
import type { ProcessId, WindowId } from "../contracts/common.ts";
import type { WindowManager, WindowState } from "../contracts/window.ts";
import { DEFAULT_MIN_HEIGHT, DEFAULT_MIN_WIDTH } from "./geometry.ts";
import { NativeWindowChrome } from "./NativeWindowChrome.tsx";
import { useNativeWindowInteraction } from "./useNativeWindowInteraction.ts";
import "./windowing.scss";

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
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

  useEffect(() => {
    if (!contextMenu || typeof document === "undefined" || typeof window === "undefined") return undefined;
    const dismiss = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const dismissContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const openContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!claimFirstPartyContextMenu(event)) return;
    event.stopPropagation();
    focusWindow();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, [focusWindow]);

  const minimize = useCallback(() => {
    dismissContextMenu();
    manager.minimize(state.id);
  }, [dismissContextMenu, manager, state.id]);

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
    manager.close(state.id);
  }, [manager, state.id]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;

    // Process-owned close negotiation must happen before Windowing changes the
    // rendered state. A deferred/rejected lifecycle request therefore leaves
    // the exact window visible while the application resolves its concern.
    if (onRequestClose) {
      onRequestClose(state.id, state.processId);
      return;
    }

    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(finalizeClose, CLOSE_FALLBACK_MS);
  }, [finalizeClose, onRequestClose, state.id, state.processId]);

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
    <NativeWindowChrome
      rootRef={rootRef}
      state={state}
      title={title}
      icon={icon}
      rootClassName={rootClassName}
      style={style}
      ariaLabel={ariaLabel}
      canResize={canResize}
      snapped={snapped}
      snapSide={snapSide}
      snapPreview={snapPreview}
      focusWindow={focusWindow}
      titlebar={titlebar}
      resize={resize}
      onTitlebarContextMenu={openContextMenu}
      contextMenu={contextMenu}
      dismissContextMenu={dismissContextMenu}
      minimize={minimize}
      toggleMaximize={() => {
        dismissContextMenu();
        toggleMaximize();
      }}
      requestClose={() => {
        dismissContextMenu();
        requestClose();
      }}
      onCloseAnimationEnd={closing ? finalizeClose : undefined}
      contentClassName={contentClassName}
    >
      {children}
    </NativeWindowChrome>
  );
}
