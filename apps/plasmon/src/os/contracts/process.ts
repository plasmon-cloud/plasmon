import type { HandlerId, IconRef, ProcessId, WindowId } from "./common.ts";
import type { OpenTarget } from "./associations.ts";

export interface ProcessRecord {
  id: ProcessId;
  appId: string;
  handlerId: HandlerId;
  target: OpenTarget;
  title: string;
  icon: IconRef;
  state: "starting" | "running" | "closing";
  windowId?: WindowId;
}

export type ProcessCloseDecision = "allow" | "prevent" | "defer";

/**
 * Deferred close handle owned by the Process lifecycle. Applications may
 * complete the same ordinary close after resolving their own domain state, or
 * cancel it and keep the process/window alive.
 */
export interface ProcessCloseRequest {
  processId: ProcessId;
  complete(): void;
  cancel(): void;
}

export type ProcessCloseHandler = (request: ProcessCloseRequest) => ProcessCloseDecision;

export interface ProcessController {
  open(handlerId: HandlerId, target: OpenTarget): Promise<ProcessId | null>;
  focus(id: ProcessId): void;
  /** Returns true only when the ordinary close completed immediately. */
  close(id: ProcessId): boolean;
  /** Explicit lifecycle teardown that bypasses ordinary close negotiation. */
  forceClose(id: ProcessId): boolean;
  /** Registers the single application-owned close concern for a running process. */
  registerCloseHandler(id: ProcessId, handler: ProcessCloseHandler): () => void;
  setTitle(id: ProcessId, title: string): void;
  setTarget(id: ProcessId, target: OpenTarget): void;
  list(): readonly ProcessRecord[];
  subscribe(listener: () => void): () => void;
}
