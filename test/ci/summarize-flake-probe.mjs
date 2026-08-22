import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const args = process.argv.slice(2);
const [resultsRoot, diagnosticsRoot, changedFilesPath] = args;
const jsonFileIndex = args.indexOf("--json-file");
const jsonFilePath = jsonFileIndex === -1 ? null : args[jsonFileIndex + 1] ?? null;

if (!resultsRoot || !diagnosticsRoot || !changedFilesPath || (jsonFileIndex !== -1 && !jsonFilePath)) {
  console.error(
    "usage: node test/ci/summarize-flake-probe.mjs <results-root> <diagnostics-root> <changed-files> [--json-file <path>]",
  );
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
        return separator === -1
          ? [line, ""]
          : [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function probeIteration(result, path, root) {
  if (result.iteration && result.attempt && result.iteration !== result.attempt) {
    throw new Error(
      `conflicting probe iteration identities in ${relative(root, path)}: iteration=${result.iteration}, legacy attempt=${result.attempt}`,
    );
  }
  const value = result.iteration ?? result.attempt;
  if (!/^(?:[1-9]|[1-4][0-9]|50)$/.test(value ?? "")) {
    throw new Error(
      `invalid or missing probe iteration identity in ${relative(root, path)}: ${value ?? ""}`,
    );
  }
  return Number(value);
}

function resultIterationCount(result, path, root) {
  if (!result.iteration_count) return null;
  if (!/^(?:10|50)$/.test(result.iteration_count)) {
    throw new Error(
      `invalid probe iteration_count in ${relative(root, path)}: ${result.iteration_count}`,
    );
  }
  return Number(result.iteration_count);
}

function resultMode(result, path, root) {
  const mode = result.mode || "baseline";
  if (!/^(?:baseline|manual|characterization)$/.test(mode)) {
    throw new Error(`invalid probe mode in ${relative(root, path)}: ${mode}`);
  }
  return mode;
}

function numericMetadata(value, label, path, root, { required = false } = {}) {
  if (!value) {
    if (required) throw new Error(`missing ${label} in ${relative(root, path)}`);
    return null;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`invalid ${label} in ${relative(root, path)}: ${value}`);
  }
  return Number(value);
}

function normalizeResult(path, root) {
  const result = parseResult(path);
  const iteration = probeIteration(result, path, root);
  const configuredCount = resultIterationCount(result, path, root);
  const historicalTenIteration = configuredCount === null;
  const iterationCount = historicalTenIteration ? 10 : configuredCount;
  const mode = resultMode(result, path, root);

  if (!result.sha || result.sha === "unknown") {
    throw new Error(`missing exact SHA in ${relative(root, path)}`);
  }
  if (!result.target || result.target === "unknown") {
    throw new Error(`missing target in ${relative(root, path)}`);
  }

  const scope = result.scope && result.scope !== "unknown" ? result.scope : result.target;
  if (!historicalTenIteration && (!result.scope || result.scope === "unknown")) {
    throw new Error(`missing scope in ${relative(root, path)}`);
  }

  const runNumber = numericMetadata(
    result.run_number,
    "workflow run_number",
    path,
    root,
    { required: !historicalTenIteration },
  );
  const runAttempt = numericMetadata(
    result.run_attempt,
    "workflow run_attempt",
    path,
    root,
    { required: !historicalTenIteration },
  );

  return {
    path,
    raw: result,
    iteration,
    iterationCount,
    mode,
    sha: result.sha,
    target: result.target,
    scope,
    runNumber,
    runAttempt: runAttempt ?? 0,
    outcome: result.outcome || "unknown",
    isLegacyAttempt: !result.iteration && Boolean(result.attempt),
    historicalTenIteration,
  };
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function cleanTitle(value) {
  return stripAnsi(value)
    .replace(/\s+\(\d+(?:\.\d+)?(?:ms|s)\)\s*$/, "")
    .replace(/\s+\[[\d.]+(?:ms|s)\]\s*$/, "")
    .replace(/\s+[─━═]{3,}\s*$/, "")
    .trim();
}

function canonicalGroupedBunFile(file) {
  if (file.startsWith("apps/plasmon/")) return file;
  if (file.startsWith("test/") || file.startsWith("src/")) {
    return `apps/plasmon/${file}`;
  }
  return file;
}

function extractFailures(output) {
  const found = [];
  let currentFile = null;
  for (const rawLine of output.split(/\r?\n/)) {
    const line = stripAnsi(rawLine).trimEnd();
    const groupedFileHeader = line.match(
      /^\s*::group::((?:apps\/plasmon\/|test\/|src\/)[^\s:]+\.(?:test|spec)\.[A-Za-z0-9]+):\s*$/,
    );
    if (groupedFileHeader) {
      currentFile = canonicalGroupedBunFile(groupedFileHeader[1]);
      continue;
    }
    if (/^\s*::endgroup::\s*$/.test(line)) {
      currentFile = null;
      continue;
    }
    const fileHeader = line.match(
      /^\s*((?:apps\/plasmon\/|test\/)[^\s:]+\.(?:test|spec)\.[A-Za-z0-9]+):\s*$/,
    );
    if (fileHeader) {
      currentFile = fileHeader[1];
      continue;
    }
    const playwrightRunFailure = line.match(
      /^\s*[✘×]\s+\d+\s+\[[^\]]+\]\s+›\s+((?:apps\/plasmon\/|test\/)[^\s:]+\.(?:test|spec)\.[A-Za-z0-9]+):\d+:\d+\s+›\s+(.+)$/u,
    );
    if (playwrightRunFailure) {
      found.push({ file: playwrightRunFailure[1], title: cleanTitle(playwrightRunFailure[2]) });
      continue;
    }
    const playwrightDetailFailure = line.match(
      /^\s*\d+\)\s+\[[^\]]+\]\s+›\s+((?:apps\/plasmon\/|test\/)[^\s:]+\.(?:test|spec)\.[A-Za-z0-9]+):\d+:\d+\s+›\s+(.+)$/,
    );
    if (playwrightDetailFailure) {
      found.push({ file: playwrightDetailFailure[1], title: cleanTitle(playwrightDetailFailure[2]) });
      continue;
    }
    const vitest = line.match(
      /^\s*FAIL\s+((?:apps\/plasmon\/|test\/)[^\s]+\.(?:test|spec)\.[A-Za-z0-9]+)\s*>\s*(.+)$/,
    );
    if (vitest) {
      found.push({ file: vitest[1], title: cleanTitle(vitest[2]) });
      continue;
    }
    const bun = line.match(/^\s*\(fail\)\s+(.+)$/);
    if (bun && currentFile) {
      found.push({ file: currentFile, title: cleanTitle(bun[1]) });
      continue;
    }
    const symbolFailure = line.match(/^\s*[✗×]\s+(.+)$/u);
    if (symbolFailure && currentFile) {
      found.push({ file: currentFile, title: cleanTitle(symbolFailure[1]) });
    }
  }
  const unique = new Map();
  for (const failure of found) {
    if (failure.file && failure.title) unique.set(`${failure.file}\0${failure.title}`, failure);
  }
  return [...unique.values()];
}

function markdownCode(value) {
  return `\`${String(value).replaceAll("`", "'")}\``;
}

function iterationsText(iterations) {
  return [...iterations].sort((a, b) => a - b).join(", ");
}

function summaryHeading(mode) {
  if (mode === "characterization") return "## Plasmon 50-iteration characterization probe";
  if (mode === "manual") return "## Plasmon manual flake probe";
  return "## Plasmon 10-iteration baseline flake probe";
}

function requireSingle(values, label) {
  if (values.size !== 1) throw new Error(`probe result artifacts disagree on ${label}`);
  return [...values][0];
}

function samePacketIdentity(a, b) {
  return a.iterationCount === b.iterationCount &&
    a.mode === b.mode &&
    a.sha === b.sha &&
    a.target === b.target &&
    a.scope === b.scope &&
    a.runNumber === b.runNumber;
}

function selectLatestIterationResults(candidates) {
  const selected = new Map();
  const superseded = [];
  for (const candidate of candidates) {
    const previous = selected.get(candidate.iteration);
    if (!previous) {
      selected.set(candidate.iteration, candidate);
      continue;
    }
    if (candidate.runAttempt === previous.runAttempt) {
      throw new Error(
        `duplicate probe iteration ${candidate.iteration} for run_attempt ${candidate.runAttempt || "historical"}`,
      );
    }
    if (candidate.runAttempt > previous.runAttempt) {
      superseded.push(previous);
      selected.set(candidate.iteration, candidate);
    } else {
      superseded.push(candidate);
    }
  }
  return {
    selected: [...selected.values()].sort((a, b) => a.iteration - b.iteration),
    superseded: superseded.sort((a, b) => a.iteration - b.iteration || a.runAttempt - b.runAttempt),
  };
}

// run_attempt provenance is retained per selected probe iteration so a partial
// workflow rerun can combine fresh slots without destroying same-SHA history.
function attemptProvenance(results) {
  const byAttempt = new Map();
  for (const result of results) {
    const key = result.runAttempt;
    let iterations = byAttempt.get(key);
    if (!iterations) byAttempt.set(key, (iterations = []));
    iterations.push(result.iteration);
  }
  return [...byAttempt.entries()]
    .sort(([a], [b]) => a - b)
    .map(([runAttempt, iterations]) => ({
      run_attempt: runAttempt || null,
      iterations: iterations.sort((a, b) => a - b),
    }));
}

try {
  const candidateFiles = walkFiles(resultsRoot, "result.txt");
  const candidates = candidateFiles.map((path) => normalizeResult(path, resultsRoot));
  if (candidates.length === 0) throw new Error("no probe result artifacts found");

  const first = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (!samePacketIdentity(first, candidate)) {
      throw new Error("probe result artifacts disagree on evidence-packet identity");
    }
  }

  const iterationCounts = new Set(candidates.map((result) => result.iterationCount));
  const modes = new Set(candidates.map((result) => result.mode));
  const shas = new Set(candidates.map((result) => result.sha));
  const targets = new Set(candidates.map((result) => result.target));
  const scopes = new Set(candidates.map((result) => result.scope));
  const runNumbers = new Set(candidates.map((result) => result.runNumber).filter((value) => value !== null));

  const expectedCount = requireSingle(iterationCounts, "iteration_count");
  const mode = requireSingle(modes, "probe mode");
  const sha = requireSingle(shas, "exact SHA");
  const target = requireSingle(targets, "target");
  const scope = requireSingle(scopes, "scope");
  if (runNumbers.size > 1) throw new Error("probe result artifacts disagree on workflow run_number");
  const runNumber = [...runNumbers][0] ?? null;

  if (mode === "characterization" && expectedCount !== 50) {
    throw new Error(`characterization mode requires 50 probe iterations; saw ${expectedCount}`);
  }
  if (mode === "baseline" && expectedCount !== 10) {
    throw new Error(`baseline mode requires 10 probe iterations; saw ${expectedCount}`);
  }

  const { selected, superseded } = selectLatestIterationResults(candidates);
  if (selected.length !== expectedCount) {
    throw new Error(
      `expected ${expectedCount} unique fresh probe iteration results after run-attempt reconciliation; saw ${selected.length}`,
    );
  }
  for (let iteration = 1; iteration <= expectedCount; iteration += 1) {
    if (!selected.some((result) => result.iteration === iteration)) {
      throw new Error(`missing probe iteration ${iteration}/${expectedCount}`);
    }
  }

  const failedResults = selected.filter((result) => result.outcome !== "success");
  const failedIterations = failedResults.map((result) => result.iteration);
  const passed = selected.length - failedResults.length;
  const selectedFailureKeys = new Set(
    failedResults.map((result) => `${result.iteration}:${result.runAttempt}`),
  );
  const legacyResults = selected.filter((result) => result.isLegacyAttempt).length;
  const provenance = attemptProvenance(selected);
  const supersededFailures = superseded.filter((result) => result.outcome !== "success");

  const changedFiles = new Set(
    existsSync(changedFilesPath)
      ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
      : [],
  );
  const failuresByFile = new Map();
  const unparsedIterations = [];
  for (const resultPath of walkFiles(diagnosticsRoot, "result.txt")) {
    const result = normalizeResult(resultPath, diagnosticsRoot);
    if (!selectedFailureKeys.has(`${result.iteration}:${result.runAttempt}`)) continue;
    const diagnosticDirectory = dirname(resultPath);
    const outputPath = join(diagnosticDirectory, "probe-output.log");
    const extracted = existsSync(outputPath)
      ? extractFailures(readFileSync(outputPath, "utf8"))
      : [];
    if (extracted.length === 0) {
      unparsedIterations.push({
        iteration: result.iteration,
        runAttempt: result.runAttempt,
        artifact: basename(diagnosticDirectory),
      });
      continue;
    }
    for (const failure of extracted) {
      let tests = failuresByFile.get(failure.file);
      if (!tests) failuresByFile.set(failure.file, (tests = new Map()));
      let failureIterations = tests.get(failure.title);
      if (!failureIterations) tests.set(failure.title, (failureIterations = new Set()));
      failureIterations.add(result.iteration);
    }
  }

  const failureOccurrences = [...failuresByFile.values()].reduce(
    (fileTotal, tests) => fileTotal + [...tests.values()].reduce(
      (testTotal, failureIterations) => testTotal + failureIterations.size,
      0,
    ),
    0,
  );
  const uniqueFailingTests = [...failuresByFile.values()].reduce(
    (total, tests) => total + tests.size,
    0,
  );
  const failedList = failedIterations.length === 0
    ? "none"
    : failedIterations.sort((a, b) => a - b).join(", ");

  console.log(summaryHeading(mode));
  console.log();
  console.log(`- Probe mode: ${markdownCode(mode)}`);
  console.log(`- Exact SHA: ${markdownCode(sha)}`);
  console.log(`- Target: ${markdownCode(target)}`);
  console.log(`- Scope: ${markdownCode(scope)}`);
  console.log(`- Configured probe iterations: ${expectedCount}`);
  if (runNumber !== null) console.log(`- Workflow \`run_number\`: ${markdownCode(runNumber)}`);
  if (provenance.length === 1 && provenance[0].run_attempt !== null) {
    console.log(`- Workflow \`run_attempt\`: ${markdownCode(provenance[0].run_attempt)}`);
  } else if (provenance.length > 1) {
    console.log("- Workflow `run_attempt` provenance:");
    for (const entry of provenance) {
      console.log(
        `  - ${markdownCode(entry.run_attempt ?? "historical")}: probe iteration(s) ${entry.iterations.join(", ")}`,
      );
    }
  }
  console.log(`- Fresh probe iterations reported: ${selected.length}/${expectedCount}`);
  console.log(`- Iteration-1 passes: ${passed}/${expectedCount}`);
  console.log(`- Failed probe iterations: ${failedList}`);
  console.log(`- Superseded same-run attempt results retained: ${superseded.length}`);
  if (supersededFailures.length > 0) {
    console.log(`- Superseded same-SHA failures retained as provenance: ${supersededFailures.length}`);
  }
  if (legacyResults > 0) console.log(`- Legacy result files parsed: ${legacyResults}`);
  console.log(`- Failure occurrences parsed: ${failureOccurrences}`);
  console.log(`- Unique failing tests parsed: ${uniqueFailingTests}`);

  if (failuresByFile.size > 0) {
    console.log();
    console.log("### Failure summary");
    console.log();
    for (const [file, tests] of [...failuresByFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const fileOccurrences = [...tests.values()].reduce(
        (total, failureIterations) => total + failureIterations.size,
        0,
      );
      const relation = process.env.GITHUB_EVENT_NAME === "pull_request"
        ? changedFiles.has(file) ? "MODIFIED IN PR" : "UNCHANGED IN PR"
        : "PR RELATION N/A";
      console.log(`**(${fileOccurrences} failure occurrence(s)) ${markdownCode(file)} — ${relation}**`);
      const sortedTests = [...tests.entries()].sort(([a], [b]) => a.localeCompare(b));
      sortedTests.forEach(([title, failureIterations], index) => {
        const branch = index === sortedTests.length - 1 ? "└─" : "├─";
        console.log(
          `  ${branch} ${markdownCode(title)} — ${failureIterations.size} occurrence(s), probe iteration(s) ${iterationsText(failureIterations)}`,
        );
      });
      console.log();
    }
  }

  if (unparsedIterations.length > 0) {
    console.log("### Failed probe iterations without a parsed test identity");
    console.log();
    for (const { iteration, runAttempt, artifact } of unparsedIterations.sort((a, b) => a.iteration - b.iteration)) {
      console.log(
        `- Probe iteration ${iteration} from run_attempt ${runAttempt || "historical"}: inspect diagnostic artifact ${markdownCode(artifact)} and ${markdownCode("probe-output.log")}.`,
      );
    }
    console.log();
  }

  const packet = {
    sha,
    mode,
    scope,
    target,
    iteration_count: expectedCount,
    run_number: runNumber,
    run_attempts: provenance,
    iteration_results: selected.map((result) => ({
      iteration: result.iteration,
      run_attempt: result.runAttempt || null,
      outcome: result.outcome,
    })),
    superseded_results: superseded.map((result) => ({
      iteration: result.iteration,
      run_attempt: result.runAttempt || null,
      outcome: result.outcome,
    })),
    passed,
    failed_iterations: failedIterations.sort((a, b) => a - b),
    status: passed === expectedCount ? "stable-observed" : "failure-observed",
  };

  if (jsonFilePath) {
    mkdirSync(dirname(jsonFilePath), { recursive: true });
    writeFileSync(
      jsonFilePath,
      `${JSON.stringify({ schema: "plasmon-flake-summary-v1", evidence_packets: [packet] }, null, 2)}\n`,
    );
  }

  if (passed === expectedCount) {
    if (expectedCount === 50) {
      console.log(
        "**STABILITY EVIDENCE: 50/50 fresh probe iterations passed for this exact SHA and scope. This is evidence, not proof that the target cannot flake.**",
      );
    } else {
      console.log(`**STABILITY OBSERVED: ${expectedCount}/${expectedCount} fresh probe iterations passed.**`);
    }
  } else {
    console.log(
      `**FLAKE/FAILURE OBSERVED: only ${passed}/${expectedCount} fresh probe iterations passed (${selected.length}/${expectedCount} reported).**`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.log("## Plasmon flake probe");
  console.log();
  console.log(`**SUMMARY INTEGRITY FAILURE:** ${String(error?.message ?? error)}`);
  process.exitCode = 1;
}