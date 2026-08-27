import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectCharacterization } from "./select-plasmon-flake-characterization.mjs";

const workflowPath = ".github/workflows/plasmon-flake-probe.yml";
const workflowReadmePath = ".github/workflows/README.md";
const probeDocPath = ".github/workflows/PLASMON_FLAKE_PROBE.md";
const labelWorkflowPath = ".github/workflows/plasmon-flake-probe-label.yml";
const runnerPath = "test/ci/run-plasmon-flake-probe.sh";
const specialistRunnerPath = "test/ci/run-plasmon-specialist.mjs";
const selectorPath = "test/ci/select-plasmon-flake-characterization.mjs";
const summarizerPath = "test/ci/summarize-flake-probe.mjs";
const packagePath = "package.json";

const workflow = readFileSync(workflowPath, "utf8");
const workflowReadme = readFileSync(workflowReadmePath, "utf8");
const probeDoc = readFileSync(probeDocPath, "utf8");
const labelWorkflow = readFileSync(labelWorkflowPath, "utf8");
const runner = readFileSync(runnerPath, "utf8");
const specialistRunner = readFileSync(specialistRunnerPath, "utf8");
const selector = readFileSync(selectorPath, "utf8");
const summarizer = readFileSync(summarizerPath, "utf8");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

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

function executableShellSource(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");
}

const executableRunner = executableShellSource(runner);

for (const fragment of [
  "name: Plasmon Flake Probe",
  "types: [opened, synchronize, reopened]",
  "workflow_dispatch:",
  "iterations:",
  "default: '10'",
  "- '10'",
  "- '50'",
  "target:",
  "- exact",
  "test_file:",
  "test_grep:",
  "cancel-in-progress: true",
  "name: Determine flake probe applicability and configuration",
  "git diff --name-only \"$BASE_SHA\" \"$HEAD_SHA\"",
  "test/e2e/*",
  "test/ci/*",
  "playwright.config.ts",
  "characterization_applicable: ${{ steps.characterize.outputs.applicable }}",
  "characterization_files_json: ${{ steps.characterize.outputs.files_json }}",
  "probe_matrix: ${{ steps.matrix.outputs.matrix }}",
  "primary_mode=baseline",
  "iteration_count=10",
  "target=all",
  "10|50",
  "name: Select automatic 50-iteration characterization scope",
  "node test/ci/select-plasmon-flake-characterization.mjs",
  "name: Build shared probe matrix",
  "mode: 'characterization'",
  "automatic_characterization: true",
  "if: needs.applicability.outputs.applicable == 'true' || needs.applicability.outputs.characterization_applicable == 'true'",
  "continue-on-error: ${{ matrix.mode == 'characterization' }}",
  "max-parallel: 10",
  "PROBE_MODE: ${{ matrix.mode }}",
  "PROBE_TEST_FILES_JSON: ${{ matrix.automatic_characterization && needs.applicability.outputs.characterization_files_json || '[]' }}",
  "ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || inputs.ref || github.sha }}",
  "run_number=${{ github.run_number }}",
  "run_attempt=${{ github.run_attempt }}",
  "iteration=${{ matrix.iteration }}",
  "name: Flake probe summary",
  "name: Flake characterization summary",
  "--json-file flake-probe-summary/summary.json",
  "--json-file flake-characterization-summary/summary.json",
]) {
  requireFragment(workflow, fragment, "flake-probe workflow");
}

for (const fragment of [
  "    paths:",
  "matrix.attempt",
  "--repeat-each",
  "paths-ignore",
  "pull_request_target",
  "overwrite: true",
]) {
  forbidFragment(workflow, fragment, "flake-probe workflow");
}

for (const fragment of [
  "name: Plasmon Flake Probe Label Trigger",
  "ci:flake-probe",
  "createWorkflowDispatch",
  "workflow_id: 'plasmon-flake-probe.yml'",
]) {
  requireFragment(labelWorkflow, fragment, "flake-probe label bridge");
}

for (const fragment of [
  "npm ci",
  "npm run plasmon:local:prepare",
  "npm run plasmon:local:serve > /tmp/plasmon-pocketic.log 2>&1 &",
  "npm run plasmon:local:status",
  "npm run plasmon:local:reinstall",
  "--workers=1",
  "--retries=0",
  "--grep-invert @r2-quarantine",
  "npm run test:e2e:plasmon:specialist -- --retries=0",
  "exact)",
  "exact-set)",
  "test/e2e/*.spec.*|test/e2e/*.test.*",
  "PROBE_TEST_FILES_JSON",
  "exact-set requires a non-empty JSON array",
  "validate_exact_file \"$candidate\"",
  "run_one \"${exact_files[@]}\"",
  "run_one \"$test_file\" --grep \"$test_grep\"",
  "run_one \"$test_file\"",
]) {
  requireFragment(executableRunner, fragment, "flake-probe executable runner");
}
for (const fragment of [
  "plasmon:demo:prepare",
  "plasmon:demo:serve",
  "plasmon:demo:status",
  "plasmon:demo:reinstall",
  "--repeat-each",
]) {
  forbidFragment(executableRunner, fragment, "targeted flake-probe runner");
}

const specialistScript = packageJson.scripts?.["test:e2e:plasmon:specialist"];
if (typeof specialistScript !== "string") {
  throw new Error("package.json lost test:e2e:plasmon:specialist");
}
requireFragment(specialistScript, "test/ci/run-plasmon-specialist.mjs", "Specialist npm script");
for (const fragment of [
  "discoverPlasmonTests",
  "lane === 'specialist'",
  "--workers=1",
  "--grep-invert",
  "@r2-quarantine",
]) {
  requireFragment(specialistRunner, fragment, "automatic Specialist runner");
}

for (const fragment of [
  "repositoryPathReferences",
  "dependsOn",
  "unresolvedSharedInputs",
  "isQuarantinedAcceptance",
  "excluded_quarantined_tests",
  "unresolved_inputs",
  "target: \"exact-set\"",
  "iteration_count: 50",
  "files_json",
  "no-deterministic-playwright-target",
  "only-quarantined-playwright-changes",
  "no-relevant-playwright-change",
]) {
  requireFragment(selector, fragment, "automatic characterization selector");
}
for (const fragment of [
  "shared-support-fallback",
  "specialist-fallback",
  "lane === \"specialist\"",
]) {
  forbidFragment(selector, fragment, "automatic characterization selector");
}

for (const fragment of [
  "probeIteration",
  "result.iteration",
  "result.attempt",
  "resultIterationCount",
  "resultMode",
  "baseline|manual|characterization",
  "selectLatestIterationResults",
  "run_attempt provenance",
  "Superseded same-run attempt results retained",
  "plasmon-flake-summary-v1",
  "evidence_packets",
  "iteration_results",
  "superseded_results",
  "run_attempts",
  "Plasmon 10-iteration baseline flake probe",
  "Plasmon 50-iteration characterization probe",
  "STABILITY EVIDENCE: 50/50",
  "This is evidence, not proof that the target cannot flake.",
  "FLAKE/FAILURE OBSERVED:",
  "process.exitCode = 1",
]) {
  requireFragment(summarizer, fragment, "flake-probe aggregate summarizer");
}

for (const fragment of [
  "Fresh attempts reported",
  "First-attempt passes",
  "Failed attempts:",
  "attempt(s)",
  "fresh attempts passed",
]) {
  forbidFragment(summarizer, fragment, "flake-probe summary terminology");
}

for (const fragment of [
  "**workflow run** / `run_number`",
  "**workflow run attempt** / `run_attempt`",
  "**probe iteration**",
  "**test retry**",
  "iteration=<n>",
  "legacy alias",
]) {
  requireFragment(workflowReadme, fragment, "flake-probe terminology documentation");
}
for (const fragment of [
  "10-iteration baseline",
  "50-iteration characterization",
  "opened`, `reopened`, and `synchronize`",
  "Quarantine is absolute",
  "exact changed files",
  "does not broaden",
  "Flake characterization summary",
  "not proof that the target cannot flake",
  "#448",
]) {
  requireFragment(probeDoc, fragment, "flake-probe characterization documentation");
}

const retryZeroCount = executableRunner.split("--retries=0").length - 1;
if (retryZeroCount < 2) {
  throw new Error("flake-probe runner must disable test retries for full and targeted probes");
}
const workerOneCount =
  executableRunner.split("--workers=1").length - 1 +
  specialistRunner.split("--workers=1").length - 1;
if (workerOneCount < 2 || !specialistRunner.includes("--workers=1")) {
  throw new Error("flake-probe runner must serialize both targeted and Specialist probes");
}

function assertNoQuarantinedFiles(selection, label) {
  for (const file of selection.files) {
    if (readFileSync(file, "utf8").includes("@r2-quarantine")) {
      throw new Error(`${label} selected quarantined acceptance: ${file}`);
    }
  }
}

async function verifyCharacterizationSelection() {
  const first = "test/e2e/plasmon-start-inventory-428.spec.ts";
  const second = "test/e2e/plasmon-neutron-icon.spec.ts";
  const profileSpecific = "test/e2e/plasmon-demo-native-app-chrome-112.spec.ts";

  const oneChanged = await selectCharacterization({ changedFiles: [first] });
  if (!oneChanged.applicable || oneChanged.target !== "exact-set") {
    throw new Error("changed Playwright spec must select exact-set characterization");
  }
  if (oneChanged.files.length !== 1 || oneChanged.files[0] !== first) {
    throw new Error("single changed Playwright spec must remain a one-file characterization target");
  }
  assertNoQuarantinedFiles(oneChanged, "single changed spec");

  const twoChanged = await selectCharacterization({ changedFiles: [second, first] });
  if (!twoChanged.applicable || twoChanged.files.length !== 2) {
    throw new Error("two changed Playwright specs must select exactly those two files");
  }
  if (!twoChanged.files.includes(first) || !twoChanged.files.includes(second)) {
    throw new Error("multiple changed Playwright specs lost an exact changed-file target");
  }
  assertNoQuarantinedFiles(twoChanged, "multiple changed specs");

  const mixedProfiles = await selectCharacterization({
    changedFiles: [profileSpecific, first],
  });
  if (
    !mixedProfiles.applicable ||
    mixedProfiles.files.length !== 1 ||
    mixedProfiles.files[0] !== first ||
    !mixedProfiles.deferred_profile_tests.includes(profileSpecific)
  ) {
    throw new Error("mixed profile changes must characterize ordinary tests locally and defer profile-specific tests");
  }
  assertNoQuarantinedFiles(mixedProfiles, "mixed profile selection");

  const quarantineFixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-quarantine-selection-"));
  const quarantinedPath = "test/e2e/plasmon-quarantined-fixture.spec.ts";
  try {
    mkdirSync(join(quarantineFixtureRoot, "test/e2e"), { recursive: true });
    writeFileSync(
      join(quarantineFixtureRoot, quarantinedPath),
      [
        'import { test } from "@playwright/test";',
        "",
        'test("synthetic quarantine fixture", { tag: ["@r2-quarantine"] }, async () => {});',
        "",
      ].join("\n"),
    );
    const quarantined = await selectCharacterization({
      changedFiles: [quarantinedPath],
      root: quarantineFixtureRoot,
    });
    if (quarantined.applicable || quarantined.reason !== "only-quarantined-playwright-changes") {
      throw new Error("quarantined Playwright acceptance must not create an automatic 50-iteration workload");
    }
    if (!quarantined.excluded_quarantined_tests.includes(quarantinedPath)) {
      throw new Error("quarantined changed acceptance must be reported as explicitly excluded");
    }
  } finally {
    rmSync(quarantineFixtureRoot, { recursive: true, force: true });
  }

  const helper = await selectCharacterization({
    changedFiles: ["test/e2e/plasmon-browser-health.ts"],
  });
  if (!helper.applicable || helper.files.length === 0) {
    throw new Error("modified helper with deterministic Plasmon consumers must select impacted tests");
  }
  assertNoQuarantinedFiles(helper, "helper impact");

  const unresolvedFixture = await selectCharacterization({
    changedFiles: ["test/e2e/permission-dialog.fixture.tsx"],
  });
  if (unresolvedFixture.applicable || unresolvedFixture.reason !== "no-deterministic-playwright-target") {
    throw new Error("unresolved support must not broaden characterization to Specialist inventory");
  }
  if (!unresolvedFixture.unresolved_inputs.includes("test/e2e/permission-dialog.fixture.tsx")) {
    throw new Error("unresolved fixture must remain visible in selector diagnostics without broadening");
  }

  const configOnly = await selectCharacterization({ changedFiles: ["playwright.config.ts"] });
  if (configOnly.applicable || configOnly.reason !== "no-deterministic-playwright-target") {
    throw new Error("shared Playwright configuration must not create a 50x whole-Specialist probe");
  }

  const combined = await selectCharacterization({
    changedFiles: ["playwright.config.ts", first],
  });
  if (!combined.applicable || combined.files.length !== 1 || combined.files[0] !== first) {
    throw new Error("uncertain support plus a changed spec must characterize only the exact changed spec");
  }
  if (!combined.unresolved_inputs.includes("playwright.config.ts")) {
    throw new Error("combined selection must retain unresolved support as diagnostics without broadening");
  }

  const unrelated = await selectCharacterization({
    changedFiles: ["test/e2e/contacts-wallet.spec.ts"],
  });
  if (unrelated.applicable) {
    throw new Error("explicitly non-Plasmon Playwright ownership must not receive Plasmon characterization");
  }

  const bunOnly = await selectCharacterization({
    changedFiles: ["test/e2e/plasmon-deployment-environment.test.ts"],
  });
  if (bunOnly.applicable) {
    throw new Error("Bun-only test/e2e *.test.* files must not be misclassified as Playwright tests");
  }
}

function writeResult(root, iteration, count, fields = {}) {
  const runAttempt = fields.runAttempt ?? 2;
  const directory = join(root, `attempt-${runAttempt}-iteration-${iteration}-${fields.slot ?? "primary"}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "result.txt"),
    [
      "run_id=fixture-run-id",
      `run_number=${fields.runNumber ?? 317}`,
      `run_attempt=${runAttempt}`,
      `mode=${fields.mode ?? (count === 50 ? "characterization" : "baseline")}`,
      `iteration=${iteration}`,
      `iteration_count=${count}`,
      `outcome=${fields.outcome ?? "success"}`,
      `sha=${fields.sha ?? "fixture-sha"}`,
      `target=${fields.target ?? (count === 50 ? "exact-set" : "all")}`,
      `scope=${fields.scope ?? (count === 50 ? "characterization:targeted:1-files:fixture" : "all")}`,
      "test_file=",
      "test_grep=",
      `test_files_json=${count === 50 ? '["test/e2e/changed.spec.ts"]' : "[]"}`,
      "",
    ].join("\n"),
  );
}

function runSummary(resultsRoot, diagnosticsRoot, changedFilesPath, jsonFilePath) {
  return spawnSync(
    process.execPath,
    [summarizerPath, resultsRoot, diagnosticsRoot, changedFilesPath, "--json-file", jsonFilePath],
    { cwd: process.cwd(), env: { ...process.env, GITHUB_EVENT_NAME: "pull_request" }, encoding: "utf8" },
  );
}

function runSummaryFixture(count) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), `plasmon-flake-${count}-summary-`));
  try {
    const resultsRoot = join(fixtureRoot, "results");
    const diagnosticsRoot = join(fixtureRoot, "diagnostics");
    const changedFilesPath = join(fixtureRoot, "changed-files.txt");
    const jsonFilePath = join(fixtureRoot, "summary.json");
    mkdirSync(resultsRoot, { recursive: true });
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(changedFilesPath, "test/e2e/changed.spec.ts\n");
    for (let iteration = 1; iteration <= count; iteration += 1) {
      writeResult(resultsRoot, iteration, count);
    }
    const summaryRun = runSummary(resultsRoot, diagnosticsRoot, changedFilesPath, jsonFilePath);
    if (summaryRun.status !== 0) {
      throw new Error(`${count}-iteration summary fixture failed: ${summaryRun.stderr}\n${summaryRun.stdout}`);
    }
    const expected = count === 50
      ? [
          "## Plasmon 50-iteration characterization probe",
          "Probe mode: `characterization`",
          "Target: `exact-set`",
          "Configured probe iterations: 50",
          "Fresh probe iterations reported: 50/50",
          "STABILITY EVIDENCE: 50/50",
          "This is evidence, not proof that the target cannot flake.",
        ]
      : [
          "## Plasmon 10-iteration baseline flake probe",
          "Probe mode: `baseline`",
          "Target: `all`",
          "Configured probe iterations: 10",
          "Fresh probe iterations reported: 10/10",
          "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
        ];
    for (const fragment of ["Workflow `run_number`: `317`", "Workflow `run_attempt`: `2`", ...expected]) {
      requireFragment(summaryRun.stdout, fragment, `${count}-iteration summary fixture`);
    }
    const json = JSON.parse(readFileSync(jsonFilePath, "utf8"));
    if (json.schema !== "plasmon-flake-summary-v1" || json.evidence_packets?.length !== 1) {
      throw new Error("machine-readable flake summary must expose one independently classified packet");
    }
    if (json.evidence_packets[0].iteration_count !== count) {
      throw new Error("machine-readable evidence packet lost configured iteration count");
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function verifyPartialRerunReconciliation() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-partial-rerun-"));
  try {
    const resultsRoot = join(fixtureRoot, "results");
    const diagnosticsRoot = join(fixtureRoot, "diagnostics");
    const changedFilesPath = join(fixtureRoot, "changed-files.txt");
    const jsonFilePath = join(fixtureRoot, "summary.json");
    mkdirSync(resultsRoot, { recursive: true });
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(changedFilesPath, "test/e2e/changed.spec.ts\n");
    for (let iteration = 1; iteration <= 10; iteration += 1) {
      writeResult(resultsRoot, iteration, 10, {
        runAttempt: 1,
        outcome: iteration === 3 ? "failure" : "success",
      });
    }
    writeResult(resultsRoot, 3, 10, { runAttempt: 2, outcome: "success", slot: "rerun" });
    const summaryRun = runSummary(resultsRoot, diagnosticsRoot, changedFilesPath, jsonFilePath);
    if (summaryRun.status !== 0) {
      throw new Error(`partial rerun fixture must reconcile newest evidence: ${summaryRun.stderr}\n${summaryRun.stdout}`);
    }
    for (const fragment of [
      "Workflow `run_attempt` provenance:",
      "`1`: probe iteration(s) 1, 2, 4, 5, 6, 7, 8, 9, 10",
      "`2`: probe iteration(s) 3",
      "Superseded same-run attempt results retained: 1",
      "Superseded same-SHA failures retained as provenance: 1",
      "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
    ]) {
      requireFragment(summaryRun.stdout, fragment, "partial rerun summary fixture");
    }
    const json = JSON.parse(readFileSync(jsonFilePath, "utf8"));
    const packet = json.evidence_packets[0];
    if (packet.run_attempts.length !== 2 || packet.superseded_results.length !== 1) {
      throw new Error("partial rerun packet must retain mixed-attempt provenance and superseded evidence");
    }
    const iteration3 = packet.iteration_results.find((entry) => entry.iteration === 3);
    if (iteration3?.run_attempt !== 2 || iteration3?.outcome !== "success") {
      throw new Error("partial rerun packet must select newest result for iteration 3");
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function verifyLegacyResultCompatibility() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-legacy-summary-"));
  try {
    const resultsRoot = join(fixtureRoot, "results");
    const diagnosticsRoot = join(fixtureRoot, "diagnostics");
    const changedFilesPath = join(fixtureRoot, "changed-files.txt");
    mkdirSync(resultsRoot, { recursive: true });
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(changedFilesPath, "");
    for (let legacySlot = 1; legacySlot <= 10; legacySlot += 1) {
      const directory = join(resultsRoot, `attempt-${legacySlot}`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "result.txt"), [
        "run_id=legacy-run-id",
        "run_attempt=1",
        `attempt=${legacySlot}`,
        "outcome=success",
        "sha=legacy-sha",
        "target=specialist",
        "",
      ].join("\n"));
    }
    const summaryRun = spawnSync(
      process.execPath,
      [summarizerPath, resultsRoot, diagnosticsRoot, changedFilesPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    if (summaryRun.status !== 0) {
      throw new Error(`legacy result fixture must remain readable: ${summaryRun.stderr}\n${summaryRun.stdout}`);
    }
    for (const fragment of [
      "## Plasmon 10-iteration baseline flake probe",
      "Probe mode: `baseline`",
      "Scope: `specialist`",
      "Configured probe iterations: 10",
      "Fresh probe iterations reported: 10/10",
      "Legacy result files parsed: 10",
      "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
    ]) {
      requireFragment(summaryRun.stdout, fragment, "legacy result compatibility fixture");
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function verifyPriorIterationResultCompatibility() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-prior-iteration-summary-"));
  try {
    const resultsRoot = join(fixtureRoot, "results");
    const diagnosticsRoot = join(fixtureRoot, "diagnostics");
    const changedFilesPath = join(fixtureRoot, "changed-files.txt");
    mkdirSync(resultsRoot, { recursive: true });
    mkdirSync(diagnosticsRoot, { recursive: true });
    writeFileSync(changedFilesPath, "");
    for (let iteration = 1; iteration <= 10; iteration += 1) {
      const directory = join(resultsRoot, `iteration-${iteration}`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "result.txt"), [
        "run_id=prior-iteration-run-id",
        "run_number=291",
        "run_attempt=2",
        `iteration=${iteration}`,
        "outcome=success",
        "sha=prior-iteration-sha",
        "target=all",
        "",
      ].join("\n"));
    }
    const summaryRun = spawnSync(
      process.execPath,
      [summarizerPath, resultsRoot, diagnosticsRoot, changedFilesPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    if (summaryRun.status !== 0) {
      throw new Error(`prior iteration result fixture must remain readable: ${summaryRun.stderr}\n${summaryRun.stdout}`);
    }
    for (const fragment of [
      "Workflow `run_number`: `291`",
      "Workflow `run_attempt`: `2`",
      "Target: `all`",
      "Scope: `all`",
      "Configured probe iterations: 10",
      "Fresh probe iterations reported: 10/10",
      "STABILITY OBSERVED: 10/10 fresh probe iterations passed.",
    ]) {
      requireFragment(summaryRun.stdout, fragment, "prior iteration result compatibility fixture");
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

await verifyCharacterizationSelection();
runSummaryFixture(10);
runSummaryFixture(50);
verifyPartialRerunReconciliation();
verifyLegacyResultCompatibility();
verifyPriorIterationResultCompatibility();

console.log(
  "Flake-probe configurable 10/50 count, exact/manual scope, exact changed-Playwright characterization, multiple changed-file targeting, deterministic helper impact, quarantine exclusion, unresolved-support non-broadening, characterization-only execution gate, diagnostic characterization conclusion, immutable run-attempt artifacts, partial-rerun reconciliation, machine-readable evidence packets, retry-zero, worker-one, fresh local fixture, and both historical ten-iteration compatibility contracts verified",
);
