export const MERGE_QUEUE_PROBE_COUNT = 1;
export const MERGE_QUEUE_CHARACTERIZATION_COUNT = 10;
export const POST_MERGE_PROBE_COUNT = 10;
export const POST_MERGE_CHARACTERIZATION_COUNT = 50;
export const TARGETED_CHARACTERIZATION_PACKET_SIZE = 5;

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
    reason: "deferred-to-merge-queue",
    primaryMode: "merge-validation",
    primaryCount: MERGE_QUEUE_PROBE_COUNT,
    characterizationCount: MERGE_QUEUE_CHARACTERIZATION_COUNT,
    characterize: false,
  }),
  merge_group: Object.freeze({
    phase: "merge-queue",
    applicable: true,
    reason: "merge-group-validation",
    primaryMode: "merge-validation",
    primaryCount: MERGE_QUEUE_PROBE_COUNT,
    characterizationCount: MERGE_QUEUE_CHARACTERIZATION_COUNT,
    characterize: true,
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
    (mode === "merge-validation" && count === MERGE_QUEUE_PROBE_COUNT) ||
    (mode === "baseline" && count === POST_MERGE_PROBE_COUNT) ||
    (mode === "characterization" && [MERGE_QUEUE_CHARACTERIZATION_COUNT, POST_MERGE_CHARACTERIZATION_COUNT].includes(count)) ||
    (mode === "manual" && MANUAL_PROBE_COUNTS.includes(count));
  if (!valid) throw new Error(`unsupported Flake Probe mode/count combination: ${mode}/${count}`);
}
