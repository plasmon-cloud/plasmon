import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const args = process.argv.slice(2);
const [resultsRoot, diagnosticsRoot, changedFilesPath] = args;
const jsonFileIndex = args.indexOf("--json-file");
const jsonFilePath = jsonFileIndex === -1 ? null : args[jsonFileIndex + 1] ?? null;

if (!resultsRoot || !diagnosticsRoot || !changedFilesPath || (jsonFileIndex !== -1 && !jsonFilePath)) {
  console.error("usage: node test/ci/summarize-staged-flake-probe.mjs <results-root> <diagnostics-root> <changed-files> [--json-file <path>]");
  process.exit(2);
}

function walkFiles(root, wantedName) {
  if (!existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (!wantedName || entry === wantedName) files.push(path);
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

function positiveInteger(value, label, path) {
  if (!/^[1-9][0-9]*$/.test(value ?? "")) throw new Error(`invalid ${label} in ${path}: ${value ?? ""}`);
  return Number(value);
}

function normalize(path) {
  const raw = parseResult(path);
  const iteration = positiveInteger(raw.iteration ?? raw.attempt, "iteration", path);
  const iterationCount = positiveInteger(raw.iteration_count, "iteration_count", path);
  const runAttempt = positiveInteger(raw.run_attempt ?? "1", "run_attempt", path);
  const runNumber = positiveInteger(raw.run_number ?? "1", "run_number", path);
  const mode = raw.mode || "baseline";
  if (!new Set(["merge-validation", "baseline", "manual", "characterization"]).has(mode)) {
    throw new Error(`invalid probe mode in ${path}: ${mode}`);
  }
  if (!raw.sha || raw.sha === "unknown") throw new Error(`missing exact SHA in ${path}`);
  if (!raw.target || raw.target === "unknown") throw new Error(`missing target in ${path}`);
  if (!raw.scope || raw.scope === "unknown") throw new Error(`missing scope in ${path}`);
  return {
    raw,
    path,
    iteration,
    iterationCount,
    runAttempt,
    runNumber,
    mode,
    sha: raw.sha,
    target: raw.target,
    scope: raw.scope,
    outcome: raw.outcome || "unknown",
  };
}

function requireSingle(results, key) {
  const values = new Set(results.map((result) => result[key]));
  if (values.size !== 1) throw new Error(`probe result artifacts disagree on ${key}`);
  return results[0][key];
}

function validateModeCount(mode, count) {
  if (mode === "merge-validation" && count !== 1) throw new Error(`merge-validation mode requires 1 probe iteration; saw ${count}`);
  if (mode === "baseline" && count !== 10) throw new Error(`post-merge baseline mode requires 10 probe iterations; saw ${count}`);
  if (mode === "characterization" && ![10, 50].includes(count)) {
    throw new Error(`characterization mode requires 10 or 50 probe iterations; saw ${count}`);
  }
  if (mode === "manual" && ![10, 50].includes(count)) throw new Error(`manual mode requires 10 or 50 probe iterations; saw ${count}`);
}

function selectLatest(results, count) {
  const selected = new Map();
  const superseded = [];
  for (const result of results) {
    if (result.iteration < 1 || result.iteration > count) {
      throw new Error(`probe iteration ${result.iteration} is outside configured count ${count}`);
    }
    const previous = selected.get(result.iteration);
    if (!previous) {
      selected.set(result.iteration, result);
      continue;
    }
    if (previous.runAttempt === result.runAttempt) {
      throw new Error(`duplicate probe iteration ${result.iteration} for run_attempt ${result.runAttempt}`);
    }
    if (result.runAttempt > previous.runAttempt) {
      superseded.push(previous);
      selected.set(result.iteration, result);
    } else {
      superseded.push(result);
    }
  }
  const ordered = [...selected.values()].sort((a, b) => a.iteration - b.iteration);
  if (ordered.length !== count) throw new Error(`expected ${count} unique fresh probe iteration results; saw ${ordered.length}`);
  for (let iteration = 1; iteration <= count; iteration += 1) {
    if (ordered[iteration - 1]?.iteration !== iteration) throw new Error(`missing probe iteration ${iteration}/${count}`);
  }
  return { selected: ordered, superseded };
}

function heading(mode, count) {
  if (mode === "merge-validation") return "## Plasmon merge-queue flake validation";
  if (mode === "characterization") return `## Plasmon ${count}-iteration characterization probe`;
  if (mode === "manual") return `## Plasmon manual ${count}-iteration flake probe`;
  return "## Plasmon 10-iteration post-merge baseline flake probe";
}

function code(value) {
  return `\`${String(value).replaceAll("`", "'")}\``;
}

try {
  const candidates = walkFiles(resultsRoot, "result.txt").map(normalize);
  if (candidates.length === 0) throw new Error("no probe result artifacts found");

  const iterationCount = requireSingle(candidates, "iterationCount");
  const mode = requireSingle(candidates, "mode");
  const sha = requireSingle(candidates, "sha");
  const target = requireSingle(candidates, "target");
  const scope = requireSingle(candidates, "scope");
  const runNumber = requireSingle(candidates, "runNumber");
  validateModeCount(mode, iterationCount);

  const { selected, superseded } = selectLatest(candidates, iterationCount);
  const failed = selected.filter((result) => result.outcome !== "success");
  const passed = selected.length - failed.length;
  const runAttempts = [...new Set(selected.map((result) => result.runAttempt))].sort((a, b) => a - b);
  const changedFiles = existsSync(changedFilesPath)
    ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
    : [];

  console.log(heading(mode, iterationCount));
  console.log();
  console.log(`- Probe mode: ${code(mode)}`);
  console.log(`- Exact SHA: ${code(sha)}`);
  console.log(`- Target: ${code(target)}`);
  console.log(`- Scope: ${code(scope)}`);
  console.log(`- Configured probe iterations: ${iterationCount}`);
  console.log(`- Fresh probe iterations reported: ${selected.length}/${iterationCount}`);
  console.log(`- Retry-free passes: ${passed}/${iterationCount}`);
  console.log(`- Failed probe iterations: ${failed.length ? failed.map((r) => r.iteration).join(", ") : "none"}`);
  console.log(`- Workflow run_number: ${runNumber}`);
  console.log(`- Workflow run_attempt(s): ${runAttempts.join(", ")}`);
  console.log(`- Changed files recorded for phase: ${changedFiles.length}`);
  console.log(`- Superseded same-run-attempt evidence retained: ${superseded.length}`);

  if (failed.length > 0) {
    const diagnosticFiles = walkFiles(diagnosticsRoot);
    console.log();
    console.log("### Failed iteration diagnostics");
    for (const result of failed) {
      const matching = diagnosticFiles.filter((path) => path.includes(`iteration-${result.iteration}`));
      console.log(`- Iteration ${result.iteration}: ${matching.length ? matching.map((p) => code(relative(diagnosticsRoot, p))).join(", ") : "inspect packet logs"}`);
    }
  }

  const packet = {
    sha,
    mode,
    scope,
    target,
    iteration_count: iterationCount,
    run_number: runNumber,
    run_attempts: runAttempts,
    iteration_results: selected.map((result) => ({
      iteration: result.iteration,
      run_attempt: result.runAttempt,
      outcome: result.outcome,
    })),
    superseded_results: superseded.map((result) => ({
      iteration: result.iteration,
      run_attempt: result.runAttempt,
      outcome: result.outcome,
    })),
    passed,
    failed_iterations: failed.map((result) => result.iteration),
    status: failed.length === 0 ? "stable-observed" : "failure-observed",
  };
  if (jsonFilePath) {
    mkdirSync(dirname(jsonFilePath), { recursive: true });
    writeFileSync(jsonFilePath, `${JSON.stringify({ schema: "plasmon-flake-summary-v1", evidence_packets: [packet] }, null, 2)}\n`);
  }

  if (failed.length === 0) {
    console.log();
    console.log(`**STABILITY OBSERVED: ${passed}/${iterationCount} fresh retry-free probe iterations passed for this exact SHA and scope.**`);
  } else {
    console.log();
    console.log(`**FLAKE/FAILURE OBSERVED: only ${passed}/${iterationCount} fresh retry-free probe iterations passed.**`);
    process.exitCode = 1;
  }
} catch (error) {
  console.log("## Plasmon staged flake probe");
  console.log();
  console.log(`**SUMMARY INTEGRITY FAILURE:** ${String(error?.message ?? error)}`);
  process.exitCode = 1;
}
