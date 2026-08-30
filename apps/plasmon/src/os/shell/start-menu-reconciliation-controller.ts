import type {
  ExternalElement,
  FsNode,
  FsService,
  NativeAppDefinition,
  NativeAppRegistry,
  NeutronBridge,
} from "../contracts/index.ts";
import {
  DiagnosticEvent,
  DiagnosticSubsystem,
  type DiagnosticLogger,
} from "../diagnostics/index.ts";
import { reconcileStartMenu, type StartSeedResult } from "./startMenu.ts";

export interface StartMenuReconciliationSnapshot {
  root: FsNode | null;
  error: string | null;
  revision: number;
}

type ReconcileStartMenu = (
  fs: FsService,
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
) => Promise<StartSeedResult>;

export interface StartMenuReconciliationControllerOptions {
  reconcile?: ReconcileStartMenu;
  diagnostics?: DiagnosticLogger<typeof DiagnosticSubsystem.Shell>;
}

function identityKey(
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
): string {
  const native = nativeApps
    .map((app) => `${app.handlerId}:${app.name}`)
    .sort()
    .join("\u0000");
  const external = elements
    .map((element) => `${element.id}:${element.name}`)
    .sort()
    .join("\u0000");
  return `${native}\u0001${external}`;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function diagnosticErrorType(error: unknown): string {
  return error instanceof Error ? error.name || "Error" : typeof error;
}

/**
 * Drives canonical Start reconciliation from the long-lived service layer.
 *
 * This controller owns no Start inventory: every durable mutation remains in
 * reconcileStartMenu/FsService and every rendered folder listing remains an
 * FsService read. It only serializes reconciliation triggers, remembers the
 * last successfully reconciled seed identity, and exposes root/error revision
 * observations to rendered adapters.
 */
export class StartMenuReconciliationController {
  private readonly listeners = new Set<() => void>();
  private readonly reconcile: ReconcileStartMenu;
  private snapshot: StartMenuReconciliationSnapshot = {
    root: null,
    error: null,
    revision: 0,
  };
  private tail: Promise<void> = Promise.resolve();
  private lastIdentityKey: string | null = null;
  private started = false;
  private stopNeutron: (() => void) | null = null;

  constructor(
    private readonly fs: FsService,
    private readonly nativeApps: NativeAppRegistry,
    private readonly neutron: NeutronBridge,
    private readonly options: StartMenuReconciliationControllerOptions = {},
  ) {
    this.reconcile = options.reconcile ?? reconcileStartMenu;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    // Preserve the current boot behavior: native defaults can reconcile before
    // asynchronous Neutron discovery succeeds, then Element defaults join once
    // discovery resolves.
    this.enqueueReconcile([]);
    this.enqueueDiscovery();
    this.stopNeutron = this.neutron.subscribe(() => this.enqueueDiscovery());
  }

  dispose(): void {
    this.started = false;
    this.stopNeutron?.();
    this.stopNeutron = null;
  }

  getSnapshot(): StartMenuReconciliationSnapshot {
    return { ...this.snapshot };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private enqueueDiscovery(): void {
    this.tail = this.tail.then(async () => {
      if (!this.started) return;
      let elements: ExternalElement[];
      try {
        elements = await this.neutron.loadElements();
      } catch {
        // Neutron discovery has its own user-visible authority in Shell. Keep a
        // successfully reconciled native Start usable and retry on the next
        // bridge signal instead of misreporting discovery as Start corruption.
        return;
      }
      await this.reconcileIfChanged(elements);
    });
  }

  private enqueueReconcile(elements: readonly ExternalElement[]): void {
    this.tail = this.tail.then(async () => {
      if (!this.started) return;
      await this.reconcileIfChanged(elements);
    });
  }

  private async reconcileIfChanged(elements: readonly ExternalElement[]): Promise<void> {
    const nativeApps = this.nativeApps.list();
    const key = identityKey(nativeApps, elements);
    if (key === this.lastIdentityKey) return;

    try {
      const result = await this.reconcile(this.fs, nativeApps, elements);
      this.lastIdentityKey = key;
      this.snapshot = {
        root: result.root,
        error: null,
        revision: this.snapshot.revision + 1,
      };
    } catch (cause: unknown) {
      this.options.diagnostics?.error(DiagnosticEvent.Shell.StartReconcileFailed, {
        message: "Start Menu reconciliation failed",
        errorType: diagnosticErrorType(cause),
      });
      this.snapshot = {
        ...this.snapshot,
        error: `Start Menu could not be reconciled: ${message(cause)}`,
        revision: this.snapshot.revision + 1,
      };
    }
    this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
