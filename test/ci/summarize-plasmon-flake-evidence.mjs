import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { assertSupportedProbeModeCount } from "./plasmon-flake-probe-policy.mjs";

const args = process.argv.slice(2);
const [resultsRoot, diagnosticsRoot, changedFilesPath] = args;
const jsonFileIndex = args.indexOf("--json-file");
const jsonFilePath = jsonFileIndex === -1 ? null : args[jsonFileIndex + 1];
if (!resultsRoot || !diagnosticsRoot || !changedFilesPath || (jsonFileIndex !== -1 && !jsonFilePath)) {
  console.error("usage: node test/ci/summarize-plasmon-flake-evidence.mjs <results-root> <diagnostics-root> <changed-files> [--json-file <path>]");
  process.exit(2);
}

function resultFiles(root) {
  const files = [];
  const visit = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (entry === "result.txt") files.push(path);
    }
  };
  visit(root);
  return files.sort();
}

function parseResult(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return separator === -1 ? [line, ""] : [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function positiveInteger(value, label) {
  if (!/^[1-9][0-9]*$/.test(value ?? "")) throw new Error(`invalid ${label}: ${value ?? ""}`);
  return Number(value);
}

function canUseMatureSummarizer(mode, count) {
  return (mode === "baseline" && count === 10) ||
    (mode === "characterization" && count === 50) ||
    mode === "manual";
}

function delegateToMatureSummarizer() {
  const result = spawnSync(process.execPath, ["test/ci/summarize-flake-probe.mjs", ...args], { encoding: "utf8", env: process.env });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
}

try {
  const files = resultFiles(resultsRoot);
  if (files.length === 0) throw new Error("no probe result artifacts found");
  const rawResults = files.map(parseResult);
  const first = rawResults[0];
  const mode = first.mode || "baseline";
  const count = positiveInteger(first.iteration_count, "iteration_count");
  assertSupportedProbeModeCount(mode, count);

  if (canUseMatureSummarizer(mode, count)) delegateToMatureSummarizer();

  const identity = ["mode", "iteration_count", "sha", "target", "scope", "run_number"];
  for (const result of rawResults) {
    for (const key of identity) if (result[key] !== first[key]) throw new Error(`probe result artifacts disagree on ${key}`);
  }

  const selected = new Map();
  const superseded = [];
  for (const raw of rawResults) {
    const iteration = positiveInteger(raw.iteration ?? raw.attempt, "iteration");
    const runAttempt = positiveInteger(raw.run_attempt ?? "1", "run_attempt");
    const normalized = { raw, iteration, runAttempt, outcome: raw.outcome || "unknown" };
    const previous = selected.get(iteration);
    if (!previous || runAttempt > previous.runAttempt) {
      if (previous) superseded.push(previous);
      selected.set(iteration, normalized);
    } else if (runAttempt === previous.runAttempt) {
      throw new Error(`duplicate probe iteration ${iteration} for run_attempt ${runAttempt}`);
    } else {
      superseded.push(normalized);
    }
  }

  const ordered = [...selected.values()].sort((a, b) => a.iteration - b.iteration);
  if (ordered.length !== count) throw new Error(`expected ${count} unique fresh probe iteration results; saw ${ordered.length}`);
  for (let iteration = 1; iteration <= count; iteration += 1) {
    if (ordered[iteration - 1]?.iteration !== iteration) throw new Error(`missing probe iteration ${iteration}/${count}`);
  }

  const failed = ordered.filter((result) => result.outcome !== "success");
  const passed = ordered.length - failed.length;
  const heading = mode === "merge-validation"
    ? "## Plasmon approval-stage flake validation"
    : mode === "baseline"
      ? `## Plasmon post-merge ${count}-observation baseline`
      : `## Plasmon ${count}-iteration characterization probe`;
  console.log(heading);
  console.log();
  console.log(`- Probe mode: \`${mode}\``);
  console.log(`- Exact SHA: \`${first.sha}\``);
  console.log(`- Target: \`${first.target}\``);
  console.log(`- Scope: \`${first.scope}\``);
  console.log(`- Configured probe iterations: ${count}`);
  console.log(`- Fresh probe iterations reported: ${ordered.length}/${count}`);
  console.log(`- Retry-free passes: ${passed}/${count}`);
  console.log(`- Failed probe iterations: ${failed.length ? failed.map((result) => result.iteration).join(", ") : "none"}`);
  console.log(`- Superseded same-SHA results retained: ${superseded.length}`);

  const packet = {
    sha: first.sha,
    mode,
    scope: first.scope,
    target: first.target,
    iteration_count: count,
    run_number: Number(first.run_number),
    iteration_results: ordered.map((result) => ({ iteration: result.iteration, run_attempt: result.runAttempt, outcome: result.outcome })),
    superseded_results: superseded.map((result) => ({ iteration: result.iteration, run_attempt: result.runAttempt, outcome: result.outcome })),
    passed,
    failed_iterations: failed.map((result) => result.iteration),
    status: failed.length === 0 ? "stable-observed" : "failure-observed",
  };
  if (jsonFilePath) {
    mkdirSync(dirname(jsonFilePath), { recursive: true });
    writeFileSync(jsonFilePath, `${JSON.stringify({ schema: "plasmon-flake-summary-v1", evidence_packets: [packet] }, null, 2)}\n`);
  }

  console.log();
  if (failed.length === 0) console.log(`**STABILITY OBSERVED: ${passed}/${count} fresh retry-free probe iterations passed.**`);
  else {
    console.log(`**FLAKE/FAILURE OBSERVED: only ${passed}/${count} fresh retry-free probe iterations passed.**`);
    process.exitCode = 1;
  }
} catch (error) {
  console.log("## Plasmon flake probe");
  console.log();
  console.log(`**SUMMARY INTEGRITY FAILURE:** ${String(error?.message ?? error)}`);
  process.exitCode = 1;
}
