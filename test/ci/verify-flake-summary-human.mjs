import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const wrapperPath = resolve("test/ci/summarize-plasmon-flake-evidence.mjs");
const probeDoc = readFileSync(".github/workflows/PLASMON_FLAKE_PROBE.md", "utf8");

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} lost required fragment: ${fragment}`);
}

function forbidFragment(source, fragment, label) {
  if (source.includes(fragment)) throw new Error(`${label} contains forbidden fragment: ${fragment}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}\n${result.stdout}`);
  }
  return result.stdout.trim();
}

function resultText({ iteration, count, mode, outcome = "failure", sha = "fixture-sha" }) {
  return [
    "run_id=summary-fixture",
    "run_number=570",
    "run_attempt=1",
    `mode=${mode}`,
    `iteration=${iteration}`,
    `iteration_count=${count}`,
    `outcome=${outcome}`,
    `sha=${sha}`,
    `target=${mode === "characterization" ? "exact-set" : "all"}`,
    `scope=${mode === "characterization" ? "characterization:fixture" : "all"}`,
    "test_file=",
    "test_grep=",
    "test_files_json=[]",
    "",
  ].join("\n");
}

function runSummary({ root, count, mode, output, changedFiles, env = {}, cwd = process.cwd(), sha = "fixture-sha" }) {
  const resultsRoot = join(root, "results");
  const diagnosticsRoot = join(root, "diagnostics");
  const changedFilesPath = join(root, "changed-files.txt");
  const jsonFilePath = join(root, "summary.json");
  mkdirSync(resultsRoot, { recursive: true });
  mkdirSync(diagnosticsRoot, { recursive: true });
  writeFileSync(changedFilesPath, `${changedFiles.join("\n")}\n`);

  for (let iteration = 1; iteration <= count; iteration += 1) {
    const resultDirectory = join(resultsRoot, `iteration-${iteration}`);
    mkdirSync(resultDirectory, { recursive: true });
    writeFileSync(join(resultDirectory, "result.txt"), resultText({ iteration, count, mode, sha }));
    // The real probe stores bounded failed output beside result.txt. The summary
    // must not depend on separately downloading the richer diagnostics artifact.
    writeFileSync(join(resultDirectory, "probe-output.log"), output);
  }

  const summaryRun = spawnSync(
    process.execPath,
    [wrapperPath, resultsRoot, diagnosticsRoot, changedFilesPath, "--json-file", jsonFilePath],
    {
      cwd,
      env: { ...process.env, ...env },
      encoding: "utf8",
    },
  );
  if (summaryRun.status !== 1) {
    throw new Error(`failing ${mode}/${count} fixture must remain red; status=${summaryRun.status}\n${summaryRun.stderr}\n${summaryRun.stdout}`);
  }
  return {
    stdout: summaryRun.stdout,
    packet: JSON.parse(readFileSync(jsonFilePath, "utf8")).evidence_packets?.[0],
  };
}

const fixtureRoot = mkdtempSync(join(tmpdir(), "plasmon-flake-human-summary-"));
try {
  const unknownRoot = join(fixtureRoot, "unknown");
  mkdirSync(unknownRoot, { recursive: true });
  const unknown = runSummary({
    root: unknownRoot,
    count: 1,
    mode: "merge-validation",
    changedFiles: ["src/native-apps/search/SearchService.ts"],
    env: { GITHUB_EVENT_NAME: "pull_request_review", GITHUB_EVENT_PATH: "" },
    output: [
      "  ✘  1 [chromium] › test/e2e/plasmon-search-geometry.spec.ts:99:1 › Search › preserves geometry",
      "",
    ].join("\n"),
  });
  for (const fragment of [
    "## Plasmon approval-stage flake validation",
    "### Failure summary",
    "**UNCHANGED IN PR** `test/e2e/plasmon-search-geometry.spec.ts:99:1`",
    "Test: `Search › preserves geometry`",
    "Relatedness: **UNKNOWN**",
    "UNKNOWN does not mean unrelated or flaky",
    "### Probe metadata",
    "Retry-free passes: 0/1",
  ]) requireFragment(unknown.stdout, fragment, "merge-validation human summary");
  if (unknown.packet?.failures?.[0]?.relatedness !== "UNKNOWN") {
    throw new Error("merge-validation machine summary lost UNKNOWN relatedness");
  }

  const directRepo = join(fixtureRoot, "direct-repo");
  mkdirSync(join(directRepo, "test/e2e"), { recursive: true });
  run("git", ["init", "-q"], { cwd: directRepo });
  run("git", ["config", "user.email", "fixture@example.com"], { cwd: directRepo });
  run("git", ["config", "user.name", "Fixture"], { cwd: directRepo });
  writeFileSync(
    join(directRepo, "test/e2e/direct.spec.ts"),
    "import { test } from '@playwright/test';\ntest('old title', async () => {});\n",
  );
  run("git", ["add", "."], { cwd: directRepo });
  run("git", ["commit", "-qm", "base"], { cwd: directRepo });
  const baseSha = run("git", ["rev-parse", "HEAD"], { cwd: directRepo });
  writeFileSync(
    join(directRepo, "test/e2e/direct.spec.ts"),
    "import { test } from '@playwright/test';\ntest('new title', async () => {});\n",
  );
  run("git", ["add", "."], { cwd: directRepo });
  run("git", ["commit", "-qm", "head"], { cwd: directRepo });
  const headSha = run("git", ["rev-parse", "HEAD"], { cwd: directRepo });
  const eventPath = join(directRepo, "event.json");
  writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: baseSha }, head: { sha: headSha } } }));
  const directRoot = join(directRepo, "fixture");
  mkdirSync(directRoot, { recursive: true });
  const direct = runSummary({
    root: directRoot,
    count: 1,
    mode: "merge-validation",
    changedFiles: ["test/e2e/direct.spec.ts"],
    cwd: directRepo,
    sha: headSha,
    env: { GITHUB_EVENT_NAME: "pull_request_review", GITHUB_EVENT_PATH: eventPath },
    output: "  ✘  1 [chromium] › test/e2e/direct.spec.ts:2:1 › new title\n",
  });
  for (const fragment of [
    "**CHANGED IN PR** `test/e2e/direct.spec.ts:2:1`",
    "Relatedness: **DIRECT**",
    "failing test location line 2 changed in this PR",
  ]) requireFragment(direct.stdout, fragment, "direct-related human summary");
  if (direct.packet?.failures?.[0]?.relatedness !== "DIRECT") {
    throw new Error("machine summary lost DIRECT relatedness");
  }

  const relatedRepo = join(fixtureRoot, "related-repo");
  mkdirSync(join(relatedRepo, "test/e2e/support"), { recursive: true });
  writeFileSync(join(relatedRepo, "test/e2e/support/helper.ts"), "export const helper = 1;\n");
  writeFileSync(join(relatedRepo, "test/e2e/related.spec.ts"), "import './support/helper';\n");
  const relatedRoot = join(relatedRepo, "fixture");
  mkdirSync(relatedRoot, { recursive: true });
  const related = runSummary({
    root: relatedRoot,
    count: 3,
    mode: "characterization",
    changedFiles: ["test/e2e/support/helper.ts"],
    cwd: relatedRepo,
    env: { GITHUB_EVENT_NAME: "pull_request_review", GITHUB_EVENT_PATH: "" },
    output: "  ✘  1 [chromium] › test/e2e/related.spec.ts:1:1 › support consumer\n",
  });
  for (const fragment of [
    "**UNCHANGED IN PR** `test/e2e/related.spec.ts:1:1`",
    "Relatedness: **RELATED**",
    "statically depends on changed E2E support test/e2e/support/helper.ts",
    "Occurrences: 3; probe iteration(s): 1, 2, 3",
  ]) requireFragment(related.stdout, fragment, "related characterization summary");

  const bunRoot = join(fixtureRoot, "bun");
  mkdirSync(bunRoot, { recursive: true });
  const canonicalFile = "apps/plasmon/test/documentationContract.test.ts";
  const failingTitle = "documentation boundaries and generated index stay current";
  const bun = runSummary({
    root: bunRoot,
    count: 10,
    mode: "baseline",
    changedFiles: [canonicalFile],
    env: { GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: "" },
    output: [
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
  });
  for (const fragment of [
    `**CHANGED IN PR** \`${canonicalFile}\``,
    "Relatedness: **STRONG**",
    `Test: \`${failingTitle}\``,
    "Occurrences: 10; probe iteration(s): 1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
  ]) requireFragment(bun.stdout, fragment, "grouped Bun human summary");
  forbidFragment(bun.stdout, "hostContract.test.ts —", "grouped Bun human summary");

  for (const fragment of [
    "All four modes use the same canonical human/machine summarizer",
    "CHANGED IN PR",
    "UNCHANGED IN PR",
    "`DIRECT`",
    "`STRONG`",
    "`RELATED`",
    "`UNKNOWN`",
    "no `UNRELATED` classification",
    "Iteration counts are secondary metadata",
  ]) requireFragment(probeDoc, fragment, "Flake Probe summary documentation");

  console.log(
    "Flake Summary verified: every mode uses one diagnostic summary contract with exact failure identity, CHANGED/UNCHANGED PR facts, DIRECT/STRONG/RELATED/UNKNOWN deterministic relatedness, retained result-output parsing, and iteration provenance",
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
