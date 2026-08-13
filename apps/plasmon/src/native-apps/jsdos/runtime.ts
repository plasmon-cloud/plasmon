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

let runtimePromise: Promise<JsDosFunction> | null = null;

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
  return withEmbeddedKeyboardLockUnavailable(
    window.top !== window,
    window.navigator as KeyboardNavigator,
    () => Dos(element, options),
  );
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
