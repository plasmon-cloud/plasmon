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

const summarizerPath = "test/ci/summarize-flake-probe.mjs";
const fixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-human-summary-"));

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

function resultText(iteration) {
  return [
    "run_id=grouped-bun-fixture",
    "run_number=570",
    "run_attempt=1",
    "mode=baseline",
    `iteration=${iteration}`,
    "iteration_count=10",
    "outcome=failure",
    "sha=grouped-bun-fixture-sha",
    "target=all",
    "scope=all",
    "test_file=",
    "test_grep=",
    "test_files_json=[]",
    "",
  ].join("\n");
}

const failingTitle = "documentation boundaries and generated index stay current";
const canonicalFile = "apps/plasmon/test/documentationContract.test.ts";

try {
  const resultsRoot = join(fixtureRoot, "results");
  const diagnosticsRoot = join(fixtureRoot, "diagnostics");
  const changedFilesPath = join(fixtureRoot, "changed-files.txt");
  const jsonFilePath = join(fixtureRoot, "summary.json");
  mkdirSync(resultsRoot, { recursive: true });
  mkdirSync(diagnosticsRoot, { recursive: true });
  writeFileSync(
    changedFilesPath,
    ["apps/plasmon/test/README.md", canonicalFile, ""].join("\n"),
  );

  for (let iteration = 1; iteration <= 10; iteration += 1) {
    const resultDirectory = join(resultsRoot, `iteration-${iteration}`);
    const diagnosticDirectory = join(diagnosticsRoot, `iteration-${iteration}`);
    mkdirSync(resultDirectory, { recursive: true });
    mkdirSync(diagnosticDirectory, { recursive: true });
    const result = resultText(iteration);
    writeFileSync(join(resultDirectory, "result.txt"), result);
    writeFileSync(join(diagnosticDirectory, "result.txt"), result);
    writeFileSync(
      join(diagnosticDirectory, "probe-output.log"),
      [
        "::group::test/documentationContract.test.ts:",
        `(fail) ${failingTitle} [92.00ms]`,
        "::endgroup::",
        "",
        "::group::src/native-apps/shared/monaco/hostContract.test.ts:",
        "(pass) unrelated later test",
        "::endgroup::",
        "",
        "1 tests failed:",
        `(fail) ${failingTitle} [92.00ms]`,
        "",
      ].join("\n"),
    );
  }

  const summaryRun = spawnSync(
    process.execPath,
    [
      summarizerPath,
      resultsRoot,
      diagnosticsRoot,
      changedFilesPath,
      "--json-file",
      jsonFilePath,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, GITHUB_EVENT_NAME: "pull_request" },
      encoding: "utf8",
    },
  );

  if (summaryRun.status !== 1) {
    throw new Error(
      `failing grouped-Bun fixture must retain a failing summary conclusion; status=${summaryRun.status}\n${summaryRun.stderr}\n${summaryRun.stdout}`,
    );
  }

  for (const fragment of [
    "Failure occurrences parsed: 10",
    "Unique failing tests parsed: 1",
    `**(10 failure occurrence(s)) \`${canonicalFile}\` — MODIFIED IN PR**`,
    `\`${failingTitle}\` — 10 occurrence(s), probe iteration(s) 1, 2, 3, 4, 5, 6, 7, 8, 9, 10`,
    "FLAKE/FAILURE OBSERVED: only 0/10 fresh probe iterations passed (10/10 reported).",
  ]) {
    requireFragment(summaryRun.stdout, fragment, "grouped Bun human flake summary");
  }

  for (const fragment of [
    "Failed probe iterations without a parsed test identity",
    "apps/plasmon/src/native-apps/shared/monaco/hostContract.test.ts —",
  ]) {
    forbidFragment(summaryRun.stdout, fragment, "grouped Bun human flake summary");
  }

  const packet = JSON.parse(readFileSync(jsonFilePath, "utf8")).evidence_packets?.[0];
  if (
    packet?.status !== "failure-observed" ||
    packet?.passed !== 0 ||
    packet?.failed_iterations?.length !== 10
  ) {
    throw new Error("grouped Bun parser correction must not weaken machine-readable failure evidence");
  }

  console.log(
    "Grouped Bun Flake Summary verified: canonical file identity, 10-occurrence aggregation, exact iteration list, MODIFIED IN PR classification, no duplicate global-failure attribution, and failing evidence preserved",
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
