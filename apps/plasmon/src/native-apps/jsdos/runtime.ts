export type DosEvent = "emu-ready" | "ci-ready" | "bnd-play" | "open-key" | "fullscreen-change";

/** Logical managed runtime authority; this is not a host-root HTTP URL. */
export const JS_DOS_RUNTIME_ROOT = "/System/Program Files/js-dos";
export const JS_DOS_EMULATORS_ROOT = `${JS_DOS_RUNTIME_ROOT}/emulators/`;

/** URL-safe package transport for browser-executable js-dos assets. */
export const JS_DOS_BROWSER_RUNTIME_ROOT = "./runtime/jsdos/";

/**
 * Program Files remains the managed runtime authority, but installed Kernel
 * app-host delivery can make that path unsuitable for executable browser
 * assets. Resolve script/style/emulator requests through the package-local
 * transport mirror instead of changing the logical Program Files authority.
 */
export function jsDosPackageAssetUrl(pageUrl: string | URL, relativePath = ""): string {
  const suffix = relativePath.replace(/^\/+/, "");
  return new URL(`${JS_DOS_BROWSER_RUNTIME_ROOT}${suffix}`, pageUrl).href;
}

export interface JsDosPlayerOptions {
  url?: string;
  pathPrefix?: string;
  workerThread?: boolean;
  autoStart?: boolean;
  autoSave?: boolean;
  kiosk?: boolean;
  mouseCapture?: boolean;
  onEvent?: (event: DosEvent, arg?: unknown) => void;
}

export interface JsDosPlayerHandle {
  stop(): Promise<void>;
}

export type JsDosFunction = (
  element: HTMLDivElement,
  options: JsDosPlayerOptions,
) => JsDosPlayerHandle;

type JsDosGlobal = typeof globalThis & { Dos?: JsDosFunction };
type KeyboardNavigator = object & { keyboard?: unknown };
type StorageNavigator = object & { storage?: unknown };
type MemoryEntry = MemoryDirectoryHandle | MemoryFileHandle;

interface EmbeddedStorageLease {
  references: number;
  hadOwnStorage: boolean;
  ownStorageDescriptor?: PropertyDescriptor;
  adapter: MemoryStorageManager;
}

const embeddedStorageLeases = new WeakMap<object, EmbeddedStorageLease>();
let runtimePromise: Promise<JsDosFunction> | null = null;

function fileSystemError(name: string, message: string): Error {
  if (typeof DOMException === "function") return new DOMException(message, name);
  const error = new Error(message);
  error.name = name;
  return error;
}

async function writeBytes(data: unknown): Promise<Uint8Array> {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  if (typeof data === "object" && data !== null && "type" in data && "data" in data) {
    const command = data as { type?: unknown; data?: unknown };
    if (command.type === "write") return writeBytes(command.data);
  }
  throw new TypeError("Unsupported js-dos volatile storage write");
}

class MemoryFileHandle {
  readonly kind = "file" as const;
  private bytes = new Uint8Array();

  constructor(readonly name: string) {}

  async getFile(): Promise<File> {
    return new File([this.bytes.slice()], this.name, { lastModified: 0 });
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    const file = this;
    return {
      async write(data: unknown) {
        file.bytes = await writeBytes(data);
      },
      async close() {},
    } as unknown as FileSystemWritableFileStream;
  }
}

class MemoryDirectoryHandle {
  readonly kind = "directory" as const;
  private readonly children = new Map<string, MemoryEntry>();

  constructor(readonly name: string) {}

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<FileSystemDirectoryHandle> {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== "directory") {
        throw fileSystemError("TypeMismatchError", `${name} is not a directory`);
      }
      return existing as unknown as FileSystemDirectoryHandle;
    }
    if (!options.create) throw fileSystemError("NotFoundError", `${name} does not exist`);
    const directory = new MemoryDirectoryHandle(name);
    this.children.set(name, directory);
    return directory as unknown as FileSystemDirectoryHandle;
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<FileSystemFileHandle> {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== "file") {
        throw fileSystemError("TypeMismatchError", `${name} is not a file`);
      }
      return existing as unknown as FileSystemFileHandle;
    }
    if (!options.create) throw fileSystemError("NotFoundError", `${name} does not exist`);
    const file = new MemoryFileHandle(name);
    this.children.set(name, file);
    return file as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string, options: { recursive?: boolean } = {}): Promise<void> {
    const existing = this.children.get(name);
    if (!existing) throw fileSystemError("NotFoundError", `${name} does not exist`);
    if (existing.kind === "directory" && !options.recursive && existing.children.size !== 0) {
      throw fileSystemError("InvalidModificationError", `${name} is not empty`);
    }
    this.children.delete(name);
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<[string, MemoryEntry]> {
    for (const entry of this.children.entries()) yield entry;
  }
}

/**
 * js-dos 8.4.1 unconditionally uses StorageManager/OPFS for its own bundle
 * cache, local-change cache and storage statistics. Neutron intentionally gives
 * the installed Plasmon app an opaque sandboxed origin, where those APIs exist
 * in Chromium but reject. This adapter provides only the volatile subset that
 * js-dos itself requires. It is deliberately not durable Plasmon storage.
 */
class MemoryStorageManager {
  private readonly root = new MemoryDirectoryHandle("");

  async estimate(): Promise<StorageEstimate> {
    return {};
  }

  async getDirectory(): Promise<FileSystemDirectoryHandle> {
    return this.root as unknown as FileSystemDirectoryHandle;
  }
}

/**
 * Keep js-dos' internal OPFS/cache calls inside a volatile runtime-host adapter
 * while an embedded player is active. Multiple js-dos windows share one lease
 * just as native OPFS would be origin-scoped. The original browser StorageManager
 * is restored after the last player closes.
 */
export function installEmbeddedJsDosStorageCompatibility(
  embedded: boolean,
  navigatorObject: StorageNavigator,
): () => void {
  if (!embedded) return () => {};

  const existing = embeddedStorageLeases.get(navigatorObject);
  if (existing) {
    existing.references += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseEmbeddedStorageLease(navigatorObject, existing);
    };
  }

  const hadOwnStorage = Object.prototype.hasOwnProperty.call(navigatorObject, "storage");
  const ownStorageDescriptor = hadOwnStorage
    ? Object.getOwnPropertyDescriptor(navigatorObject, "storage")
    : undefined;
  const lease: EmbeddedStorageLease = {
    references: 1,
    hadOwnStorage,
    ownStorageDescriptor,
    adapter: new MemoryStorageManager(),
  };

  try {
    Object.defineProperty(navigatorObject, "storage", {
      configurable: true,
      enumerable: false,
      value: lease.adapter,
      writable: false,
    });
  } catch (error) {
    throw new Error(`Unable to isolate js-dos storage bootstrap: ${error instanceof Error ? error.message : String(error)}`);
  }
  embeddedStorageLeases.set(navigatorObject, lease);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseEmbeddedStorageLease(navigatorObject, lease);
  };
}

function releaseEmbeddedStorageLease(navigatorObject: StorageNavigator, lease: EmbeddedStorageLease): void {
  lease.references -= 1;
  if (lease.references > 0) return;
  embeddedStorageLeases.delete(navigatorObject);

  if (lease.hadOwnStorage && lease.ownStorageDescriptor) {
    Object.defineProperty(navigatorObject, "storage", lease.ownStorageDescriptor);
  } else if (!Reflect.deleteProperty(navigatorObject, "storage")) {
    throw new Error("Unable to restore js-dos StorageManager capability");
  }
}

/**
 * js-dos 8.4.1 probes the optional Keyboard Lock API during synchronous
 * Dos() construction without handling a rejected lock() promise. Chromium
 * exposes navigator.keyboard inside the installed app iframe but rejects
 * lock() there because Keyboard Lock is top-level-only. Shadow the optional
 * capability only for that synchronous constructor call, then restore the
 * navigator immediately. Keyboard event delivery remains unchanged.
 */
export function withEmbeddedKeyboardLockUnavailable<T>(
  embedded: boolean,
  navigatorObject: KeyboardNavigator,
  start: () => T,
): T {
  if (!embedded || !("keyboard" in navigatorObject)) return start();

  const hadOwnKeyboard = Object.prototype.hasOwnProperty.call(navigatorObject, "keyboard");
  const ownDescriptor = hadOwnKeyboard
    ? Object.getOwnPropertyDescriptor(navigatorObject, "keyboard")
    : undefined;

  try {
    Object.defineProperty(navigatorObject, "keyboard", {
      configurable: true,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  } catch (error) {
    throw new Error(`Unable to isolate js-dos Keyboard Lock: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    return start();
  } finally {
    if (hadOwnKeyboard && ownDescriptor) {
      Object.defineProperty(navigatorObject, "keyboard", ownDescriptor);
    } else if (!Reflect.deleteProperty(navigatorObject, "keyboard")) {
      throw new Error("Unable to restore js-dos Keyboard Lock capability");
    }
  }
}

export function startJsDosPlayer(
  Dos: JsDosFunction,
  element: HTMLDivElement,
  options: JsDosPlayerOptions,
): JsDosPlayerHandle {
  const embedded = window.top !== window;
  const releaseStorage = installEmbeddedJsDosStorageCompatibility(
    embedded,
    window.navigator as StorageNavigator,
  );

  try {
    const player = withEmbeddedKeyboardLockUnavailable(
      embedded,
      window.navigator as KeyboardNavigator,
      () => Dos(element, options),
    );
    let storageReleased = false;
    return {
      async stop() {
        try {
          await player.stop();
        } finally {
          if (!storageReleased) {
            storageReleased = true;
            releaseStorage();
          }
        }
      },
    };
  } catch (error) {
    releaseStorage();
    throw error;
  }
}

function installStylesheet(): void {
  if (document.querySelector('link[data-plasmon-runtime="js-dos"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = jsDosPackageAssetUrl(document.baseURI, "js-dos.css");
  link.dataset.plasmonRuntime = "js-dos";
  document.head.append(link);
}

export function loadJsDosRuntime(): Promise<JsDosFunction> {
  const global = globalThis as JsDosGlobal;
  if (global.Dos) return Promise.resolve(global.Dos);
  if (runtimePromise) return runtimePromise;

  runtimePromise = new Promise<JsDosFunction>((resolve, reject) => {
    installStylesheet();
    const existing = document.querySelector<HTMLScriptElement>('script[data-plasmon-runtime="js-dos"]');
    const script = existing ?? document.createElement("script");

    const finish = () => {
      const loaded = (globalThis as JsDosGlobal).Dos;
      if (!loaded) {
        runtimePromise = null;
        reject(new Error("js-dos runtime loaded without exposing Dos()"));
        return;
      }
      resolve(loaded);
    };
    const fail = () => {
      runtimePromise = null;
      reject(new Error("Unable to load packaged js-dos runtime"));
    };

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      queueMicrotask(() => {
        if ((globalThis as JsDosGlobal).Dos) finish();
      });
      return;
    }

    script.src = jsDosPackageAssetUrl(document.baseURI, "js-dos.js");
    script.async = true;
    script.dataset.plasmonRuntime = "js-dos";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  });

  return runtimePromise;
}
