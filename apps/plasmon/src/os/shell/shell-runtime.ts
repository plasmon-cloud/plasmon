import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ExternalElement,
  NeutronBridge,
  ProcessController,
  WindowManager,
} from "../contracts/index.ts";
import { subscribeToNativeShellState } from "./subscriptions.ts";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** React adapter over canonical Process and WindowManager snapshots. */
export function useNativeShellSnapshots(process: ProcessController, windows: WindowManager) {
  const [revision, setRevision] = useState(0);
  useEffect(
    () => subscribeToNativeShellState(process, windows, () => setRevision((value) => value + 1)),
    [process, windows],
  );
  return useMemo(() => ({
    processes: process.list(),
    windowStates: windows.list(),
    focusedWindowId: windows.focusSnapshot().focusedId,
  }), [process, windows, revision]);
}

/** One observed Element snapshot; Neutron remains installation/runtime authority. */
export function useExternalElementSnapshot(neutron: NeutronBridge): {
  elements: ExternalElement[];
  error: string | null;
} {
  const [elements, setElements] = useState<ExternalElement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (quiet = false): Promise<void> => {
    const request = ++generation.current;
    try {
      const next = await neutron.loadElements();
      if (request !== generation.current) return;
      setElements(next);
      if (!quiet) setError(null);
    } catch (cause: unknown) {
      if (request === generation.current && !quiet) setError(formatError(cause));
    }
  }, [neutron]);

  useEffect(() => {
    void load();
    const unsubscribe = neutron.subscribe(() => { void load(true); });
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void neutron.refreshRuntimeState().catch(() => load(true));
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    if (typeof window !== "undefined") window.addEventListener("focus", onVisibility);
    return () => {
      generation.current += 1;
      unsubscribe();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (typeof window !== "undefined") window.removeEventListener("focus", onVisibility);
    };
  }, [load, neutron]);

  return { elements, error };
}
