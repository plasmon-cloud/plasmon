import type { ProcessRecord, WindowState } from "../contracts/index.ts";
import { windowForProcess } from "./taskbar.ts";

export type TaskbarMemberState = "launching" | "minimized" | "active" | "running";

export interface TaskbarMemberPresentation {
  member: ProcessRecord;
  window: WindowState | null;
  state: TaskbarMemberState;
  statusLabel: "Launching" | "Minimized" | "Active" | "Running";
  selectable: boolean;
}

/**
 * Derive one group-row presentation from the same canonical Process/Windowing
 * observations as the parent taskbar projection. No chooser-local lifecycle or
 * geometry state is retained.
 */
export function deriveTaskbarMemberPresentation(
  member: ProcessRecord,
  windows: readonly WindowState[],
  focusedWindowId: WindowState["id"] | null,
): TaskbarMemberPresentation {
  const window = windowForProcess(member, windows);
  if (member.state === "starting") {
    return { member, window, state: "launching", statusLabel: "Launching", selectable: false };
  }
  if (window?.minimized) {
    return { member, window, state: "minimized", statusLabel: "Minimized", selectable: member.state === "running" };
  }
  if (window && window.id === focusedWindowId) {
    return { member, window, state: "active", statusLabel: "Active", selectable: member.state === "running" };
  }
  return { member, window, state: "running", statusLabel: "Running", selectable: member.state === "running" };
}
