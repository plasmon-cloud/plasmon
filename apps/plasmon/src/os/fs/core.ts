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
import {
  DiagnosticEvent,
  DiagnosticStage,
  DiagnosticSubsystem,
  type DiagnosticService,
} from "../diagnostics/index.ts";
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
  ManagedConfigurationService,
  reconcileConfigurationRoot,
  type ConfigurationService,
} from "./configuration.ts";
import {
  ManagedProgramFilesService,
  reconcileProgramFilesRuntimeDirectory,
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
  diagnostics?: DiagnosticService;
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
  configuration: ConfigurationService;
  trash: FilesystemTrashService;
  open: FilesystemOpenDispatcher;
  projections: StableNeutronProjectionService;
  reconcileNeutron(): Promise<void>;
  dispose(): void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function diagnosticErrorType(error: unknown): string {
  return error instanceof Error ? error.name || "Error" : typeof error;
}

function isExpectedTrashFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /protected and cannot be|installed application; use Uninstall|already in Recycle Bin|Filesystem root cannot be deleted|Recycle Bin item was not found/u.test(error.message);
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
  const filesystemLog = options.diagnostics?.for(DiagnosticSubsystem.Filesystem) ?? null;
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

  // Runtime subtrees are filesystem-managed durable locations, not application
  // registrations. Include required curated runtime reconciliation in the core
  // readiness barrier, then gate the public Program Files service on that final
  // barrier so an early runtime consumer cannot race the same directory create.
  const ready = initialize().then(async (initialization) => {
    await reconcileProgramFilesRuntimeDirectory(options.fs, "MonacoEditor");
    await reconcileConfigurationRoot(options.fs);
    return initialization;
  });
  managed.setInitialization(ready);
  const programFiles = new ManagedProgramFilesService(options.fs, ready);
  const configuration = new ManagedConfigurationService(options.fs, options.fs, ready);

  stopNeutron = options.neutron.subscribe(() => {
    if (disposed) return;
    reconcileTail = reconcileTail
      .then(async () => {
        await ready;
        await reconcileNeutron();
      })
      .catch((error) => {
        filesystemLog?.warn(DiagnosticEvent.Filesystem.NeutronProjectionFailed, {
          stage: DiagnosticStage.Invalidation,
          errorType: diagnosticErrorType(error),
        });
      });
  });

  const trash: FilesystemTrashService = {
    trash: async (nodeId) => {
      await ready;
      try {
        return await privilegedTrash.trash(nodeId);
      } catch (error) {
        if (!isExpectedTrashFailure(error)) {
          filesystemLog?.error(DiagnosticEvent.Filesystem.TrashFailed, {
            errorType: diagnosticErrorType(error),
          });
        }
        throw error;
      }
    },
    list: async () => { await ready; return privilegedTrash.list(); },
    restore: async (nodeId, fallbackPath) => {
      await ready;
      try {
        return fallbackPath === undefined
          ? await privilegedTrash.restore(nodeId)
          : await privilegedTrash.restore(nodeId, fallbackPath);
      } catch (error) {
        if (!isExpectedTrashFailure(error)) {
          filesystemLog?.error(DiagnosticEvent.Filesystem.TrashRestoreFailed, {
            errorType: diagnosticErrorType(error),
          });
        }
        throw error;
      }
    },
    permanentlyDelete: async (nodeId) => {
      await ready;
      try {
        await privilegedTrash.permanentlyDelete(nodeId);
      } catch (error) {
        if (!isExpectedTrashFailure(error)) {
          filesystemLog?.error(DiagnosticEvent.Filesystem.TrashPermanentDeleteFailed, {
            errorType: diagnosticErrorType(error),
          });
        }
        throw error;
      }
    },
    empty: async () => {
      await ready;
      try {
        return await privilegedTrash.empty();
      } catch (error) {
        filesystemLog?.error(DiagnosticEvent.Filesystem.TrashEmptyFailed, {
          errorType: diagnosticErrorType(error),
        });
        throw error;
      }
    },
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
    configuration,
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
