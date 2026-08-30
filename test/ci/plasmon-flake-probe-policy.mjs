export const PRE_MERGE_PROBE_COUNT = 1;
export const PRE_MERGE_CHARACTERIZATION_COUNT = 3;
export const POST_MERGE_PROBE_COUNT = 3;
export const POST_MERGE_CHARACTERIZATION_COUNT = 3;
export const TARGETED_CHARACTERIZATION_PACKET_SIZE = 3;

export const MANUAL_PROBE_COUNTS = Object.freeze([10, 50]);
export const MANUAL_PROBE_TARGETS = Object.freeze([
  "all",
  "specialist",
  "exact",
  "right-snap",
  "left-snap",
  "window-lifetime",
  "monaco",
  "emulatorjs",
  "saved-preview",
]);

const automaticPolicies = Object.freeze({
  pull_request: Object.freeze({
    phase: "pr-review",
    applicable: false,
    reason: "awaiting-approval",
    primaryMode: "merge-validation",
    primaryCount: PRE_MERGE_PROBE_COUNT,
    characterizationCount: PRE_MERGE_CHARACTERIZATION_COUNT,
    characterize: false,
  }),
  pull_request_review: Object.freeze({
    phase: "pre-merge-confidence",
    applicable: true,
    reason: "approved-review-confidence",
    primaryMode: "merge-validation",
    primaryCount: PRE_MERGE_PROBE_COUNT,
    characterizationCount: PRE_MERGE_CHARACTERIZATION_COUNT,
    characterize: true,
  }),
  merge_group: Object.freeze({
    phase: "merge-queue",
    applicable: false,
    reason: "fast-queue-only",
    primaryMode: "merge-validation",
    primaryCount: PRE_MERGE_PROBE_COUNT,
    characterizationCount: PRE_MERGE_CHARACTERIZATION_COUNT,
    characterize: false,
  }),
  push: Object.freeze({
    phase: "post-merge",
    applicable: true,
    reason: "integrated-release-push",
    primaryMode: "baseline",
    primaryCount: POST_MERGE_PROBE_COUNT,
    characterizationCount: POST_MERGE_CHARACTERIZATION_COUNT,
    characterize: true,
  }),
});

export function automaticProbePolicy(eventName) {
  const policy = automaticPolicies[eventName];
  if (!policy) throw new Error(`No automatic Flake Probe policy for event: ${eventName}`);
  return policy;
}

export function assertSupportedProbeModeCount(mode, count) {
  const valid =
    (mode === "merge-validation" && count === PRE_MERGE_PROBE_COUNT) ||
    (mode === "baseline" && count === POST_MERGE_PROBE_COUNT) ||
    (mode === "characterization" && count === PRE_MERGE_CHARACTERIZATION_COUNT) ||
    (mode === "manual" && MANUAL_PROBE_COUNTS.includes(count));
  if (!valid) throw new Error(`unsupported Flake Probe mode/count combination: ${mode}/${count}`);
}
