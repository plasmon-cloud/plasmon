import type {
  ProcessCloseDecision,
  ProcessCloseRequest,
} from "../../os/contracts/index.ts";
import type { DocumentSnapshot } from "./document.ts";

export interface DocumentCloseSession {
  snapshot(): Pick<DocumentSnapshot, "dirty" | "status">;
  save(): Promise<boolean>;
  suspendAutosave(): void;
  resumeAutosave(): void;
  discardOnClose(): void;
}

export interface DocumentCloseSnapshot {
  pending: boolean;
  saving: boolean;
}

const EMPTY_SNAPSHOT: DocumentCloseSnapshot = { pending: false, saving: false };

/**
 * Deterministic Native Apps close-decision model shared by Text and Markdown.
 * Process owns the lifecycle request itself; this model owns only document
 * semantics for deciding when that request may complete or must remain open.
 */
export class DocumentCloseModel {
  private readonly listeners = new Set<() => void>();
  private pendingRequest: ProcessCloseRequest | null = null;
  private saving = false;
  private disposed = false;

  constructor(private readonly session: DocumentCloseSession) {}

  snapshot(): DocumentCloseSnapshot {
    return this.disposed
      ? EMPTY_SNAPSHOT
      : { pending: this.pendingRequest !== null, saving: this.saving };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  requestClose(request: ProcessCloseRequest): ProcessCloseDecision {
    if (this.disposed) return "prevent";
    if (!this.session.snapshot().dirty) return "allow";

    this.session.suspendAutosave();
    this.pendingRequest = request;
    this.emit();
    return "defer";
  }

  async saveAndClose(): Promise<boolean> {
    const request = this.pendingRequest;
    if (this.disposed || !request || this.saving) return false;

    this.saving = true;
    this.emit();

    let saved = false;
    try {
      saved = await this.session.save();
    } catch {
      saved = false;
    }

    if (this.disposed || this.pendingRequest !== request) return false;

    this.saving = false;
    if (!saved || this.session.snapshot().dirty) {
      this.emit();
      return false;
    }

    this.pendingRequest = null;
    this.emit();
    request.complete();
    return true;
  }

  discardAndClose(): boolean {
    const request = this.pendingRequest;
    if (this.disposed || !request || this.saving) return false;

    this.session.discardOnClose();
    this.pendingRequest = null;
    this.emit();
    request.complete();
    return true;
  }

  cancelClose(): boolean {
    const request = this.pendingRequest;
    if (this.disposed || !request || this.saving) return false;

    this.pendingRequest = null;
    this.session.resumeAutosave();
    this.emit();
    request.cancel();
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    const request = this.pendingRequest;
    this.pendingRequest = null;
    this.disposed = true;
    if (request) {
      this.session.resumeAutosave();
      request.cancel();
    }
    this.listeners.clear();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
