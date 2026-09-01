import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type { FsService, ProcessController, ProcessId } from "../contracts/index.ts";
import { claimFirstPartyContextMenu } from "../context-menu-boundary.ts";
import type { NativeApplicationRegistry } from "./registry.ts";
import type { NativeAppWindowControl } from "./runtime.ts";

export interface NativeProcessHostProps {
  processId: ProcessId;
  registry: NativeApplicationRegistry;
  process: ProcessController;
  fs: FsService;
  nativeWindow?: NativeAppWindowControl;
  fallback?: ReactNode;
  missingFallback?: ReactNode;
  errorFallback?: ReactNode | ((error: unknown) => ReactNode);
  onMissingLoader?: (appId: string) => void;
  onError?: (error: unknown, info: ErrorInfo) => void;
}

interface ErrorBoundaryProps {
  resetKey: string;
  fallback?: ReactNode | ((error: unknown) => ReactNode);
  onError?: (error: unknown, info: ErrorInfo) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: unknown | null;
}

interface ContextMenuFallbackState {
  x: number;
  y: number;
}

class NativeHostErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error);
      }
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

const contextMenuStyle = {
  position: "fixed",
  minWidth: 170,
  padding: 8,
  border: "1px solid rgba(255,255,255,.18)",
  borderRadius: 8,
  background: "#20242a",
  color: "#edf1f5",
  boxShadow: "0 10px 28px rgba(0,0,0,.35)",
  zIndex: 100000,
} as const;

const contextMenuItemStyle = {
  display: "block",
  padding: "6px 8px",
  font: "12px/1.3 system-ui, sans-serif",
  opacity: 0.72,
} as const;

/**
 * React-only adapter that renders a process record without leaking React into
 * NativeAppDefinition or ProcessController contracts.
 */
export function NativeProcessHost({
  processId,
  registry,
  process,
  fs,
  nativeWindow,
  fallback = null,
  missingFallback = null,
  errorFallback = null,
  onMissingLoader,
  onError,
}: NativeProcessHostProps) {
  const [, forceRender] = useReducer((value: number) => value + 1, 0);
  const [contextMenu, setContextMenu] = useState<ContextMenuFallbackState | null>(null);
  const reportedMissingLoader = useRef<string | null>(null);
  useEffect(() => process.subscribe(forceRender), [process]);

  useEffect(() => {
    if (!contextMenu || typeof document === "undefined" || typeof window === "undefined") return undefined;
    const dismiss = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const record = process.list().find((item) => item.id === processId) ?? null;
  const appId = record?.appId ?? null;
  const hasLoader = appId !== null && registry.hasLoader(appId);
  const HostedApplication = useMemo(() => {
    if (!appId || !hasLoader) return null;
    return lazy(async () => ({ default: await registry.loadComponent(appId) }));
  }, [appId, hasLoader, registry]);

  useEffect(() => {
    if (!appId || hasLoader) {
      reportedMissingLoader.current = null;
      return;
    }
    if (reportedMissingLoader.current === appId) return;
    reportedMissingLoader.current = appId;
    onMissingLoader?.(appId);
  }, [appId, hasLoader, onMissingLoader]);

  if (!record || !HostedApplication) return <>{missingFallback}</>;
  if (record.state !== "running") return <>{fallback}</>;

  return (
    <NativeHostErrorBoundary
      resetKey={`${record.id}:${record.appId}`}
      fallback={errorFallback}
      {...(onError ? { onError } : {})}
    >
      <div
        data-plasmon-owned-surface
        style={{ display: "contents" }}
        onContextMenu={(event) => {
          if (!claimFirstPartyContextMenu(event)) return;
          event.stopPropagation();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <Suspense fallback={fallback}>
          <HostedApplication
            processId={record.id}
            target={record.target}
            fs={fs}
            process={process}
            {...(nativeWindow ? { nativeWindow } : {})}
          />
        </Suspense>
        {contextMenu ? (
          <div
            role="menu"
            aria-label="Application context menu"
            style={{ ...contextMenuStyle, left: contextMenu.x, top: contextMenu.y }}
          >
            <span role="menuitem" aria-disabled="true" style={contextMenuItemStyle}>
              No actions available
            </span>
          </div>
        ) : null}
      </div>
    </NativeHostErrorBoundary>
  );
}
