import type {
  AssociationRegistry,
  FsEventSource,
  FsService,
  NeutronBridge,
  OpenService,
  ProcessController,
  ResourceAuthorizationService,
  WindowManager,
} from "../contracts/index.ts";
import {
  FsServiceAssociationDefaultStore,
  HandlerAssociationRegistry,
  type AssociationDefaultStore,
} from "../associations/index.ts";
import {
  FileOperationClipboard,
  type FileManagerOpenAuthority,
  type FileManagerTrashAuthority,
} from "../file-manager/index.ts";
import {
  PersistentFsService,
  createBrowserFsRepository,
  createFilesystemCore,
  createNeutronFsClient,
  type FilesystemCoreServices,
  type FilesystemSeedSpec,
  type FsRepository,
  type RepositoryCommit,
  type RepositoryState,
} from "../fs/index.ts";
import {
  DiagnosticEvent,
  DiagnosticSettingsStore,
  DiagnosticStage,
  DiagnosticSubsystem,
  PlasmonDiagnosticService,
  resolveDiagnosticSettingsCapabilities,
  type DiagnosticLogger,
  type DiagnosticService,
} from "../diagnostics/index.ts";
import { HiddenVisibilityPreferenceStore } from "../hiddenVisibility.ts";
import { createNeutronBridge } from "../neutron/index.ts";
import { setFrontendCallAdmissionDiagnosticLogger } from "../neutron/frontend-call-admission.ts";
import { NativeApplicationRegistry, NativeProcessController } from "../process/index.ts";
import {
  ShellPreferenceStore,
  ShellPreferencesController,
} from "../shell/preferences.ts";
import { StartMenuReconciliationController } from "../shell/start-menu-reconciliation-controller.ts";
import {
  FsServiceWindowPlacementStore,
  NativeWindowManager,
  NativeWindowPlacementController,
} from "../windowing/index.ts";
import {
  contentAppDefinitions,
  contentAssociationRules,
  contentHandlerDefinitions,
  createContentAppLoaders,
} from "../../native-apps/content-apps.ts";
import {
  createEmulatorJsRuntimeLoader,
  emulatorJsAssociationRules,
  emulatorJsHandler,
  emulatorJsRuntimeDefinition,
} from "../../native-apps/emulatorjs/index.ts";
import {
  createJsDosRuntimeLoader,
  jsDosAssociationRules,
  jsDosHandler,
  jsDosRuntimeDefinition,
} from "../../native-apps/jsdos/index.ts";
import {
  createExplorerNativeLoader,
  explorerAppDefinition,
} from "../../native-apps/explorer/index.ts";
import {
  MonacoRuntimeConfigService,
  type MonacoRuntimeConfigStore,
} from "../../native-apps/monaco-runtime-config/runtimeConfig.ts";
import {
  createPropertiesNativeLoader,
  propertiesAppDefinition,
} from "../../native-apps/properties/index.ts";
import {
  createRecycleBinNativeLoader,
  recycleBinAppDefinition,
} from "../../native-apps/recycle-bin/index.ts";
import { installMonacoEnvironment } from "../../native-apps/shared/monaco/monacoEnvironment.ts";
import {
  FakeResourceAuthorizationService,
  UnavailableResourceAuthorizationService,
} from "./authorizationFakes.ts";
import { IntegratedOpenService } from "./openService.ts";
import { isCoreProfile, isGameRuntimeProfile, isSlimProfile } from "./packageProfile.ts";
import {
  terminalAppDefinition,
  terminalAssociationRules,
  terminalHandler,
} from "../../native-apps/terminal/definition.ts";

export interface PlasmonServices {
  fs: FsService;
  fsEvents: FsEventSource;
  filesystem: FilesystemCoreServices;
  diagnostics: DiagnosticService;
  diagnosticSettings: DiagnosticSettingsStore;
  process: ProcessController;
  windows: WindowManager;
  windowPlacement: NativeWindowPlacementController;
  neutron: NeutronBridge;
  authorization: ResourceAuthorizationService;
  nativeApps: NativeApplicationRegistry;
  associations: AssociationRegistry;
  openService: OpenService;
  fileClipboard: FileOperationClipboard;
  startMenu: StartMenuReconciliationController;
  hiddenVisibility: HiddenVisibilityPreferenceStore;
  shellPreferences: ShellPreferencesController;
  monacoRuntimeConfig: MonacoRuntimeConfigStore;
}

export interface CreatePlasmonServicesOptions {
  /** Optional persistence boundary. Production callers use environment-selected filesystem persistence. */
  filesystemRepository?: FsRepository;
  /** Optional Neutron boundary for preview/tests. Production callers normally use createNeutronBridge(). */
  neutron?: NeutronBridge;
  /** Optional window authority, primarily useful for deterministic headless composition. */
  windows?: WindowManager;
  /** Explicit development/acceptance content only. Normal production boot omits demo seeds. */
  demoSeeds?: readonly FilesystemSeedSpec[];
  /**
   * Capability seam for the separately owned remote incident sink. This layer
   * never installs a provider; callers may enable policy only when that sink exists.
   */
  remoteIncidentSinkAvailable?: boolean;
}

export type FilesystemFrontendMode = "hosted" | "standalone";

function diagnosticErrorType(error: unknown): string {
  return error instanceof Error ? error.name || "Error" : typeof error;
}

function createAuthorizationService(): ResourceAuthorizationService {
  const preview = typeof window === "undefined" || window.parent === window;
  return preview
    ? new FakeResourceAuthorizationService()
    : new UnavailableResourceAuthorizationService();
}

class BrowserSelectedFsRepository implements FsRepository {
  readonly kind = "browser-selected";
  private readonly selected = createBrowserFsRepository({
    onFallback: (error) => console.warn("Plasmon standalone filesystem storage fallback:", error.message),
  });

  async load(): Promise<RepositoryState | null> {
    return (await this.selected).load();
  }

  async readChunk(hash: string, index: number): Promise<Uint8Array | null> {
    return (await this.selected).readChunk(hash, index);
  }

  async commit(change: RepositoryCommit): Promise<void> {
    await (await this.selected).commit(change);
  }
}

function detectFilesystemFrontendMode(): FilesystemFrontendMode {
  return typeof window !== "undefined" && window.parent !== window ? "hosted" : "standalone";
}

export function createFilesystemService(
  mode: FilesystemFrontendMode = detectFilesystemFrontendMode(),
): FsService & FsEventSource {
  if (mode === "hosted") return createNeutronFsClient();
  return new PersistentFsService(new BrowserSelectedFsRepository());
}

export function createAssociationDefaultStore(
  fs: FsService,
  diagnostics?: DiagnosticService,
): AssociationDefaultStore {
  return new FsServiceAssociationDefaultStore(fs, undefined, diagnostics);
}

function registerNativeApplications(
  nativeApps: NativeApplicationRegistry,
  associations: HandlerAssociationRegistry,
  fsEvents: FsEventSource,
  openService: OpenService,
  openAuthority: FileManagerOpenAuthority,
  trashAuthority: FileManagerTrashAuthority,
  clipboard: FileOperationClipboard,
  hiddenVisibility: HiddenVisibilityPreferenceStore,
  shellPreferences: ShellPreferencesController,
  diagnostics: DiagnosticService,
  diagnosticSettings: DiagnosticSettingsStore,
  log: DiagnosticLogger<typeof DiagnosticSubsystem.NativeApp>,
): void {
  for (const handler of contentHandlerDefinitions) associations.registerHandler(handler);
  for (const rule of contentAssociationRules) associations.registerRule(rule);

  if (isGameRuntimeProfile) {
    associations.registerHandler(emulatorJsHandler);
    for (const rule of emulatorJsAssociationRules) associations.registerRule(rule);
    nativeApps.registerWithLoader(
      emulatorJsRuntimeDefinition,
      createEmulatorJsRuntimeLoader(diagnostics.for(DiagnosticSubsystem.RuntimeEmulatorJs)),
    );

    associations.registerHandler(jsDosHandler);
    for (const rule of jsDosAssociationRules) associations.registerRule(rule);
    nativeApps.registerWithLoader(
      jsDosRuntimeDefinition,
      createJsDosRuntimeLoader(diagnostics.for(DiagnosticSubsystem.RuntimeJsDos)),
    );
  }

  const contentLoaders = createContentAppLoaders({
    hiddenVisibility,
    shellPreferences,
    diagnosticSettings,
  });
  for (const definition of contentAppDefinitions) {
    const loader = contentLoaders.get(definition.id);
    if (!loader) {
      log.error(DiagnosticEvent.NativeApp.RegistrationFailed, {
        message: "Native application loader is missing during registration",
        appId: definition.id,
        handlerId: definition.handlerId,
        reason: "missing-loader",
      });
      throw new Error(`Missing native application loader: ${definition.id}`);
    }
    nativeApps.registerWithLoader(definition, loader);
  }

  nativeApps.registerWithLoader(
    explorerAppDefinition,
    createExplorerNativeLoader({
      fsEvents,
      associations,
      openService,
      openAuthority,
      trashAuthority,
      clipboard,
      hiddenVisibility,
      diagnostics,
    }),
  );
  nativeApps.registerWithLoader(
    propertiesAppDefinition,
    createPropertiesNativeLoader({ fsEvents, associations, openService }),
  );
  nativeApps.register(recycleBinAppDefinition);
}

export function createPlasmonServices(
  options: CreatePlasmonServicesOptions = {},
): PlasmonServices {
  const filesystemMode = options.filesystemRepository ? null : detectFilesystemFrontendMode();
  const rawFs = options.filesystemRepository
    ? new PersistentFsService(options.filesystemRepository)
    : createFilesystemService(filesystemMode ?? undefined);
  let filesystem: FilesystemCoreServices | null = null;
  const diagnostics = new PlasmonDiagnosticService({
    fs: rawFs,
    ready: async () => {
      if (filesystem) await filesystem.ready;
    },
    onSinkError: (error) => console.error("Plasmon diagnostic persistence failed:", error),
  });
  const diagnosticSettings = new DiagnosticSettingsStore(
    rawFs,
    resolveDiagnosticSettingsCapabilities({
      slimProfile: isSlimProfile,
      remoteIncidentSinkAvailable: options.remoteIncidentSinkAvailable ?? false,
    }),
  );
  diagnosticSettings.subscribe(({ fileMinLevel, consoleMinLevel }) => {
    diagnostics.setSinkMinimumLevels({ fileMinLevel, consoleMinLevel });
  });
  const filesystemLog = diagnostics.for(DiagnosticSubsystem.Filesystem);
  const processLog = diagnostics.for(DiagnosticSubsystem.Process);
  const windowLog = diagnostics.for(DiagnosticSubsystem.Windowing);
  const nativeAppLog = diagnostics.for(DiagnosticSubsystem.NativeApp);
  const shellLog = diagnostics.for(DiagnosticSubsystem.Shell);
  const neutronLog = diagnostics.for(DiagnosticSubsystem.Neutron);
  const monacoRuntimeConfigLog = diagnostics.for(DiagnosticSubsystem.RuntimeMonaco);

  if (typeof window !== "undefined" && !isCoreProfile) {
    installMonacoEnvironment(globalThis, diagnostics.for(DiagnosticSubsystem.RuntimeMonaco));
  }
  if (filesystemMode === "hosted") {
    setFrontendCallAdmissionDiagnosticLogger(neutronLog);
  }

  const hiddenVisibility = new HiddenVisibilityPreferenceStore(rawFs);
  const shellPreferences = new ShellPreferencesController(new ShellPreferenceStore(rawFs));
  const windows = options.windows ?? new NativeWindowManager();
  const placementStore = new FsServiceWindowPlacementStore(rawFs, undefined, {
    onRestoreRejected: (reason) => {
      windowLog.warn(DiagnosticEvent.Windowing.PlacementRestoreRejected, {
        message: "Persisted window placement metadata was rejected",
        reason,
      });
    },
  });
  const windowPlacement = new NativeWindowPlacementController(windows, placementStore, {
    onPersistenceError: (error, stage) => {
      windowLog.warn(
        stage === "read"
          ? DiagnosticEvent.Windowing.PlacementReadFailed
          : DiagnosticEvent.Windowing.PlacementWriteFailed,
        {
          message: `Window placement ${stage} failed`,
          errorType: diagnosticErrorType(error),
        },
      );
    },
  });
  const neutron = options.neutron ?? createNeutronBridge({
    vanilla: { diagnosticLogger: neutronLog },
  });
  const nativeApps = new NativeApplicationRegistry({ diagnostics: nativeAppLog });
  const associations = new HandlerAssociationRegistry({
    defaults: createAssociationDefaultStore(rawFs, diagnostics),
  });
  const process = new NativeProcessController(nativeApps, windows, undefined, {
    onWindowCreated: (appId, windowId) => windowPlacement.attach(appId, windowId),
    onStartupError: (error, app, _target, stage, processId) => {
      processLog.error(DiagnosticEvent.Process.StartFailed, {
        message: "Native process startup failed",
        appId: app.id,
        handlerId: app.handlerId,
        processId,
        stage: stage === "window-create"
          ? DiagnosticStage.WindowCreate
          : stage === "window-placement"
            ? DiagnosticStage.WindowPlacement
            : DiagnosticStage.ProcessCommit,
        errorType: diagnosticErrorType(error),
      });
    },
    onCloseError: (error, record) => {
      processLog.error(DiagnosticEvent.Process.CloseHandlerFailed, {
        message: "Native process close handler failed",
        appId: record.appId,
        handlerId: record.handlerId,
        processId: record.id,
        errorType: diagnosticErrorType(error),
      });
    },
    onWindowCloseError: (error, record) => {
      processLog.error(DiagnosticEvent.Process.CloseFailed, {
        message: "Native process window teardown failed",
        appId: record.appId,
        handlerId: record.handlerId,
        processId: record.id,
        stage: DiagnosticStage.WindowClose,
        errorType: diagnosticErrorType(error),
      });
    },
    onWindowLost: (record) => {
      processLog.error(DiagnosticEvent.Process.WindowLost, {
        message: "Running native process lost its window",
        appId: record.appId,
        handlerId: record.handlerId,
        processId: record.id,
        windowId: record.windowId,
      });
    },
  });
  const openService = new IntegratedOpenService({ nativeApps, associations, process, neutron });
  const fileClipboard = new FileOperationClipboard();

  const fileManagerOpenAuthority: FileManagerOpenAuthority = {
    openNode: (nodeId, openOptions) => {
      if (!filesystem) return Promise.reject(new Error("Filesystem opening is not initialized"));
      return filesystem.open.openNode(nodeId, openOptions);
    },
  };
  const fileManagerTrashAuthority: FileManagerTrashAuthority = {
    trash: (nodeId) => {
      if (!filesystem) return Promise.reject(new Error("Filesystem Trash is not initialized"));
      return filesystem.trash.trash(nodeId);
    },
  };

  registerNativeApplications(
    nativeApps,
    associations,
    rawFs,
    openService,
    fileManagerOpenAuthority,
    fileManagerTrashAuthority,
    fileClipboard,
    hiddenVisibility,
    shellPreferences,
    diagnostics,
    diagnosticSettings,
    nativeAppLog,
  );
  if (!isCoreProfile && !isSlimProfile) {
    associations.registerHandler(terminalHandler);
    for (const rule of terminalAssociationRules) associations.registerRule(rule);
    nativeApps.register(terminalAppDefinition);
  }

  const filesystemCore = createFilesystemCore({
    fs: rawFs,
    nativeApps,
    neutron,
    associations,
    openService,
    process,
    diagnostics,
    ...(options.demoSeeds ? { demoSeeds: options.demoSeeds } : {}),
  });
  let diagnosticSettingsRestoreError: unknown = null;
  const ready = filesystemCore.ready.then(async (initialization) => {
    try {
      await diagnosticSettings.load();
    } catch (error) {
      diagnosticSettingsRestoreError = error;
    }
    return initialization;
  });
  filesystem = { ...filesystemCore, ready };
  const fs = filesystem.fs;
  void filesystem.ready
    .then((initialization) => {
      if (diagnosticSettingsRestoreError) {
        filesystemLog.warn(DiagnosticEvent.Filesystem.SettingsRestoreFailed, {
          message: "Persisted diagnostic sink settings could not be restored; safe defaults remain active",
          errorType: diagnosticErrorType(diagnosticSettingsRestoreError),
        });
      }
      filesystemLog.notice(DiagnosticEvent.Filesystem.BootstrapReady, {
        message: "Filesystem bootstrap completed",
      });
      if (initialization.neutronProjectionError) {
        filesystemLog.warn(DiagnosticEvent.Filesystem.NeutronProjectionFailed, {
          message: "Initial Neutron application projection reconciliation failed",
          error: initialization.neutronProjectionError,
        });
      }
    })
    .catch((error) => {
      filesystemLog.critical(DiagnosticEvent.Filesystem.BootstrapFailed, {
        message: "Filesystem bootstrap failed",
        error,
      });
    });
  const monacoRuntimeConfig = new MonacoRuntimeConfigService({
    fs,
    fsEvents: fs,
    programFiles: filesystem.programFiles,
    onDiagnostic: (item) => {
      const event = item.code === "filesystem-read-failed"
        ? DiagnosticEvent.RuntimeMonaco.ConfigReadFailed
        : item.code === "filesystem-write-failed"
          ? DiagnosticEvent.RuntimeMonaco.ConfigWriteFailed
          : DiagnosticEvent.RuntimeMonaco.ConfigInvalid;
      monacoRuntimeConfigLog.warn(event, {
        message: "Monaco runtime configuration fell back safely",
        reason: item.code,
      });
    },
  });
  nativeApps.setLoader(
    recycleBinAppDefinition.id,
    createRecycleBinNativeLoader({ trash: filesystem.trash, fsEvents: fs }),
  );
  const startMenu = new StartMenuReconciliationController(fs, nativeApps, neutron, {
    diagnostics: shellLog,
  });
  const services: PlasmonServices = {
    fs,
    fsEvents: fs,
    filesystem,
    diagnostics,
    diagnosticSettings,
    process,
    windows,
    windowPlacement,
    neutron,
    authorization: createAuthorizationService(),
    nativeApps,
    associations,
    openService,
    fileClipboard,
    startMenu,
    hiddenVisibility,
    shellPreferences,
    monacoRuntimeConfig,
  };

  if (isSlimProfile) return services;

  let scriptingIntegration: Promise<import("../../scripting/integration.ts").ScriptingIntegration> | null = null;
  const getScriptingIntegration = () => scriptingIntegration ??= import("../../scripting/integration.ts")
    .then(({ createScriptingIntegration }) => createScriptingIntegration(services));

  nativeApps.setLoader(
    explorerAppDefinition.id,
    createExplorerNativeLoader({
      fsEvents: fs,
      associations,
      openService,
      openAuthority: fileManagerOpenAuthority,
      trashAuthority: fileManagerTrashAuthority,
      clipboard: fileClipboard,
      hiddenVisibility,
      diagnostics,
      transpileCmdFile: async (nodeId) => {
        const { scripting } = await getScriptingIntegration();
        return scripting.transpileCmdFile(await fs.pathOf(nodeId));
      },
    }),
  );
  if (!isCoreProfile) {
    nativeApps.setLoader(
      terminalAppDefinition.id,
      async () => (await getScriptingIntegration()).terminalLoader(),
    );
  }

  return services;
}
