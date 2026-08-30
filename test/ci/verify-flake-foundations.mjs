import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserLanes, optionalCoreBrowserTests } from "./plasmon-test-inventory.mjs";
import { selectCharacterization } from "./select-plasmon-flake-characterization.mjs";
import { activeQuarantines, isFullyQuarantinedSource } from "./plasmon-quarantine.mjs";
import { isolationForProbe, PERSISTENT_STATE_RESET_FILES } from "./plasmon-playwright-isolation.mjs";

const runner = readFileSync("test/ci/run-plasmon-flake-probe.sh", "utf8");
const packetRunner = readFileSync("test/e2e/run-plasmon-playwright-packet.sh", "utf8");
const specialistRunner = readFileSync("test/ci/run-plasmon-specialist.mjs", "utf8");
const selector = readFileSync("test/ci/select-plasmon-flake-characterization.mjs", "utf8");
const quarantine = readFileSync("test/ci/plasmon-quarantine.mjs", "utf8");
const matureSummarizer = readFileSync("test/ci/summarize-flake-probe.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} lost required fragment: ${fragment}`);
}
function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) throw new Error(`${label} contains forbidden fragment: ${fragment}`);
}

for (const fragment of [
  "npm ci",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve",
  "npm run plasmon:local:status",
  "npm run plasmon:local:reinstall",
  "--workers=1",
  "--retries=0",
  "--grep-invert @quarantine",
  "exact)",
  "exact-set)",
  "PROBE_TEST_FILES_JSON",
  "exact-set requires a non-empty JSON array",
  "validate_exact_file",
]) requireFragment(runner, fragment, "flake executable runner");
for (const fragment of ["--repeat-each", "include_quarantined", "--retries=1"]) forbidFragment(runner, fragment, "flake executable runner");

const specialistScript = packageJson.scripts?.["test:e2e:plasmon:specialist"];
if (typeof specialistScript !== "string" || !specialistScript.includes("test/ci/run-plasmon-specialist.mjs")) {
  throw new Error("Specialist npm script lost semantic Specialist runner");
}
for (const fragment of ["discoverPlasmonTests", "lane === 'specialist'", "--workers=1", "--grep-invert", "@quarantine"]) {
  requireFragment(specialistRunner, fragment, "Specialist runner");
}

for (const fragment of [
  "repositoryPathReferences",
  "dependsOn",
  "unresolvedSharedInputs",
  "isFullyQuarantinedSource",
  "plasmon-quarantine.json",
  "excluded_quarantined_tests",
  "unresolved_inputs",
  "target: \"exact-set\"",
  "no-deterministic-playwright-target",
  "only-profile-specific-playwright-changes",
  "only-quarantined-playwright-changes",
]) requireFragment(selector, fragment, "automatic characterization selector");
for (const fragment of ["shared-support-fallback", "specialist-fallback", "lane === \"specialist\""]) {
  forbidFragment(selector, fragment, "automatic characterization selector");
}

for (const fragment of ["schemaVersion !== 1", "Duplicate quarantine id", "Duplicate quarantine selector", "@quarantine", "retries=0", "isFullyQuarantinedSource"]) {
  requireFragment(quarantine, fragment, "quarantine authority");
}
for (const fragment of ["selectLatestIterationResults", "run_attempt provenance", "plasmon-flake-summary-v1", "superseded_results", "FLAKE/FAILURE OBSERVED:"]) {
  requireFragment(matureSummarizer, fragment, "mature evidence summarizer");
}

const reusableOrdinary = browserLanes.specialist.filter((path) => !PERSISTENT_STATE_RESET_FILES.has(path));
const [ordinaryA, ordinaryB] = reusableOrdinary;
const profileSpecific = optionalCoreBrowserTests.find((path) => !browserLanes.specialist.includes(path));
if (!ordinaryA || !ordinaryB || !profileSpecific) throw new Error("shared browser inventory lacks representative foundation cases");

const one = await selectCharacterization({ changedFiles: [ordinaryA] });
if (!one.applicable || one.target !== "exact-set" || one.files.length !== 1 || one.files[0] !== ordinaryA) {
  throw new Error("one changed ordinary Playwright acceptance must remain one exact target");
}
const two = await selectCharacterization({ changedFiles: [ordinaryB, ordinaryA] });
if (!two.applicable || two.files.length !== 2 || !two.files.includes(ordinaryA) || !two.files.includes(ordinaryB)) {
  throw new Error("multiple changed ordinary Playwright acceptances must remain one exact set");
}
const profileOnly = await selectCharacterization({ changedFiles: [profileSpecific] });
if (profileOnly.applicable || profileOnly.reason !== "only-profile-specific-playwright-changes" || !profileOnly.deferred_profile_tests.includes(profileSpecific)) {
  throw new Error("base selector must keep profile-specific targets out of the local package");
}
const mixed = await selectCharacterization({ changedFiles: [ordinaryA, profileSpecific] });
if (!mixed.applicable || !mixed.files.includes(ordinaryA) || mixed.files.includes(profileSpecific) || !mixed.deferred_profile_tests.includes(profileSpecific)) {
  throw new Error("mixed profile selection must keep profile-specific targets out of local characterization");
}
const helper = await selectCharacterization({ changedFiles: ["test/e2e/plasmon-browser-health.ts"] });
if (!helper.applicable || helper.files.length === 0) throw new Error("deterministically impacted helper must resolve consumers");
const unresolved = await selectCharacterization({ changedFiles: ["test/e2e/permission-dialog.fixture.tsx"] });
if (unresolved.applicable || unresolved.reason !== "no-deterministic-playwright-target") {
  throw new Error("unresolved support input must fail closed without broad characterization");
}
const configOnly = await selectCharacterization({ changedFiles: ["playwright.config.ts"] });
if (configOnly.applicable || configOnly.reason !== "no-deterministic-playwright-target") {
  throw new Error("shared Playwright config must not broaden into whole-Specialist characterization");
}

const syntheticPath = "test/e2e/plasmon-quarantined-fixture.spec.ts";
const syntheticSource = 'import { test } from "@playwright/test";\ntest("q", { tag: ["@quarantine", "@synthetic"] }, async () => {});\n';
const syntheticEntries = [{ id: "synthetic", path: syntheticPath, selectorTag: "@synthetic", title: "q", active: true, classification: "known-flaky", repairIssue: 1, exitCriteria: "retries=0" }];
if (!isFullyQuarantinedSource(syntheticPath, syntheticSource, syntheticEntries)) throw new Error("fully quarantined source was not recognized");
if (isFullyQuarantinedSource(syntheticPath, `${syntheticSource}test("required", async () => {});\n`, syntheticEntries)) {
  throw new Error("mixed required/quarantined source must not be classified as fully quarantined");
}
if (activeQuarantines.length < 1) throw new Error("active quarantine authority unexpectedly empty during known debt lifecycle");

for (const resetFile of PERSISTENT_STATE_RESET_FILES) {
  const isolation = isolationForProbe({ target: "exact", testFile: resetFile });
  if (isolation.mode !== "reinstall" || !isolation.resetFiles.includes(resetFile)) {
    throw new Error(`registered state-mutating acceptance lost reset isolation: ${resetFile}`);
  }
}
if (isolationForProbe({ target: "exact", testFile: ordinaryA }).mode !== "reuse") throw new Error("ordinary exact target should reuse prepared deployment");
if (isolationForProbe({ target: "saved-preview" }).mode !== "reinstall") throw new Error("saved-preview named target lost reset isolation");

for (const fragment of ["npm ci", "node test/ci/plasmon-playwright-isolation.mjs", "export PLASMON_PLAYWRIGHT_ENV_READY=1", "for ((offset = 0; offset < repetitions; offset += 1))", "persistent-state reset"]) {
  requireFragment(packetRunner, fragment, "prepared packet runner");
}
if ((packetRunner.split("npm ci").length - 1) !== 1) throw new Error("prepared packet must pay npm ci setup once");
forbidFragment(packetRunner, "--repeat-each", "prepared packet runner");

const fixture = mkdtempSync(join(tmpdir(), "plasmon-foundation-summary-"));
try {
  const results = join(fixture, "results");
  const diagnostics = join(fixture, "diagnostics");
  const changed = join(fixture, "changed.txt");
  const json = join(fixture, "summary.json");
  mkdirSync(results, { recursive: true });
  mkdirSync(diagnostics, { recursive: true });
  writeFileSync(changed, `${ordinaryA}\n`);
  for (let iteration = 1; iteration <= 10; iteration += 1) {
    const directory = join(results, `attempt-1-${iteration}`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "result.txt"), [
      "run_id=fixture", "run_number=1", "run_attempt=1", "mode=baseline",
      `iteration=${iteration}`, "iteration_count=10", `outcome=${iteration === 3 ? "failure" : "success"}`,
      "sha=foundation-sha", "target=all", "scope=all", "",
    ].join("\n"));
  }
  const rerun = join(results, "attempt-2-3");
  mkdirSync(rerun, { recursive: true });
  writeFileSync(join(rerun, "result.txt"), [
    "run_id=fixture", "run_number=1", "run_attempt=2", "mode=baseline", "iteration=3", "iteration_count=10",
    "outcome=success", "sha=foundation-sha", "target=all", "scope=all", "",
  ].join("\n"));
  const summary = spawnSync(process.execPath, ["test/ci/summarize-flake-probe.mjs", results, diagnostics, changed, "--json-file", json], { encoding: "utf8" });
  if (summary.status !== 0) throw new Error(`same-SHA rerun reconciliation failed: ${summary.stdout}\n${summary.stderr}`);
  const packet = JSON.parse(readFileSync(json, "utf8")).evidence_packets?.[0];
  const iteration3 = packet?.iteration_results?.find((entry) => entry.iteration === 3);
  if (iteration3?.run_attempt !== 2 || iteration3?.outcome !== "success" || packet?.superseded_results?.length !== 1) {
    throw new Error("evidence parser lost latest-attempt selection or superseded same-SHA provenance");
  }
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

console.log("Flake foundations verified independently of scheduling: exact targeting, fail-closed impact selection, profile truthfulness, exact-test quarantine semantics, prepared-environment isolation, retries=0/workers=1, and same-SHA evidence reconciliation are preserved");
