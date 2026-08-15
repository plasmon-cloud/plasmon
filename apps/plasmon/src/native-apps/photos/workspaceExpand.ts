export interface WorkspaceWindowControl {
  maximized: boolean;
  maximize(): void;
  restore(): void;
}

export interface WorkspaceExpandSession {
  maximizedByExpand: boolean;
}

/**
 * Enter the Photos in-workspace fallback without taking geometry authority
 * away from Windowing. A window that was already maximized stays maximized;
 * otherwise the canonical host control performs the maximize transition.
 */
export function enterWorkspaceExpand(
  windowControl: WorkspaceWindowControl | null | undefined,
): WorkspaceExpandSession {
  if (!windowControl || windowControl.maximized) {
    return { maximizedByExpand: false };
  }
  windowControl.maximize();
  return { maximizedByExpand: true };
}

/**
 * Restore only a maximize transition that this expand session initiated, and
 * only while the window is still maximized. If the user already restored or
 * otherwise changed Windowing state, Photos must not issue a second restore.
 */
export function exitWorkspaceExpand(
  windowControl: WorkspaceWindowControl | null | undefined,
  session: WorkspaceExpandSession | null | undefined,
): void {
  if (!windowControl || !session?.maximizedByExpand || !windowControl.maximized) return;
  windowControl.restore();
}
