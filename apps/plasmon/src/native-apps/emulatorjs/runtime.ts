export const EMULATORJS_PROGRAM_FILES_ROOT = "./System/Program Files/EmulatorJS/";
export const EMULATORJS_BROWSER_DATA_ROOT = "./runtime/emulatorjs/data/";
export const EMULATORJS_HOST_PAGE = "./emulatorjs-host.html";
export const EMULATORJS_NES_MIME = "application/x-nes-rom";

export interface EmulatorJsLaunchConfig {
  player: "#game";
  core: "nes";
  gameUrl: string;
  gameName: string;
  dataRoot: string;
  startOnLoaded: true;
  threads: false;
  disableLocalStorage: true;
  disableDatabases: true;
  language: "en-US";
  disableAutoLang: false;
}

export function resolveEmulatorJsDataRoot(baseUri: string): string {
  return new URL(EMULATORJS_BROWSER_DATA_ROOT, baseUri).href;
}

export function resolveEmulatorJsHostUrl(baseUri: string, runtimeToken: string): string {
  const host = new URL(EMULATORJS_HOST_PAGE, baseUri);
  host.searchParams.set("token", runtimeToken);
  return host.href;
}

export function createEmulatorJsLaunchConfig(
  gameUrl: string,
  gameName: string,
  baseUri: string,
): EmulatorJsLaunchConfig {
  return {
    player: "#game",
    core: "nes",
    gameUrl,
    gameName,
    dataRoot: resolveEmulatorJsDataRoot(baseUri),
    startOnLoaded: true,
    threads: false,
    disableLocalStorage: true,
    disableDatabases: true,
    language: "en-US",
    disableAutoLang: false,
  };
}

export function assertNesRom(bytes: Uint8Array): void {
  if (bytes.length < 16) throw new Error("NES ROM is smaller than its iNES header");
  if (bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) {
    throw new Error("NES ROM does not have an iNES header");
  }

  const prgBanks = bytes[4] ?? 0;
  const chrBanks = bytes[5] ?? 0;
  if (prgBanks === 0) throw new Error("NES ROM does not contain a PRG bank");

  const trainerBytes = ((bytes[6] ?? 0) & 0x04) !== 0 ? 512 : 0;
  const minimumSize = 16 + trainerBytes + prgBanks * 16_384 + chrBanks * 8_192;
  if (bytes.length < minimumSize) {
    throw new Error(`NES ROM is truncated (expected at least ${minimumSize} bytes)`);
  }
}
