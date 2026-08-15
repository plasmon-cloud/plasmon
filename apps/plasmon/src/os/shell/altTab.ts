import type {
  ProcessRecord,
  WindowFocusSnapshot,
  WindowId,
  WindowState,
} from "../contracts/index.ts";

export interface AltTabSession {
  readonly windowIds: readonly WindowId[];
  readonly selectedWindowId: WindowId;
}

export interface AltTabEntry {
  readonly windowId: WindowId;
  readonly processId: ProcessRecord["id"];
  readonly title: string;
  readonly icon: ProcessRecord["icon"];
  readonly minimized: boolean;
  readonly selected: boolean;
}

function liveMru(
  snapshot: WindowFocusSnapshot,
  windows: readonly WindowState[],
): WindowId[] {
  const live = new Set(windows.map((windowState) => windowState.id));
  return snapshot.mru.filter((id, index, all) => live.has(id) && all.indexOf(id) === index);
}

function stepIndex(length: number, index: number, reverse: boolean): number {
  return (index + (reverse ? -1 : 1) + length) % length;
}

/**
 * Start a gesture from WindowManager's canonical MRU snapshot without changing
 * Windowing focus. The first selection is the prior MRU member, matching the
 * ordinary Alt-Tab gesture while the currently focused window remains active.
 */
export function beginAltTabSession(
  snapshot: WindowFocusSnapshot,
  windows: readonly WindowState[],
  reverse = false,
): AltTabSession | null {
  const windowIds = liveMru(snapshot, windows);
  if (windowIds.length < 2) return null;
  const focusedIndex = snapshot.focusedId === null ? -1 : windowIds.indexOf(snapshot.focusedId);
  const selectedIndex = focusedIndex < 0
    ? (reverse ? windowIds.length - 1 : 0)
    : stepIndex(windowIds.length, focusedIndex, reverse);
  const selectedWindowId = windowIds[selectedIndex];
  return selectedWindowId ? { windowIds, selectedWindowId } : null;
}

/** Cycle only the ephemeral gesture selection. This never mutates MRU/focus. */
export function cycleAltTabSession(
  session: AltTabSession,
  reverse = false,
): AltTabSession {
  const currentIndex = session.windowIds.indexOf(session.selectedWindowId);
  if (currentIndex < 0 || session.windowIds.length < 2) return session;
  const selectedWindowId = session.windowIds[
    stepIndex(session.windowIds.length, currentIndex, reverse)
  ];
  return selectedWindowId ? { ...session, selectedWindowId } : session;
}

/**
 * Remove windows that closed during a held gesture. The surviving order remains
 * the WindowManager MRU order captured at gesture start; Shell never derives a
 * replacement order from z-order, process order, taskbar order, or the DOM.
 */
export function reconcileAltTabSession(
  session: AltTabSession,
  windows: readonly WindowState[],
): AltTabSession | null {
  const live = new Set(windows.map((windowState) => windowState.id));
  const windowIds = session.windowIds.filter((id) => live.has(id));
  if (windowIds.length === 0) return null;
  const selectedWindowId = live.has(session.selectedWindowId)
    ? session.selectedWindowId
    : windowIds[0];
  return selectedWindowId ? { windowIds, selectedWindowId } : null;
}

export function altTabCommitWindowId(
  session: AltTabSession,
  windows: readonly WindowState[],
): WindowId | null {
  return reconcileAltTabSession(session, windows)?.selectedWindowId ?? null;
}

export function deriveAltTabEntries(
  session: AltTabSession,
  windows: readonly WindowState[],
  processes: readonly ProcessRecord[],
): readonly AltTabEntry[] {
  const byWindow = new Map(windows.map((windowState) => [windowState.id, windowState] as const));
  const byProcess = new Map(processes.map((processRecord) => [processRecord.id, processRecord] as const));
  const entries: AltTabEntry[] = [];
  for (const windowId of session.windowIds) {
    const windowState = byWindow.get(windowId);
    if (!windowState) continue;
    const processRecord = byProcess.get(windowState.processId);
    if (!processRecord || processRecord.state === "closing") continue;
    entries.push({
      windowId,
      processId: processRecord.id,
      title: processRecord.title,
      icon: processRecord.icon,
      minimized: windowState.minimized,
      selected: windowId === session.selectedWindowId,
    });
  }
  return entries;
}
