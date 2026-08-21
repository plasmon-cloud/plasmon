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
import { HiddenVisibilityPreferenceStore } from "../hiddenVisibility.ts";
import { createNeutronBridge } from "../neutron/index.ts";
import { NativeApplicationRegistry, NativeProcessController } from "../process/index.ts";
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
  createPropertiesNativeLoader,
  propertiesAppDefinition,
} from "../../native-apps/properties/index.ts";
import {
  createRecycleBinNativeLoader,
  recycleBinAppDefinition,
} from "../../native-apps/recycle-bin/index.ts";
import {
  FakeResourceAuthorizationService,
  UnavailableResourceAuthorizationService,
} from "./authorizationFakes.ts";
import { IntegratedOpenService } from "./openService.ts";
import { isGameRuntimeProfile } from "./packageProfile.ts";

export interface PlasmonServices {
  fs: FsService;
  fsEvents: FsEventSource;
  filesystem: FilesystemCoreServices;
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
}

export type FilesystemFrontendMode = "hosted" | "standalone";

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
  return typeof window !== "undefined" && window.parent !== window
    ? "hosted"
    : "standalone";
}

export function createFilesystemService(
  mode: FilesystemFrontendMode = detectFilesystemFrontendMode(),
): FsService & FsEventSource {
  if (mode === "hosted") return createNeutronFsClient();
  return new PersistentFsService(new BrowserSelectedFsRepository());
}

export function createAssociationDefaultStore(fs: FsService): AssociationDefaultStore {
  return new FsServiceAssociationDefaultStore(fs);
}

function registerWave2Applications(
  nativeApps: NativeApplicationRegistry,
  associations: HandlerAssociationRegistry,
  fsEvents: FsEventSource,
  openService: OpenService,
  openAuthority: FileManagerOpenAuthority,
  trashAuthority: FileManagerTrashAuthority,
  clipboard: FileOperationClipboard,
  hiddenVisibility: HiddenVisibilityPreferenceStore,
): void {
  for (const handler of contentHandlerDefinitions) associations.registerHandler(handler);
  for (const rule of contentAssociationRules) associations.registerRule(rule);

  if (isGameRuntimeProfile) {
    associations.registerHandler(emulatorJsHandler);
    for (const rule of emulatorJsAssociationRules) associations.registerRule(rule);
    nativeApps.registerWithLoader(emulatorJsRuntimeDefinition, createEmulatorJsRuntimeLoader());

    associations.registerHandler(jsDosHandler);
    for (const rule of jsDosAssociationRules) associations.registerRule(rule);
    nativeApps.registerWithLoader(jsDosRuntimeDefinition, createJsDosRuntimeLoader());
  }

  const contentLoaders = createContentAppLoaders({ hiddenVisibility });
  for (const definition of contentAppDefinitions) {
    const loader = contentLoaders.get(definition.id);
    if (!loader) throw new Error(`Missing native application loader: ${definition.id}`);
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
  const rawFs = options.filesystemRepository
    ? new PersistentFsService(options.filesystemRepository)
    : createFilesystemService();
  const hiddenVisibility = new HiddenVisibilityPreferenceStore(rawFs);
  const windows = options.windows ?? new NativeWindowManager();
  const windowPlacement = new NativeWindowPlacementController(
    windows,
    new FsServiceWindowPlacementStore(rawFs),
    {
      onPersistenceError: (error) => console.warn("Plasmon window placement persistence failed:", error),
    },
  );
  const neutron = options.neutron ?? createNeutronBridge();
  const nativeApps = new NativeApplicationRegistry();
  const associations = new HandlerAssociationRegistry({ defaults: createAssociationDefaultStore(rawFs) });
  const process = new NativeProcessController(nativeApps, windows, undefined, {
    onWindowCreated: (appId, windowId) => windowPlacement.attach(appId, windowId),
  });
  const openService = new IntegratedOpenService({ nativeApps, associations, process, neutron });
  const fileClipboard = new FileOperationClipboard();
  let filesystem: FilesystemCoreServices | null = null;

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

  registerWave2Applications(
    nativeApps,
    associations,
    rawFs,
    openService,
    fileManagerOpenAuthority,
    fileManagerTrashAuthority,
    fileClipboard,
    hiddenVisibility,
  );

  filesystem = createFilesystemCore({
    fs: rawFs,
    nativeApps,
    neutron,
    associations,
    openService,
    process,
    ...(options.demoSeeds ? { demoSeeds: options.demoSeeds } : {}),
  });
  const fs = filesystem.fs;
  nativeApps.setLoader(
    recycleBinAppDefinition.id,
    createRecycleBinNativeLoader({ trash: filesystem.trash, fsEvents: fs }),
  );
  const startMenu = new StartMenuReconciliationController(fs, nativeApps, neutron);

  return {
    fs,
    fsEvents: fs,
    filesystem,
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
  };
}
