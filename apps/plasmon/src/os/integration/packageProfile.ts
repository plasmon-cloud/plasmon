// Package builds replace these identifiers with explicit composition values.
// Unbundled tests preserve the historical full runtime graph fallback so focused
// runtime tests can exercise the hosts without pretending that Base packages
// ship those bytes. Production package builds always define the selected state.
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const SLIM_PROFILE_DEFINE: boolean | undefined = typeof __PLASMON_SLIM_PROFILE__ === "undefined"
  ? undefined
  : __PLASMON_SLIM_PROFILE__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const GAME_RUNTIME_DEFINE: boolean | undefined = typeof __PLASMON_GAME_RUNTIME__ === "undefined"
  ? undefined
  : __PLASMON_GAME_RUNTIME__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const JS_DOS_RUNTIME_DEFINE: boolean | undefined = typeof __PLASMON_RUNTIME_JSDOS__ === "undefined"
  ? undefined
  : __PLASMON_RUNTIME_JSDOS__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const EMULATORJS_RUNTIME_DEFINE: boolean | undefined = typeof __PLASMON_RUNTIME_EMULATORJS__ === "undefined"
  ? undefined
  : __PLASMON_RUNTIME_EMULATORJS__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const MONACO_SLIM_DEFINE: boolean | undefined = typeof __PLASMON_MONACO_SLIM__ === "undefined"
  ? undefined
  : __PLASMON_MONACO_SLIM__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const DEMO_DEFINE: boolean | undefined = typeof __PLASMON_DEMO__ === "undefined"
  ? undefined
  : __PLASMON_DEMO__;

export interface PackagedRuntimeSelection {
  readonly jsDos: boolean;
  readonly emulatorJs: boolean;
}

export const isSlimProfile = SLIM_PROFILE_DEFINE ?? false;
/**
 * @deprecated The accidental editor-less core package is no longer a supported
 * profile. Retain this consumer seam as false until downstream imports migrate.
 */
export const isCoreProfile = false;
export const isJsDosRuntimeSelected = JS_DOS_RUNTIME_DEFINE ?? GAME_RUNTIME_DEFINE ?? true;
export const isEmulatorJsRuntimeSelected = EMULATORJS_RUNTIME_DEFINE ?? GAME_RUNTIME_DEFINE ?? true;
export const packagedRuntimeSelection: PackagedRuntimeSelection = Object.freeze({
  jsDos: isJsDosRuntimeSelected,
  emulatorJs: isEmulatorJsRuntimeSelected,
});
/** @deprecated Use the per-runtime selection flags instead. */
export const isGameRuntimeProfile = isJsDosRuntimeSelected || isEmulatorJsRuntimeSelected;
export const isSlimMonacoProfile = MONACO_SLIM_DEFINE ?? false;
export const isDemoOverlay = DEMO_DEFINE ?? false;
/** @deprecated Demo is an overlay on Base, not a package profile. */
export const isDemoProfile = isDemoOverlay;
