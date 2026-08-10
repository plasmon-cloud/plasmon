import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { WindowManager, WindowState } from "../contracts/window.ts";
import type { WindowViewport } from "./geometry.ts";
import { useWindowStates } from "./useWindowStates.ts";
import "./windowing.scss";

interface ViewportAwareWindowManager {
  setViewport(viewport: WindowViewport): void;
}

export interface WindowLayerProps {
  manager: WindowManager;
  renderWindow: (state: WindowState, active: boolean) => ReactNode;
  className?: string;
}

function viewportAware(manager: WindowManager): ViewportAwareWindowManager | null {
  const candidate = manager as WindowManager & Partial<ViewportAwareWindowManager>;
  return typeof candidate.setViewport === "function" ? candidate as WindowManager & ViewportAwareWindowManager : null;
}

export function WindowLayer({ manager, renderWindow, className }: WindowLayerProps): ReactNode {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const windows = useWindowStates(manager);
  const activeId = useMemo(() => {
    let active: WindowState | undefined;
    for (const state of windows) {
      if (!state.minimized && (!active || state.z > active.z)) active = state;
    }
    return active?.id;
  }, [windows]);

  useEffect(() => {
    const layer = layerRef.current;
    const aware = viewportAware(manager);
    if (!layer || !aware) return;

    const update = (): void => {
      if (layer.clientWidth <= 0 || layer.clientHeight <= 0) return;
      aware.setViewport({ x: 0, y: 0, width: layer.clientWidth, height: layer.clientHeight });
    };
    update();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(layer);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [manager]);

  return (
    <div ref={layerRef} className={["plasmon-window-layer", className].filter(Boolean).join(" ")}>
      {windows.map((state) => renderWindow(state, state.id === activeId))}
    </div>
  );
}
