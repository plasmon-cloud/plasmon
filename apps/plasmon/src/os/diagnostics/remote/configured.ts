import type { DiagnosticService } from "../service.ts";
import { attachRemoteIncidentSink, type RemoteIncidentBridge } from "./bridge.ts";
import { RollbarRemoteIncidentSink } from "./rollbar.ts";

// All values below are replaced by esbuild. Unbundled tests deliberately fall
// back to disabled/unknown values rather than needing deployment credentials.
// @ts-expect-error build-time define
const ROLLBAR_TOKEN = typeof __PLASMON_ROLLBAR_CLIENT_TOKEN__ === "undefined" ? "" : __PLASMON_ROLLBAR_CLIENT_TOKEN__;
// @ts-expect-error build-time define
const BUILD_SHA = typeof __PLASMON_BUILD_SHA__ === "undefined" ? "" : __PLASMON_BUILD_SHA__;
// @ts-expect-error build-time define
const PLASMON_VERSION = typeof __PLASMON_VERSION__ === "undefined" ? "0.1.0-dev" : __PLASMON_VERSION__;
// @ts-expect-error build-time define
const PACKAGE_PROFILE = typeof __PLASMON_PACKAGE_PROFILE__ === "undefined" ? "unbundled" : __PLASMON_PACKAGE_PROFILE__;
// @ts-expect-error build-time define
const REMOTE_EXPERIMENT = typeof __PLASMON_REMOTE_INCIDENT_EXPERIMENT__ === "undefined" ? false : __PLASMON_REMOTE_INCIDENT_EXPERIMENT__;

const REMOTE_METADATA_ALLOWLIST = Object.freeze([
  "appId",
  "handlerId",
  "runtime",
  "runtimeVersion",
  "phase",
  "operation",
  "reason",
  "status",
  "code",
] as const);

export function attachConfiguredRemoteIncidentExperiment(
  diagnostics: DiagnosticService,
): RemoteIncidentBridge | undefined {
  if (!REMOTE_EXPERIMENT || !ROLLBAR_TOKEN.trim() || !BUILD_SHA.trim()) return undefined;

  const sink = new RollbarRemoteIncidentSink({
    accessToken: ROLLBAR_TOKEN,
    environment: `plasmon-${PACKAGE_PROFILE}`,
    releaseSha: BUILD_SHA,
    sourceMapsEnabled: true,
  });
  return attachRemoteIncidentSink(diagnostics, sink, {
    build: {
      plasmonVersion: PLASMON_VERSION,
      releaseSha: BUILD_SHA,
      packageProfile: PACKAGE_PROFILE,
      packageIdentity: "plasmon",
    },
    metadataAllowlist: REMOTE_METADATA_ALLOWLIST,
    breadcrumbLimit: 20,
    maxPendingReports: 16,
    repeatIntervalMs: 10_000,
  });
}

export function installRemoteIncidentSyntheticProbe(diagnostics: DiagnosticService): void {
  if (!REMOTE_EXPERIMENT || typeof window === "undefined") return;
  const target = window as Window & {
    __plasmonRemoteIncidentExperiment?: (variant?: "same" | "different") => void;
  };
  target.__plasmonRemoteIncidentExperiment = (variant = "same") => {
    const correlationId = variant === "different"
      ? "remote-experiment-different"
      : "remote-experiment-same";
    const log = diagnostics.for("remote-experiment", { correlationId });
    if (variant === "different") {
      log.error("remote.synthetic.other-failed", {
        message: "Synthetic materially different remote incident",
        phase: "round-trip",
        error: new Error("Synthetic different remote incident"),
      });
      return;
    }
    log.error("remote.synthetic.failed", {
      message: "Synthetic remote incident",
      phase: "round-trip",
      error: new Error("Synthetic remote incident"),
    });
  };
}
