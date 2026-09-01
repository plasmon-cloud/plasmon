import type {
  ExternalElement,
  FsNode,
  ProcessRecord,
  WindowState,
} from "../src/os/contracts/index.ts";
import type { OsApi } from "../src/os/api/index.ts";
import { createPlasmonOsApi } from "../src/os/api/adapter.ts";
import type { DiagnosticService } from "../src/os/diagnostics/index.ts";
import { MemoryFsRepository } from "../src/os/fs/index.ts";
import {
  createPlasmonServices,
  type CreatePlasmonServicesOptions,
  type PlasmonServices,
} from "../src/os/integration/services.ts";
import { MockNeutronBridge } from "../src/os/neutron/index.ts";
import { NativeWindowManager } from "../src/os/windowing/index.ts";

export interface HeadlessPlasmonEnvironmentOptions {
  /** Elements exposed by the fake Neutron boundary. Defaults to no installed Elements. */
  elements?: readonly ExternalElement[];
  /** Optional in-memory persistence boundary to reuse across reconstructed production compositions. */
  repository?: MemoryFsRepository;
  /** Optional production runtime selection for package-composition acceptance tests. */
  runtimeSelection?: CreatePlasmonServicesOptions["runtimeSelection"];
}

export interface HeadlessPlasmonEnvironment {
  readonly services: PlasmonServices;
  /** The same production semantic OS API intended for non-test automation consumers. */
  readonly os: OsApi;
  /** The same production diagnostic stream used by Plasmon; not a test-only logger. */
  readonly diagnostics: DiagnosticService;
  readonly repository: MemoryFsRepository;
  readonly neutron: MockNeutronBridge;
  readonly neutronMessages: readonly string[];
  readonly ready: PlasmonServices["filesystem"]["ready"];
  /** @deprecated Prefer env.os.fs.stat() for new high-level deterministic tests. */
  node(path: string): Promise<FsNode | null>;
  /** @deprecated Prefer env.os.open() for new high-level deterministic tests. */
  open(path: string): Promise<void>;
  /** @deprecated Prefer env.os.processes.list() for new high-level deterministic tests. */
  processes(): readonly ProcessRecord[];
  /** @deprecated Prefer env.os.windows.list() for new high-level deterministic tests. */
  windows(): readonly WindowState[];
  dispose(): void;
}

/**
 * Compose the real Plasmon OS graph for fast cross-surface tests.
 *
 * Only true environment boundaries are replaced: filesystem persistence is
 * in-memory, Neutron is the existing preview bridge, and window identifiers /
 * viewport are deterministic. Filesystem policy, bootstrap, associations,
 * opening, native app registration, process behavior, diagnostics, and window
 * behavior all come from the same production implementations used by PlasmonOS.
 *
 * The production createPlasmonOsApi() adapter is exposed as env.os, and the
 * production DiagnosticService is exposed as env.diagnostics for deterministic
 * observation of events that Product code itself emits. The headless harness
 * does not implement a second semantic OS or logging facade; test-only powers,
 * if added later, belong beside these production authorities.
 *
 * Service construction assembles but does not launch the Start reconciliation
 * runtime. Pure/headless tests can therefore stage fixtures and invoke
 * reconciliation explicitly. renderPlasmon starts the same controller before
 * React renders, matching the production bootstrap lifecycle.
 */
export function createHeadlessPlasmonEnvironment(
  options: HeadlessPlasmonEnvironmentOptions = {},
): HeadlessPlasmonEnvironment {
  const repository = options.repository ?? new MemoryFsRepository();
  const neutronMessages: string[] = [];
  const neutron = new MockNeutronBridge({
    elements: options.elements ?? [],
    logger: (message) => neutronMessages.push(message),
  });
  let nextWindowId = 0;
  const windows = new NativeWindowManager({
    idFactory: () => `window:test:${++nextWindowId}`,
    viewport: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    listenForViewportChanges: false,
  });
  const services = createPlasmonServices({
    filesystemRepository: repository,
    neutron,
    windows,
    ...(options.runtimeSelection ? { runtimeSelection: options.runtimeSelection } : {}),
  });
  const os = createPlasmonOsApi({ services });

  const node = (path: string): Promise<FsNode | null> => services.fs.resolvePath(path);

  return {
    services,
    os,
    diagnostics: services.diagnostics,
    repository,
    neutron,
    neutronMessages,
    ready: services.filesystem.ready,
    node,
    open: async (path) => {
      await os.open(path);
    },
    processes: () => services.process.list(),
    windows: () => services.windows.list(),
    dispose: () => {
      services.startMenu.dispose();
      for (const process of services.process.list()) services.process.close(process.id);
      services.filesystem.dispose();
      windows.dispose();
    },
  };
}
