import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useReducer,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type { FsService, ProcessController, ProcessId } from "../contracts/index.ts";
import type { NativeApplicationRegistry } from "./registry.ts";

export interface NativeProcessHostProps {
  processId: ProcessId;
  registry: NativeApplicationRegistry;
  process: ProcessController;
  fs: FsService;
  fallback?: ReactNode;
  missingFallback?: ReactNode;
  errorFallback?: ReactNode | ((error: unknown) => ReactNode);
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

/**
 * React-only adapter that renders a process record without leaking React into
 * NativeAppDefinition or ProcessController contracts.
 */
export function NativeProcessHost({
  processId,
  registry,
  process,
  fs,
  fallback = null,
  missingFallback = null,
  errorFallback = null,
  onError,
}: NativeProcessHostProps) {
  const [, forceRender] = useReducer((value: number) => value + 1, 0);
  useEffect(() => process.subscribe(forceRender), [process]);

  const record = process.list().find((item) => item.id === processId) ?? null;
  const appId = record?.appId ?? null;
  const HostedApplication = useMemo(() => {
    if (!appId || !registry.hasLoader(appId)) return null;
    return lazy(async () => ({ default: await registry.loadComponent(appId) }));
  }, [appId, registry]);

  if (!record || !HostedApplication) return <>{missingFallback}</>;

  return (
    <NativeHostErrorBoundary
      resetKey={`${record.id}:${record.appId}`}
      fallback={errorFallback}
      {...(onError ? { onError } : {})}
    >
      <Suspense fallback={fallback}>
        <HostedApplication
          processId={record.id}
          target={record.target}
          fs={fs}
          process={process}
        />
      </Suspense>
    </NativeHostErrorBoundary>
  );
}
