import type {
  ExternalElement,
  FsNode,
  ProcessRecord,
  WindowState,
} from "../src/os/contracts/index.ts";
import { MemoryFsRepository } from "../src/os/fs/index.ts";
import {
  createPlasmonServices,
  type PlasmonServices,
} from "../src/os/integration/services.ts";
import { MockNeutronBridge } from "../src/os/neutron/index.ts";
import { NativeWindowManager } from "../src/os/windowing/index.ts";

export interface HeadlessPlasmonEnvironmentOptions {
  /** Elements exposed by the fake Neutron boundary. Defaults to no installed Elements. */
  elements?: readonly ExternalElement[];
  /** Optional in-memory persistence boundary to reuse across reconstructed production compositions. */
  repository?: MemoryFsRepository;
}

export interface HeadlessPlasmonEnvironment {
  readonly services: PlasmonServices;
  readonly repository: MemoryFsRepository;
  readonly neutron: MockNeutronBridge;
  readonly neutronMessages: readonly string[];
  readonly ready: PlasmonServices["filesystem"]["ready"];
  node(path: string): Promise<FsNode | null>;
  open(path: string): Promise<void>;
  processes(): readonly ProcessRecord[];
  windows(): readonly WindowState[];
  dispose(): void;
}

/**
 * Compose the real Plasmon OS graph for fast cross-surface tests.
 *
 * Only true environment boundaries are replaced: filesystem persistence is
 * in-memory, Neutron is the existing preview bridge, and window identifiers /
 * viewport are deterministic. Filesystem policy, bootstrap, associations,
 * opening, native app registration, process behavior, and window behavior all
 * come from the same production implementations used by PlasmonOS.
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
  });

  const node = (path: string): Promise<FsNode | null> => services.fs.resolvePath(path);

  return {
    services,
    repository,
    neutron,
    neutronMessages,
    ready: services.filesystem.ready,
    node,
    open: async (path) => {
      const target = await node(path);
      if (!target) throw new Error(`Headless Plasmon path does not exist: ${path}`);
      await services.filesystem.open.openNode(target.id);
    },
    processes: () => services.process.list(),
    windows: () => services.windows.list(),
    dispose: () => {
      for (const process of services.process.list()) services.process.close(process.id);
      services.filesystem.dispose();
      windows.dispose();
    },
  };
}
