// Package builds replace these identifiers with explicit profile values.
// Game/emulator payloads are not shipped by any profile, so package builds
// explicitly disable those handlers. Unbundled tests retain the full service
// graph through the fallback values below.
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const HACKATHON_CORE_DEFINE: boolean | undefined = typeof __PLASMON_HACKATHON_CORE__ === "undefined"
  ? undefined
  : __PLASMON_HACKATHON_CORE__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const GAME_RUNTIME_DEFINE: boolean | undefined = typeof __PLASMON_GAME_RUNTIME__ === "undefined"
  ? undefined
  : __PLASMON_GAME_RUNTIME__;
// @ts-expect-error Build-time esbuild define; runtime tests use the fallback.
const MONACO_SLIM_DEFINE: boolean | undefined = typeof __PLASMON_MONACO_SLIM__ === "undefined"
  ? undefined
  : __PLASMON_MONACO_SLIM__;

export const isHackathonCoreProfile = HACKATHON_CORE_DEFINE ?? false;
export const isGameRuntimeProfile = GAME_RUNTIME_DEFINE ?? !isHackathonCoreProfile;
export const isSlimMonacoProfile = MONACO_SLIM_DEFINE ?? false;
