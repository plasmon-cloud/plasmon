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
import { createNeutronBridge } from "../neutron/index.ts";
import { NativeApplicationRegistry, NativeProcessController } from "../process/index.ts";
import { NativeWindowManager } from "../windowing/index.ts";
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

export interface PlasmonServices {
  fs: FsService;
  fsEvents: FsEventSource;
  filesystem: FilesystemCoreServices;
  process: ProcessController;
  windows: WindowManager;
  neutron: NeutronBridge;
  authorization: ResourceAuthorizationService;
  nativeApps: NativeApplicationRegistry;
  associations: AssociationRegistry;
  openService: OpenService;
  fileClipboard: FileOperationClipboard;
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

/**
 * Synchronous repository adapter for standalone preview. Repository selection
 * itself is asynchronous because IndexedDB can exist while open() is denied by
 * browser storage policy. createBrowserFsRepository probes it and safely falls
 * back rather than treating presence of globalThis.indexedDB as availability.
 */
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

/**
 * Kernel-hosted Plasmon uses the existing foreground RPC client so durable
 * browser storage remains owned by the privileged/persistent background
 * surface. Standalone preview keeps an in-page filesystem for development.
 */
export function createFilesystemService(
  mode: FilesystemFrontendMode = detectFilesystemFrontendMode(),
): FsService & FsEventSource {
  if (mode === "hosted") return createNeutronFsClient();
  return new PersistentFsService(new BrowserSelectedFsRepository());
}

/**
 * Association defaults follow the same hosted persistence boundary as Shell
 * preferences: foreground code persists through FsService, which routes to the
 * persistent Plasmon background surface when running inside Neutron.
 */
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
): void {
  for (const handler of contentHandlerDefinitions) associations.registerHandler(handler);
  for (const rule of contentAssociationRules) associations.registerRule(rule);

  // EmulatorJS and js-dos are normal association/runtime handlers. Their
  // process-host definitions exist only because OpenService routes local React
  // hosts through NativeProcessController; they do not create runtime .sys apps.
  associations.registerHandler(emulatorJsHandler);
  for (const rule of emulatorJsAssociationRules) associations.registerRule(rule);
  nativeApps.registerWithLoader(emulatorJsRuntimeDefinition, createEmulatorJsRuntimeLoader());

  associations.registerHandler(jsDosHandler);
  for (const rule of jsDosAssociationRules) associations.registerRule(rule);
  nativeApps.registerWithLoader(jsDosRuntimeDefinition, createJsDosRuntimeLoader());

  const contentLoaders = createContentAppLoaders();
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
    }),
  );
  nativeApps.registerWithLoader(
    propertiesAppDefinition,
    createPropertiesNativeLoader({ fsEvents, associations, openService }),
  );

  // Recycle Bin must be visible to filesystem bootstrap so RecycleBin.sys is
  // reconciled as a real system application. Its loader is attached only after
  // createFilesystemCore() exposes the canonical privileged Trash facade.
  nativeApps.register(recycleBinAppDefinition);
}

/**
 * Wave 2 composition root. In Neutron, filesystem calls are routed to the
 * persistent Plasmon background surface through FsRpcClient; standalone
 * preview selects a browser-local repository with safe fallback. Association
 * user defaults persist through that same raw FsService rather than foreground
 * browser storage.
 *
 * Tests may inject only true external/runtime boundaries (for example an
 * in-memory persistence repository, a mock Neutron bridge, or deterministic window
 * manager). Registration, associations, opening, filesystem policy, process
 * behavior, and all other OS semantics remain the same production composition.
 *
 * The returned public fs is the filesystem-core facade: it waits for migration
 * and bootstrap to finish and applies dot-hidden listing semantics. The core
 * itself still mutates only through FsService primitives, so persistence remains
 * owned by the existing hosted/background boundary.
 *
 * Authenticated Neutron application surfaces remain Kernel-owned sibling
 * tiles. Plasmon only discovers and opens them through NeutronBridge.
 */
export function createPlasmonServices(
  options: CreatePlasmonServicesOptions = {},
): PlasmonServices {
  const rawFs = options.filesystemRepository
    ? new PersistentFsService(options.filesystemRepository)
    : createFilesystemService();
  const windows = options.windows ?? new NativeWindowManager();
  const neutron = options.neutron ?? createNeutronBridge();
  const nativeApps = new NativeApplicationRegistry();
  const associations = new HandlerAssociationRegistry({ defaults: createAssociationDefaultStore(rawFs) });
  const process = new NativeProcessController(nativeApps, windows);
  const openService = new IntegratedOpenService({ nativeApps, associations, process, neutron });
  const fileClipboard = new FileOperationClipboard();
  let filesystem: FilesystemCoreServices | null = null;

  // Native Explorer registration happens before filesystem bootstrap so the
  // canonical dispatcher can discover the Explorer handler during core setup.
  // These lazy authorities preserve that order without rebuilding filesystem
  // policy in FileManager or introducing policy dependencies into the UI.
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

  return {
    fs,
    fsEvents: fs,
    filesystem,
    process,
    windows,
    neutron,
    authorization: createAuthorizationService(),
    nativeApps,
    associations,
    openService,
    fileClipboard,
  };
}
