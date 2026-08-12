import type {
  HandlerId,
  NativeAppDefinition,
  NativeAppRegistry,
  OpenTarget,
  ProcessCloseHandler,
  ProcessCloseRequest,
  ProcessController,
  ProcessId,
  ProcessRecord,
  WindowManager,
} from "../contracts/index.ts";
import { ProcessStore } from "./store.ts";

export interface NativeProcessControllerOptions {
  processIdFactory?: (app: NativeAppDefinition, ordinal: number) => ProcessId;
  onStartupError?: (error: unknown, app: NativeAppDefinition, target: OpenTarget) => void;
  onCloseError?: (error: unknown, process: ProcessRecord) => void;
}

const defaultProcessIdFactory = (app: NativeAppDefinition, ordinal: number): ProcessId =>
  `${app.id}#${ordinal}`;

export class NativeProcessController implements ProcessController {
  private readonly ordinals = new Map<string, number>();
  private readonly closeHandlers = new Map<ProcessId, ProcessCloseHandler>();
  private readonly pendingCloses = new Map<ProcessId, symbol>();
  private readonly unsubscribeWindows: () => void;
  private reconcilingWindows = false;

  constructor(
    private readonly registry: NativeAppRegistry,
    private readonly windows: WindowManager,
    private readonly store = new ProcessStore(),
    private readonly options: NativeProcessControllerOptions = {},
  ) {
    this.unsubscribeWindows = this.windows.subscribe(() => this.reconcileClosedWindows());
  }

  async open(handlerId: HandlerId, target: OpenTarget): Promise<ProcessId | null> {
    const app = this.registry.getByHandler(handlerId);
    if (!app) return null;

    if (app.singleton) {
      const existing = this.store.find(
        (record) => record.appId === app.id && record.state !== "closing",
      );
      if (existing) {
        this.setTarget(existing.id, target);
        this.focus(existing.id);
        return existing.id;
      }
    }

    const id = this.nextProcessId(app);
    this.store.add({
      id,
      appId: app.id,
      handlerId: app.handlerId,
      target,
      title: app.name,
      icon: app.icon,
      state: "starting",
    });

    try {
      const windowId = this.windows.create(id, {
        width: app.defaultWindow.width,
        height: app.defaultWindow.height,
        ...(app.defaultWindow.minWidth !== undefined
          ? { minWidth: app.defaultWindow.minWidth }
          : {}),
        ...(app.defaultWindow.minHeight !== undefined
          ? { minHeight: app.defaultWindow.minHeight }
          : {}),
      });
      this.store.patch(id, { state: "running", windowId });
      return id;
    } catch (error: unknown) {
      this.removeProcess(id);
      this.options.onStartupError?.(error, app, target);
      return null;
    }
  }

  focus(id: ProcessId): void {
    const record = this.store.get(id);
    if (record?.windowId) this.windows.focus(record.windowId);
  }

  close(id: ProcessId): boolean {
    const record = this.store.get(id);
    if (!record || record.state === "closing") return true;
    if (this.pendingCloses.has(id)) return false;

    const handler = this.closeHandlers.get(id);
    if (!handler) return this.finishClose(id);

    const token = Symbol(`process-close:${id}`);
    this.pendingCloses.set(id, token);
    const request: ProcessCloseRequest = {
      processId: id,
      complete: () => this.completeDeferredClose(id, token),
      cancel: () => this.cancelDeferredClose(id, token),
    };

    let decision: ReturnType<ProcessCloseHandler>;
    try {
      decision = handler(request);
    } catch (error: unknown) {
      this.pendingCloses.delete(id);
      this.options.onCloseError?.(error, record);
      return false;
    }

    // A handler may resolve the request synchronously. In that case its
    // complete/cancel callback already owns the outcome and stale decisions
    // from this invocation must not act again.
    if (this.pendingCloses.get(id) !== token) return this.store.get(id) === null;

    if (decision === "allow") {
      this.pendingCloses.delete(id);
      return this.finishClose(id);
    }
    if (decision === "prevent") {
      this.pendingCloses.delete(id);
      return false;
    }

    // "defer" keeps the process running until request.complete() or
    // request.cancel() resolves this exact close attempt.
    return false;
  }

  forceClose(id: ProcessId): boolean {
    this.pendingCloses.delete(id);
    return this.finishClose(id);
  }

  registerCloseHandler(id: ProcessId, handler: ProcessCloseHandler): () => void {
    const record = this.store.get(id);
    if (!record || record.state !== "running") {
      throw new Error(`Cannot register close handler for inactive process: ${id}`);
    }
    if (this.closeHandlers.has(id)) {
      throw new Error(`Close handler already registered for process: ${id}`);
    }

    this.closeHandlers.set(id, handler);
    return () => {
      if (this.closeHandlers.get(id) !== handler) return;
      this.closeHandlers.delete(id);
      this.pendingCloses.delete(id);
    };
  }

  setTitle(id: ProcessId, title: string): void {
    this.store.patch(id, { title });
  }

  setTarget(id: ProcessId, target: OpenTarget): void {
    this.store.patch(id, { target });
  }

  list(): readonly ProcessRecord[] {
    return this.store.list();
  }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }

  /** Releases the WindowManager subscription for tests/composition teardown. */
  dispose(): void {
    this.unsubscribeWindows();
  }

  private completeDeferredClose(id: ProcessId, token: symbol): void {
    if (this.pendingCloses.get(id) !== token) return;
    this.pendingCloses.delete(id);
    this.finishClose(id);
  }

  private cancelDeferredClose(id: ProcessId, token: symbol): void {
    if (this.pendingCloses.get(id) !== token) return;
    this.pendingCloses.delete(id);
  }

  private finishClose(id: ProcessId): boolean {
    const record = this.store.get(id);
    if (!record) return true;

    this.pendingCloses.delete(id);
    this.store.patch(id, { state: "closing" });
    try {
      if (record.windowId) this.windows.close(record.windowId);
    } finally {
      this.removeProcess(id);
    }
    return true;
  }

  private removeProcess(id: ProcessId): void {
    this.pendingCloses.delete(id);
    this.closeHandlers.delete(id);
    this.store.remove(id);
  }

  private nextProcessId(app: NativeAppDefinition): ProcessId {
    let ordinal = (this.ordinals.get(app.id) ?? 0) + 1;
    let id = (this.options.processIdFactory ?? defaultProcessIdFactory)(app, ordinal);
    while (this.store.get(id)) {
      ordinal += 1;
      id = (this.options.processIdFactory ?? defaultProcessIdFactory)(app, ordinal);
    }
    this.ordinals.set(app.id, ordinal);
    return id;
  }

  private reconcileClosedWindows(): void {
    if (this.reconcilingWindows) return;
    this.reconcilingWindows = true;
    try {
      const active = new Set(this.windows.list().map((window) => window.id));
      for (const record of this.store.list()) {
        if (
          record.state === "running" &&
          record.windowId !== undefined &&
          !active.has(record.windowId)
        ) {
          this.removeProcess(record.id);
        }
      }
    } finally {
      this.reconcilingWindows = false;
    }
  }
}
