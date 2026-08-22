import { readFileSync } from "node:fs";
import {
  buildProbeMatrix,
  packetSizeForProbe,
  TARGETED_PACKET_SIZE,
} from "./build-plasmon-flake-probe-matrix.mjs";

const workflow = readFileSync(".github/workflows/plasmon-flake-probe.yml", "utf8");
const packetRunner = readFileSync("test/e2e/run-plasmon-playwright-packet.sh", "utf8");
const iterationRunner = readFileSync("test/ci/run-plasmon-flake-probe-iteration.sh", "utf8");
const flakeRunner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");

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
    PRIMARY_TEST_FILE: target === "exact" ? "test/e2e/plasmon-neutron-icon.spec.ts" : "",
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
    throw new Error(`broad ${target} probes must not be silently bundled into repeated packets`);
  }
}
if (packetSizeForProbe({ iteration_count: 10, target: "exact" }) !== 1) {
  throw new Error("10-iteration probes must retain one fresh execution per CI job");
}

const targeted = buildProbeMatrix(primaryEnv({ count: 50, target: "exact" })).include;
if (targeted.length !== 10) {
  throw new Error(`50 targeted iterations must resolve to 10 prepared packets; saw ${targeted.length}`);
}
const coveredIterations = [];
for (const [index, packet] of targeted.entries()) {
  const expectedStart = index * 5 + 1;
  const expectedEnd = expectedStart + 4;
  if (
    packet.packet !== index + 1 ||
    packet.start_iteration !== expectedStart ||
    packet.end_iteration !== expectedEnd ||
    packet.repetitions !== 5 ||
    packet.packet_size !== 5
  ) {
    throw new Error(`targeted packet ${index + 1} lost deterministic five-iteration bounds`);
  }
  for (let iteration = packet.start_iteration; iteration <= packet.end_iteration; iteration += 1) {
    coveredIterations.push(iteration);
  }
}
if (coveredIterations.join(",") !== Array.from({ length: 50 }, (_, index) => index + 1).join(",")) {
  throw new Error("packetized characterization must cover each probe iteration 1-50 exactly once");
}

const broad = buildProbeMatrix(primaryEnv({ count: 50, target: "specialist" })).include;
if (broad.length !== 50 || broad.some((packet) => packet.repetitions !== 1)) {
  throw new Error("broad Specialist diagnostic probes must retain one iteration per job");
}

const baseline = buildProbeMatrix(primaryEnv({ count: 10, target: "all" })).include;
if (baseline.length !== 10 || baseline.some((packet) => packet.repetitions !== 1)) {
  throw new Error("10-iteration all baseline must retain ten independent one-execution jobs");
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
  throw new Error(`baseline plus characterization should schedule 10 baseline jobs + 10 prepared packets; saw ${combined.length}`);
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
  "npm run plasmon:local:reinstall",
  "for ((offset = 0; offset < repetitions; offset += 1))",
  "PLASMON_PACKET_ITERATION=\"$iteration\"",
  "PLASMON_PLAYWRIGHT_ENV_READY=1",
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
  "npm run plasmon:local:reinstall",
]) {
  if (occurrenceCount(packetRunner, singleton) !== 1) {
    throw new Error(`packet lifecycle must contain exactly one syntactic ${singleton} boundary`);
  }
}
const loopIndex = packetRunner.indexOf("for ((offset = 0; offset < repetitions; offset += 1))");
if (packetRunner.indexOf("npm ci") > loopIndex || packetRunner.indexOf("npm run plasmon:local:prepare") > loopIndex) {
  throw new Error("dependency install and package preparation must stay outside the repetition loop");
}
if (packetRunner.indexOf("npm run plasmon:local:reinstall") < loopIndex) {
  throw new Error("persistent-state reinstall reset must happen inside the repetition loop");
}

for (const fragment of [
  "rm -rf playwright-report test-results",
  "iteration=$iteration",
  "outcome=$outcome",
  "sha=$probe_sha",
  "run_attempt=$run_attempt",
  "flake-probe-results/iteration-${iteration}",
  "flake-probe-diagnostics/iteration-${iteration}",
  "probe-output.log",
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
  "Playwright packet lifecycle verified: targeted 50-run probes use 10 five-execution packets; install/package/PocketIC setup is packet-scoped; reinstall reset and fresh test execution are repetition-scoped; broad/baseline scheduling, exact iteration evidence, retries=0, workers=1, and quarantine exclusion are preserved",
);
