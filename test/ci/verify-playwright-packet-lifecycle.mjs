import { readFileSync } from "node:fs";
import {
  buildProbeMatrix,
  packetSizeForProbe,
  TARGETED_PACKET_SIZE,
} from "./build-plasmon-flake-probe-matrix.mjs";
import {
  isolationForProbe,
  PERSISTENT_STATE_RESET_FILES,
} from "./plasmon-playwright-isolation.mjs";

const workflow = readFileSync(".github/workflows/plasmon-flake-probe.yml", "utf8");
const packetRunner = readFileSync("test/e2e/run-plasmon-playwright-packet.sh", "utf8");
const iterationRunner = readFileSync("test/ci/run-plasmon-flake-probe-iteration.sh", "utf8");
const flakeRunner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");

const reuseProbeFile = "test/e2e/plasmon-neutron-icon.spec.ts";
const persistenceProbeFile = "test/e2e/plasmon-persistence.spec.ts";
const savedGameProbeFile = "test/e2e/plasmon-demo-game.spec.ts";

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) {
    throw new Error(`${label} lost required fragment: ${fragment}`);
  }
}

function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) {
    throw new Error(`${label} contains forbidden fragment: ${fragment}`);
  }
}

function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}

function primaryEnv({ count, target }) {
  return {
    EVENT_NAME: "workflow_dispatch",
    PRIMARY_APPLICABLE: "true",
    PRIMARY_MODE: "manual",
    PRIMARY_COUNT: String(count),
    PRIMARY_TARGET: target,
    PRIMARY_TEST_FILE: target === "exact" ? reuseProbeFile : "",
    PRIMARY_TEST_GREP: "",
    PRIMARY_SCOPE: target,
    PRIMARY_SCOPE_KEY: target,
    CHARACTERIZATION_APPLICABLE: "false",
    CHARACTERIZATION_COUNT: "50",
    CHARACTERIZATION_TARGET: "exact-set",
    CHARACTERIZATION_SCOPE: "not-applicable",
    CHARACTERIZATION_SCOPE_KEY: "not-applicable",
  };
}

if (TARGETED_PACKET_SIZE !== 5) {
  throw new Error(`targeted repeated packet size must remain 5; saw ${TARGETED_PACKET_SIZE}`);
}

for (const target of [
  "exact",
  "exact-set",
  "right-snap",
  "left-snap",
  "window-lifetime",
  "monaco",
  "emulatorjs",
  "saved-preview",
]) {
  if (packetSizeForProbe({ iteration_count: 50, target }) !== 5) {
    throw new Error(`50-iteration targeted Playwright probe must use five-execution packets: ${target}`);
  }
}
for (const target of ["all", "specialist"]) {
  if (packetSizeForProbe({ iteration_count: 50, target }) !== 1) {
    throw new Error(`broad ${target} probes must remain one execution per job`);
  }
}
if (packetSizeForProbe({ iteration_count: 10, target: "exact" }) !== 1) {
  throw new Error("10-iteration probes must retain one execution per CI job");
}

const targeted = buildProbeMatrix(primaryEnv({ count: 50, target: "exact" })).include;
if (targeted.length !== 10) {
  throw new Error(`50 targeted iterations must resolve to 10 prepared packets; saw ${targeted.length}`);
}
const covered = targeted.flatMap((packet) =>
  Array.from(
    { length: packet.repetitions },
    (_, offset) => packet.start_iteration + offset,
  ),
);
if (covered.join(",") !== Array.from({ length: 50 }, (_, index) => index + 1).join(",")) {
  throw new Error("packetized characterization must cover probe iterations 1-50 exactly once");
}
if (targeted.some((packet) => packet.repetitions !== 5 || packet.packet_size !== 5)) {
  throw new Error("targeted characterization packets must contain five repetitions each");
}

const broad = buildProbeMatrix(primaryEnv({ count: 50, target: "specialist" })).include;
if (broad.length !== 50 || broad.some((packet) => packet.repetitions !== 1)) {
  throw new Error("broad Specialist probes must remain unbundled");
}
const baseline = buildProbeMatrix(primaryEnv({ count: 10, target: "all" })).include;
if (baseline.length !== 10 || baseline.some((packet) => packet.repetitions !== 1)) {
  throw new Error("10-iteration all baseline must retain ten independent jobs");
}
const combined = buildProbeMatrix({
  ...primaryEnv({ count: 10, target: "all" }),
  EVENT_NAME: "pull_request",
  CHARACTERIZATION_APPLICABLE: "true",
  CHARACTERIZATION_COUNT: "50",
  CHARACTERIZATION_TARGET: "exact-set",
  CHARACTERIZATION_SCOPE: "characterization:targeted:1-files:fixture",
  CHARACTERIZATION_SCOPE_KEY: "characterization-targeted-fixture",
}).include;
if (combined.length !== 20) {
  throw new Error(`baseline plus characterization must schedule 10 baseline jobs + 10 packets; saw ${combined.length}`);
}

for (const resetFile of [persistenceProbeFile, savedGameProbeFile]) {
  if (!PERSISTENT_STATE_RESET_FILES.has(resetFile)) {
    throw new Error(`known state-mutating probe must require reset: ${resetFile}`);
  }
  const isolation = isolationForProbe({ target: "exact", testFile: resetFile });
  if (isolation.mode !== "reinstall" || !isolation.resetFiles.includes(resetFile)) {
    throw new Error(`state-mutating probe lost per-repetition reset: ${resetFile}`);
  }
}

const reuseIsolation = isolationForProbe({ target: "exact", testFile: reuseProbeFile });
if (reuseIsolation.mode !== "reuse") {
  throw new Error(`ordinary targeted probe should reuse the prepared deployment; saw ${reuseIsolation.mode}`);
}
const namedReuse = isolationForProbe({ target: "right-snap" });
if (namedReuse.mode !== "reuse") {
  throw new Error("ordinary named targets should reuse the prepared deployment by default");
}
const namedReset = isolationForProbe({ target: "saved-preview" });
if (namedReset.mode !== "reinstall") {
  throw new Error("saved-preview must retain persistent-state reset isolation");
}
const mixedIsolation = isolationForProbe({
  target: "exact-set",
  testFilesJson: JSON.stringify([reuseProbeFile, persistenceProbeFile]),
});
if (mixedIsolation.mode !== "reinstall") {
  throw new Error("an exact-set containing a reset-required file must use the stronger isolation mode");
}

for (const fragment of [
  "node test/ci/build-plasmon-flake-probe-matrix.mjs --github-output \"$GITHUB_OUTPUT\"",
  "PROBE_START_ITERATION: ${{ matrix.start_iteration }}",
  "PROBE_END_ITERATION: ${{ matrix.end_iteration }}",
  "PROBE_REPETITIONS: ${{ matrix.repetitions }}",
  "bash test/e2e/run-plasmon-playwright-packet.sh --",
  "bash test/ci/run-plasmon-flake-probe-iteration.sh",
  "iteration-result-${{ github.run_id }}-attempt-${{ github.run_attempt }}-packet-${{ matrix.packet }}",
  "iteration-diagnostics-${{ github.run_id }}-attempt-${{ github.run_attempt }}-packet-${{ matrix.packet }}",
  "max-parallel: 10",
]) {
  requireFragment(workflow, fragment, "flake-probe packet workflow");
}
forbidFragment(workflow, "--repeat-each", "flake-probe packet workflow");

for (const fragment of [
  "npm ci",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve",
  "npm run plasmon:local:status",
  "node test/ci/plasmon-playwright-isolation.mjs",
  "npm run plasmon:local:reinstall",
  "export PLASMON_PLAYWRIGHT_ENV_READY=1",
  "for ((offset = 0; offset < repetitions; offset += 1))",
  "[ \"$isolation_mode\" = \"reinstall\" ]",
  "PLASMON_PACKET_ITERATION=\"$iteration\"",
  "PLASMON_PACKET_RESET_FAILED=\"$reset_failed\"",
  "kill \"$server_pid\"",
  "wait \"$server_pid\"",
]) {
  requireFragment(packetRunner, fragment, "reusable Playwright packet lifecycle");
}
for (const singleton of [
  "npm ci",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve",
  "npm run plasmon:local:status",
]) {
  if (occurrenceCount(packetRunner, singleton) !== 1) {
    throw new Error(`packet lifecycle must contain exactly one ${singleton} setup boundary`);
  }
}
if (occurrenceCount(packetRunner, "npm run plasmon:local:reinstall") !== 2) {
  throw new Error("packet lifecycle must contain one initial install and one conditional reset site");
}
const loopIndex = packetRunner.indexOf("for ((offset = 0; offset < repetitions; offset += 1))");
for (const setupFragment of [
  "npm ci",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve",
  "npm run plasmon:local:status",
  "node test/ci/plasmon-playwright-isolation.mjs",
  "export PLASMON_PLAYWRIGHT_ENV_READY=1",
]) {
  if (packetRunner.indexOf(setupFragment) > loopIndex) {
    throw new Error(`${setupFragment} must stay outside the repetition loop`);
  }
}
const loopSource = packetRunner.slice(loopIndex);
for (const fragment of [
  "if [ \"$offset\" -gt 0 ] && [ \"$isolation_mode\" = \"reinstall\" ]",
  "npm run plasmon:local:reinstall",
  "persistent-state reset",
]) {
  requireFragment(loopSource, fragment, "stateful repetition reset fallback");
}
forbidFragment(packetRunner, "@plasmon-prepared-env-reuse", "packet lifecycle");

for (const fragment of [
  "rm -rf playwright-report test-results",
  "iteration=$iteration",
  "outcome=$outcome",
  "sha=$probe_sha",
  "run_attempt=$run_attempt",
  "flake-probe-results/iteration-${iteration}",
  "flake-probe-diagnostics/iteration-${iteration}",
  "probe-output.log",
  "PLASMON_PACKET_RESET_FAILED",
  "PLASMON_PACKET_RESET_LOG",
  "Persistent-state reset failed before probe iteration",
]) {
  requireFragment(iterationRunner, fragment, "per-iteration evidence wrapper");
}

for (const fragment of [
  "PLASMON_PLAYWRIGHT_ENV_READY:-0",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve",
  "--workers=1",
  "--retries=0",
  "--grep-invert @r2-quarantine",
]) {
  requireFragment(flakeRunner, fragment, "prepared-compatible flake runner");
}
forbidFragment(flakeRunner, "include_quarantined", "prepared-compatible flake runner");
forbidFragment(packetRunner, "--repeat-each", "reusable Playwright packet lifecycle");

console.log(
  "Playwright packet lifecycle verified: targeted 50-run probes use 10 five-execution packets; prepared deployment reuse is the default; only explicit persistent-state-mutating files pay per-repetition reinstall reset; broad/baseline scheduling, exact iteration evidence, retries=0, workers=1, and quarantine exclusion are preserved",
);
