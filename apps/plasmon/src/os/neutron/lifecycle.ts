export interface LifecycleEventTarget {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface VisibilityEventTarget extends LifecycleEventTarget {
  readonly visibilityState?: string;
}

export interface ForegroundLifecycleTargets {
  windowTarget?: LifecycleEventTarget;
  documentTarget?: VisibilityEventTarget;
}

export function browserLifecycleTargets(): ForegroundLifecycleTargets {
  return {
    ...(typeof window === "undefined" ? {} : { windowTarget: window }),
    ...(typeof document === "undefined" ? {} : { documentTarget: document }),
  };
}

/** Best-effort lifecycle hints for vanilla Neutron's snapshot-only runtime state. */
export function subscribeForegroundRefresh(
  listener: () => void,
  targets: ForegroundLifecycleTargets = browserLifecycleTargets(),
): () => void {
  const onForeground: EventListener = () => listener();
  const onVisibility: EventListener = () => {
    if (!targets.documentTarget?.visibilityState || targets.documentTarget.visibilityState === "visible") {
      listener();
    }
  };

  targets.windowTarget?.addEventListener("focus", onForeground);
  targets.windowTarget?.addEventListener("pageshow", onForeground);
  targets.documentTarget?.addEventListener("visibilitychange", onVisibility);

  return () => {
    targets.windowTarget?.removeEventListener("focus", onForeground);
    targets.windowTarget?.removeEventListener("pageshow", onForeground);
    targets.documentTarget?.removeEventListener("visibilitychange", onVisibility);
  };
}
