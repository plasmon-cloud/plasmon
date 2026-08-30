import { readFileSync } from "node:fs";
import { buildProbeMatrix, packetSizeForProbe } from "./build-plasmon-flake-probe-matrix.mjs";
import { browserLanes } from "./plasmon-test-inventory.mjs";
import { isolationForProbe, PERSISTENT_STATE_RESET_FILES } from "./plasmon-playwright-isolation.mjs";
import {
  MANUAL_CHARACTERIZATION_PACKET_SIZE,
  PRE_MERGE_CHARACTERIZATION_COUNT,
  PRE_MERGE_PROBE_COUNT,
  POST_MERGE_CHARACTERIZATION_COUNT,
  POST_MERGE_PROBE_COUNT,
  TARGETED_CHARACTERIZATION_PACKET_SIZE,
} from "./plasmon-flake-probe-policy.mjs";

const workflow = readFileSync(".github/workflows/plasmon-flake-probe.yml", "utf8");
const packetRunner = readFileSync("test/e2e/run-plasmon-playwright-packet.sh", "utf8");
const iterationRunner = readFileSync("test/ci/run-plasmon-flake-probe-iteration.sh", "utf8");
const flakeRunner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");

const reusableProbeFile = browserLanes.specialist.find((path) => !PERSISTENT_STATE_RESET_FILES.has(path));
if (!reusableProbeFile) throw new Error("Specialist inventory must contain a reusable Playwright acceptance");

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} lost required fragment: ${fragment}`);
}
function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) throw new Error(`${label} contains forbidden fragment: ${fragment}`);
}
function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}
function matrixEnv({ primaryCount, primaryMode, charCount, characterize }) {
  return {
    PRIMARY_APPLICABLE: "true",
    PRIMARY_MODE: primaryMode,
    PRIMARY_COUNT: String(primaryCount),
    PRIMARY_TARGET: "all",
    PRIMARY_TEST_FILE: "",
    PRIMARY_TEST_GREP: "",
    PRIMARY_SCOPE: "all",
    PRIMARY_SCOPE_KEY: "all",
    CHARACTERIZATION_APPLICABLE: characterize ? "true" : "false",
    CHARACTERIZATION_COUNT: String(charCount),
    CHARACTERIZATION_TARGET: "exact-set",
    CHARACTERIZATION_SCOPE: "characterization:local:fixture",
    CHARACTERIZATION_SCOPE_KEY: "characterization-local-fixture",
  };
}

if (packetSizeForProbe({ mode: "characterization", iteration_count: PRE_MERGE_CHARACTERIZATION_COUNT, target: "exact-set" }) !== PRE_MERGE_CHARACTERIZATION_COUNT) {
  throw new Error("approval-stage characterization must use one prepared packet");
}
if (packetSizeForProbe({ mode: "characterization", iteration_count: POST_MERGE_CHARACTERIZATION_COUNT, target: "exact-set" }) !== TARGETED_CHARACTERIZATION_PACKET_SIZE) {
  throw new Error("post-merge targeted characterization must use one prepared packet");
}
if (packetSizeForProbe({ mode: "manual", iteration_count: 50, target: "exact" }) !== MANUAL_CHARACTERIZATION_PACKET_SIZE) {
  throw new Error("manual 50-run targeted probe must retain five repetitions per prepared packet");
}
for (const count of [PRE_MERGE_PROBE_COUNT, POST_MERGE_PROBE_COUNT]) {
  if (packetSizeForProbe({ mode: "baseline", iteration_count: count, target: "all" }) !== 1) {
    throw new Error(`broad all ${count}-iteration probe must remain one execution per job`);
  }
}

const preMergePackets = buildProbeMatrix(matrixEnv({
  primaryCount: PRE_MERGE_PROBE_COUNT,
  primaryMode: "merge-validation",
  charCount: PRE_MERGE_CHARACTERIZATION_COUNT,
  characterize: true,
})).include;
if (preMergePackets.length !== 2) throw new Error(`approval-stage confidence must schedule two packets; saw ${preMergePackets.length}`);
const preMergePrimary = preMergePackets.find((packet) => packet.mode === "merge-validation");
const preMergeCharacterization = preMergePackets.find((packet) => packet.mode === "characterization");
if (preMergePrimary?.repetitions !== PRE_MERGE_PROBE_COUNT) throw new Error("approval broad packet lost one-execution semantics");
if (preMergeCharacterization?.repetitions !== PRE_MERGE_CHARACTERIZATION_COUNT || preMergeCharacterization?.start_iteration !== 1 || preMergeCharacterization?.end_iteration !== PRE_MERGE_CHARACTERIZATION_COUNT) {
  throw new Error("approval characterization must cover all 3 observations in one prepared packet");
}

const postMergePackets = buildProbeMatrix(matrixEnv({
  primaryCount: POST_MERGE_PROBE_COUNT,
  primaryMode: "baseline",
  charCount: POST_MERGE_CHARACTERIZATION_COUNT,
  characterize: true,
})).include;
const broadPackets = postMergePackets.filter((packet) => packet.mode === "baseline");
const characterizationPackets = postMergePackets.filter((packet) => packet.mode === "characterization");
if (broadPackets.length !== POST_MERGE_PROBE_COUNT || broadPackets.some((packet) => packet.repetitions !== 1)) {
  throw new Error("post-merge broad probes must remain independent observations pending shared-PocketIC optimization");
}
if (characterizationPackets.length !== 1 || characterizationPackets[0]?.repetitions !== POST_MERGE_CHARACTERIZATION_COUNT) {
  throw new Error("post-merge targeted 3 must use one prepared characterization packet");
}
const coveredIterations = characterizationPackets.flatMap((packet) =>
  Array.from({ length: packet.repetitions }, (_, index) => packet.start_iteration + index),
);
if (coveredIterations.join(",") !== Array.from({ length: POST_MERGE_CHARACTERIZATION_COUNT }, (_, index) => index + 1).join(",")) {
  throw new Error("post-merge characterization packet must cover every iteration exactly once");
}

for (const resetFile of PERSISTENT_STATE_RESET_FILES) {
  const isolation = isolationForProbe({ target: "exact", testFile: resetFile });
  if (isolation.mode !== "reinstall" || !isolation.resetFiles.includes(resetFile)) {
    throw new Error(`registered state-mutating acceptance lost reinstall isolation: ${resetFile}`);
  }
}
if (isolationForProbe({ target: "exact", testFile: reusableProbeFile }).mode !== "reuse") {
  throw new Error("ordinary Specialist characterization should reuse the prepared deployment");
}
if (isolationForProbe({ target: "saved-preview" }).mode !== "reinstall") {
  throw new Error("saved-preview must retain reinstall isolation");
}

for (const fragment of [
  "node test/ci/build-plasmon-flake-probe-matrix.mjs --github-output \"$GITHUB_OUTPUT\"",
  "PROBE_START_ITERATION: ${{ matrix.start_iteration }}",
  "PROBE_END_ITERATION: ${{ matrix.end_iteration }}",
  "PROBE_REPETITIONS: ${{ matrix.repetitions }}",
  "bash test/e2e/run-plasmon-playwright-packet.sh --",
  "bash test/ci/run-plasmon-flake-probe-iteration.sh",
  "max-parallel: 10",
]) requireFragment(workflow, fragment, "flake workflow packet orchestration");
forbidFragment(workflow, "--repeat-each", "flake workflow packet orchestration");

for (const fragment of [
  "npm ci",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve",
  "npm run plasmon:local:status",
  "node test/ci/plasmon-playwright-isolation.mjs",
  "export PLASMON_PLAYWRIGHT_ENV_READY=1",
  "for ((offset = 0; offset < repetitions; offset += 1))",
  "PLASMON_PACKET_ITERATION=\"$iteration\"",
  "kill \"$server_pid\"",
  "wait \"$server_pid\"",
]) requireFragment(packetRunner, fragment, "reusable Playwright packet lifecycle");
for (const singleton of ["npm ci", "npm run plasmon:local:prepare", "npm run plasmon:local:serve", "npm run plasmon:local:status"]) {
  if (occurrenceCount(packetRunner, singleton) !== 1) throw new Error(`packet lifecycle must pay ${singleton} setup exactly once`);
}

for (const fragment of ["iteration=$iteration", "iteration_count=$iteration_count", "outcome=$outcome", "sha=$probe_sha", "run_attempt=$run_attempt"]) {
  requireFragment(iterationRunner, fragment, "per-iteration evidence wrapper");
}
for (const fragment of ["--workers=1", "--retries=0", "--grep-invert @quarantine"]) {
  requireFragment(flakeRunner, fragment, "flake runner");
}

console.log("Playwright packet lifecycle verified: approval confidence uses one broad execution plus one prepared 3x characterization packet; post-merge uses three independent broad observations plus one prepared 3x targeted packet; manual targeted 50-run probes retain 10 parallel packets of 5 repetitions; setup reuse, state reset, retries=0, workers=1, and quarantine exclusion are preserved");
