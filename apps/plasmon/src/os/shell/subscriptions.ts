import type { ProcessController, WindowManager } from "../contracts/index.ts";

/** Shared native-state subscription with one cleanup boundary for React and tests. */
export function subscribeToNativeShellState(
  process: ProcessController,
  windows: WindowManager,
  listener: () => void,
): () => void {
  const unsubscribeProcess = process.subscribe(listener);
  const unsubscribeWindows = windows.subscribe(listener);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    unsubscribeProcess();
    unsubscribeWindows();
  };
}
