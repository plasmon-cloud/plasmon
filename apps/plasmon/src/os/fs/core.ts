import type {
  AssociationRegistry,
  FsEventSource,
  FsNode,
  FsService,
  NativeAppRegistry,
  NeutronBridge,
  NodeId,
  OpenService,
  ProcessController,
} from "../contracts/index.ts";
import { reconcileCoreDesktopSeeds } from "./defaultSeeds.ts";
import {
  TrashService,
  bootstrapFilesystem,
  type BootstrapFilesystemResult,
  type FilesystemSeedSpec,
  type TrashEntry,
} from "./managed.ts";
import { FilesystemOpenDispatcher } from "./openDispatcher.ts";
import {
  ManagedProgramFilesService,
  type ProgramFilesService,
} from "./programFiles.ts";
import { ProtectedManagedFsService } from "./protectedService.ts";
import { StableNeutronProjectionService } from "./stableProjection.ts";

export interface FilesystemCoreOptions {
  fs: FsService & FsEventSource;
  nativeApps: NativeAppRegistry;
  neutron: NeutronBridge;
  associations: AssociationRegistry;
  openService: OpenService;
  process: ProcessController;
  durableSeeds?: readonly FilesystemSeedSpec[];
  demoSeeds?: readonly FilesystemSeedSpec[];
}

export interface FilesystemCoreInitialization extends BootstrapFilesystemResult {
  neutronProjectionError: string | null;
}

export interface FilesystemTrashService {
  trash(nodeId: NodeId): Promise<TrashEntry>;
  list(): Promise<TrashEntry[]>;
  restore(trashedNodeId: NodeId, fallbackPath?: string): Promise<{ node: FsNode; usedFallback: boolean; renamed: boolean }>;
  permanentlyDelete(trashedNodeId: NodeId): Promise<void>;
  empty(): Promise<number>;
}

export interface FilesystemCoreServices {
  fs: ProtectedManagedFsService;
  ready: Promise<FilesystemCoreInitialization>;
  programFiles: ProgramFilesService;
  trash: FilesystemTrashService;
  open: FilesystemOpenDispatcher;
  projections: StableNeutronProjectionService;
  reconcileNeutron(): Promise<void>;
  dispose(): void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Composes filesystem policy without changing FsService persistence contracts.
 * Bootstrap uses the raw service; public consumers receive a gated/protected
 * facade so no Desktop/FileManager/Search call observes a half-migrated tree or
 * can mutate protected system/application resources with generic FsService ops.
 */
export function createFilesystemCore(options: FilesystemCoreOptions): FilesystemCoreServices {
  const managed = new ProtectedManagedFsService(options.fs);
  const projections = new StableNeutronProjectionService(options.fs);
  const privilegedTrash = new TrashService(options.fs);
  let disposed = false;
  let stopNeutron: () => void = () => undefined;
  let reconcileTail: Promise<void> = Promise.resolve();

  const reconcileNeutron = async (): Promise<void> => {
    const elements = await options.neutron.loadElements();
    await projections.reconcile(elements);
  };

  const initialize = async (): Promise<FilesystemCoreInitialization> => {
    const bootstrap = await bootstrapFilesystem(options.fs, {
      nativeApps: options.nativeApps.list(),
      ...(options.durableSeeds ? { durableSeeds: options.durableSeeds } : {}),
      ...(options.demoSeeds ? { demoSeeds: options.demoSeeds } : {}),
    });
    await reconcileCoreDesktopSeeds(options.fs);
    let neutronProjectionError: string | null = null;
    try {
      await reconcileNeutron();
    } catch (error) {
      // Failure/unknown Kernel state must never delete existing projections or
      // block the filesystem. Later bridge invalidation can reconcile again.
      neutronProjectionError = message(error);
    }
    return { ...bootstrap, neutronProjectionError };
  };

  const ready = initialize();
  managed.setInitialization(ready);
  const programFiles = new ManagedProgramFilesService(options.fs, ready);

  stopNeutron = options.neutron.subscribe(() => {
    if (disposed) return;
    reconcileTail = reconcileTail
      .then(async () => {
        await ready;
        await reconcileNeutron();
      })
      .catch(() => undefined);
  });

  const trash: FilesystemTrashService = {
    trash: async (nodeId) => { await ready; return privilegedTrash.trash(nodeId); },
    list: async () => { await ready; return privilegedTrash.list(); },
    restore: async (nodeId, fallbackPath) => {
      await ready;
      return fallbackPath === undefined
        ? privilegedTrash.restore(nodeId)
        : privilegedTrash.restore(nodeId, fallbackPath);
    },
    permanentlyDelete: async (nodeId) => { await ready; await privilegedTrash.permanentlyDelete(nodeId); },
    empty: async () => { await ready; return privilegedTrash.empty(); },
  };

  const open = new FilesystemOpenDispatcher({
    fs: managed,
    associations: options.associations,
    openService: options.openService,
    process: options.process,
    neutron: options.neutron,
  });

  return {
    fs: managed,
    ready,
    programFiles,
    trash,
    open,
    projections,
    reconcileNeutron: async () => {
      await ready;
      await reconcileNeutron();
    },
    dispose: () => {
      disposed = true;
      stopNeutron();
      stopNeutron = () => undefined;
    },
  };
}
