// Package builds replace these identifiers with explicit profile values.
// Game/emulator payloads are not shipped by any current package profile, so
// package builds explicitly disable those handlers. Unbundled tests retain the
// full service graph through the fallback values below.
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const HACKATHON_PROFILE_DEFINE: boolean | undefined = typeof __PLASMON_HACKATHON_PROFILE__ === "undefined"
  ? undefined
  : __PLASMON_HACKATHON_PROFILE__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const GAME_RUNTIME_DEFINE: boolean | undefined = typeof __PLASMON_GAME_RUNTIME__ === "undefined"
  ? undefined
  : __PLASMON_GAME_RUNTIME__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const MONACO_SLIM_DEFINE: boolean | undefined = typeof __PLASMON_MONACO_SLIM__ === "undefined"
  ? undefined
  : __PLASMON_MONACO_SLIM__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const DEMO_DEFINE: boolean | undefined = typeof __PLASMON_DEMO__ === "undefined"
  ? undefined
  : __PLASMON_DEMO__;

export const isHackathonProfile = HACKATHON_PROFILE_DEFINE ?? false;
/**
 * @deprecated The accidental editor-less core package is no longer a supported
 * profile. Retain this consumer seam as false until downstream imports migrate.
 */
export const isCoreProfile = false;
export const isGameRuntimeProfile = GAME_RUNTIME_DEFINE ?? true;
export const isSlimMonacoProfile = MONACO_SLIM_DEFINE ?? false;
export const isDemoProfile = DEMO_DEFINE ?? false;
