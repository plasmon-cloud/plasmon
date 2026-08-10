import type { NodeId } from "../contracts/index.ts";
import { basenameSelectionRange } from "./model.ts";

export interface InlineRenameState {
  nodeId: NodeId;
  value: string;
  initialName: string;
  session: number;
  error: string | null;
  busy: boolean;
}

export interface RenameInputLike {
  focus(options?: { preventScroll?: boolean }): void;
  setSelectionRange(start: number, end: number): void;
}

/**
 * Owns the one-time browser selection step for an inline rename session.
 * Updating the controlled input value must never retrigger basename selection.
 */
export class RenameSelectionController {
  private initializedSession: number | null = null;

  initialize(session: number, input: RenameInputLike, initialName: string): boolean {
    if (this.initializedSession === session) return false;
    this.initializedSession = session;
    input.focus({ preventScroll: true });
    const [start, end] = basenameSelectionRange(initialName);
    input.setSelectionRange(start, end);
    return true;
  }

  reset(): void {
    this.initializedSession = null;
  }
}

export type RenameKeyAction = "commit" | "cancel" | null;

export function renameKeyAction(key: string): RenameKeyAction {
  if (key === "Enter") return "commit";
  if (key === "Escape") return "cancel";
  return null;
}
