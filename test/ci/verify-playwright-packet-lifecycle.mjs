import { readFileSync } from "node:fs";
import {
  buildProbeMatrix,
  packetSizeForProbe,
  TARGETED_CHARACTERIZATION_PACKET_SIZE,
  MERGE_VALIDATION_CHARACTERIZATION_COUNT,
} from "./build-plasmon-flake-probe-matrix.mjs";
import {
  isolationForProbe,
  PERSISTENT_STATE_RESET_FILES,
} from "./plasmon-playwright-isolation.mjs";

const workflow = readFileSync(".github/workflows/plasmon-flake-probe.yml", "utf8");
const packetRunner = readFileSync("test/e2e/run-plasmon-playwright-packet.sh", "utf8");
const iterationRunner = readFileSync("test/ci/run-plasmon-flake-probe-iteration.sh", "utf8");
const flakeRunner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");

const reuseProbeFile = "test/e2e/plasmon-golden-path-left-snap.spec.ts";
const persistenceProbeFile = "test/e2e/plasmon-persistence.spec.ts";
const savedGameProbeFile = "test/e2e/plasmon-demo-game.spec.ts";

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} lost required fragment: ${fragment}`);
}
function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) throw new Error(`${label} contains forbidden fragment: ${fragment}`);
}
function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}
function env({ primaryCount, primaryMode = "merge-validation", primaryTarget = "all", charCount = 10, char = false }) {
  return {
    EVENT_NAME: primaryMode === "merge-validation" ? "merge_group" : "push",
    PRIMARY_APPLICABLE: "true",
    PRIMARY_MODE: primaryMode,
    PRIMARY_COUNT: String(primaryCount),
    PRIMARY_TARGET: primaryTarget,
    PRIMARY_TEST_FILE: "",
    PRIMARY_TEST_GREP: "",
    PRIMARY_SCOPE: primaryTarget,
    PRIMARY_SCOPE_KEY: primaryTarget,
    CHARACTERIZATION_APPLICABLE: char ? "true" : "false",
    CHARACTERIZATION_COUNT: String(charCount),
    CHARACTERIZATION_TARGET: "exact-set",
    CHARACTERIZATION_SCOPE: "characterization:local:fixture",
    CHARACTERIZATION_SCOPE_KEY: "char-local-fixture",
  };
}

if (TARGETED_CHARACTERIZATION_PACKET_SIZE !== 5) throw new Error("post-merge targeted packet size must remain 5");
if (MERGE_VALIDATION_CHARACTERIZATION_COUNT !== 10) throw new Error("merge validation characterization count must remain 10");
if (packetSizeForProbe({ mode: "characterization", iteration_count: 10, target: "exact-set" }) !== 10) {
  throw new Error("merge-queue 10-iteration characterization must use one prepared ten-repetition packet");
}
if (packetSizeForProbe({ mode: "characterization", iteration_count: 50, target: "exact-set" }) !== 5) {
  throw new Error("post-merge 50-iteration characterization must use five-repetition packets");
}
for (const count of [1, 10, 50]) {
  if (packetSizeForProbe({ mode: count === 1 ? "merge-validation" : "baseline", iteration_count: count, target: "all" }) !== 1) {
    throw new Error(`broad all ${count}-iteration probe must remain one execution per job`);
  }
}

const mergeChar = buildProbeMatrix(env({ primaryCount: 1, char: true, charCount: 10 })).include;
if (mergeChar.length !== 2) throw new Error(`merge queue must schedule one broad packet + one ten-repeat characterization packet; saw ${mergeChar.length}`);
const mergePrimary = mergeChar.find((packet) => packet.mode === "merge-validation");
const mergeCharacterization = mergeChar.find((packet) => packet.mode === "characterization");
if (mergePrimary?.repetitions !== 1 || mergePrimary?.iteration_count !== 1) throw new Error("merge broad packet lost exactly-one execution semantics");
if (mergeCharacterization?.repetitions !== 10 || mergeCharacterization?.start_iteration !== 1 || mergeCharacterization?.end_iteration !== 10) {
  throw new Error("merge characterization must cover repetitions 1-10 inside one prepared packet");
}

const postMerge = buildProbeMatrix(env({ primaryCount: 10, primaryMode: "baseline", char: true, charCount: 50 })).include;
const broad = postMerge.filter((packet) => packet.mode === "baseline");
const char = postMerge.filter((packet) => packet.mode === "characterization");
if (broad.length !== 10 || broad.some((packet) => packet.repetitions !== 1)) {
  throw new Error("post-merge baseline must schedule ten independent broad observations");
}
if (char.length !== 10 || char.some((packet) => packet.repetitions !== 5)) {
  throw new Error("post-merge characterization must schedule ten five-repetition packets");
}
const covered = char.flatMap((packet) => Array.from({ length: packet.repetitions }, (_, index) => packet.start_iteration + index));
if (covered.join(",") !== Array.from({ length: 50 }, (_, index) => index + 1).join(",")) {
  throw new Error("post-merge characterization packets must cover iterations 1-50 exactly once");
}

for (const resetFile of [persistenceProbeFile, savedGameProbeFile]) {
  if (!PERSISTENT_STATE_RESET_FILES.has(resetFile)) throw new Error(`known state-mutating probe must require reset: ${resetFile}`);
}
if (isolationForProbe({ target: "exact", testFile: persistenceProbeFile }).mode !== "reinstall") throw new Error("persistence characterization lost reinstall isolation");
if (isolationForProbe({ target: "exact", testFile: reuseProbeFile }).mode !== "reuse") throw new Error("ordinary characterization should reuse prepared deployment");
if (isolationForProbe({ target: "saved-preview" }).mode !== "reinstall") throw new Error("saved-preview must retain reinstall isolation");

for (const fragment of [
  "node test/ci/build-plasmon-flake-probe-matrix.mjs --github-output \"$GITHUB_OUTPUT\"",
  "PROBE_START_ITERATION: ${{ matrix.start_iteration }}",
  "PROBE_END_ITERATION: ${{ matrix.end_iteration }}",
  "PROBE_REPETITIONS: ${{ matrix.repetitions }}",
  "bash test/e2e/run-plasmon-playwright-packet.sh --",
  "bash test/ci/run-plasmon-flake-probe-iteration.sh",
  "max-parallel: 10",
]) requireFragment(workflow, fragment, "staged flake workflow");
forbidFragment(workflow, "--repeat-each", "staged flake workflow");

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

for (const fragment of [
  "iteration=$iteration",
  "iteration_count=$iteration_count",
  "outcome=$outcome",
  "sha=$probe_sha",
  "run_attempt=$run_attempt",
]) requireFragment(iterationRunner, fragment, "per-iteration evidence wrapper");
for (const fragment of ["--workers=1", "--retries=0", "--grep-invert @quarantine"]) {
  requireFragment(flakeRunner, fragment, "flake runner");
}

console.log("Playwright packet lifecycle verified for staged CI: merge queue uses 1 broad execution + one prepared 10-repeat characterization packet; post-merge uses 10 broad executions + ten 5-repeat characterization packets; setup reuse, explicit state reset, retries=0, workers=1, and quarantine exclusion are preserved");
