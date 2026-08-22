import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const [resultsRoot, diagnosticsRoot, changedFilesPath] = process.argv.slice(2);

if (!resultsRoot || !diagnosticsRoot || !changedFilesPath) {
  console.error(
    "usage: node test/ci/summarize-flake-probe.mjs <results-root> <diagnostics-root> <changed-files>",
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

function extractFailures(output) {
  const found = [];
  let currentFile = null;
  for (const rawLine of output.split(/\r?\n/)) {
    const line = stripAnsi(rawLine).trimEnd();
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

try {
  const resultFiles = walkFiles(resultsRoot, "result.txt");
  const results = resultFiles.map((path) => ({ path, ...parseResult(path) }));
  const iterations = new Set();
  const iterationCounts = new Set();
  const shas = new Set();
  const targets = new Set();
  const scopes = new Set();
  const runNumbers = new Set();
  const runAttempts = new Set();
  const failedIterations = [];
  let legacyResults = 0;
  let passed = 0;

  for (const result of results) {
    const iteration = probeIteration(result, result.path, resultsRoot);
    const iterationCount = resultIterationCount(result, result.path, resultsRoot);
    const isLegacy = !result.iteration && Boolean(result.attempt);
    if (!result.sha || result.sha === "unknown") {
      throw new Error(`missing exact SHA in ${relative(resultsRoot, result.path)}`);
    }
    if (!result.target || result.target === "unknown") {
      throw new Error(`missing target in ${relative(resultsRoot, result.path)}`);
    }
    if (!isLegacy) {
      if (iterationCount === null) {
        throw new Error(`missing iteration_count in ${relative(resultsRoot, result.path)}`);
      }
      if (!result.scope || result.scope === "unknown") {
        throw new Error(`missing scope in ${relative(resultsRoot, result.path)}`);
      }
      if (!/^\d+$/.test(result.run_number ?? "")) {
        throw new Error(`missing workflow run_number in ${relative(resultsRoot, result.path)}`);
      }
      if (!/^\d+$/.test(result.run_attempt ?? "")) {
        throw new Error(`missing workflow run_attempt in ${relative(resultsRoot, result.path)}`);
      }
      iterationCounts.add(iterationCount);
      scopes.add(result.scope);
      runNumbers.add(result.run_number);
      runAttempts.add(result.run_attempt);
    } else {
      legacyResults += 1;
      iterationCounts.add(10);
      scopes.add(result.target);
    }
    iterations.add(iteration);
    shas.add(result.sha);
    targets.add(result.target);
    if (result.outcome === "success") passed += 1;
    else failedIterations.push(iteration);
  }

  if (iterationCounts.size !== 1) {
    throw new Error("probe result artifacts disagree on iteration_count");
  }
  const expectedCount = [...iterationCounts][0];
  if (results.length !== expectedCount || iterations.size !== expectedCount) {
    throw new Error(
      `expected ${expectedCount} unique fresh probe iteration results; saw ${results.length} files and ${iterations.size} unique probe iterations`,
    );
  }
  for (let iteration = 1; iteration <= expectedCount; iteration += 1) {
    if (!iterations.has(iteration)) {
      throw new Error(`missing probe iteration ${iteration}/${expectedCount}`);
    }
  }
  if (shas.size !== 1) throw new Error("probe result artifacts disagree on exact SHA");
  if (targets.size !== 1) throw new Error("probe result artifacts disagree on target");
  if (scopes.size !== 1) throw new Error("probe result artifacts disagree on scope");
  if (runNumbers.size > 1) throw new Error("probe result artifacts disagree on workflow run_number");
  if (runAttempts.size > 1) throw new Error("probe result artifacts disagree on workflow run_attempt");

  const changedFiles = new Set(
    existsSync(changedFilesPath)
      ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
      : [],
  );
  const failuresByFile = new Map();
  const unparsedIterations = [];
  for (const resultPath of walkFiles(diagnosticsRoot, "result.txt")) {
    const result = parseResult(resultPath);
    const iteration = probeIteration(result, resultPath, diagnosticsRoot);
    if (!failedIterations.includes(iteration)) continue;
    const diagnosticDirectory = dirname(resultPath);
    const outputPath = join(diagnosticDirectory, "probe-output.log");
    const extracted = existsSync(outputPath)
      ? extractFailures(readFileSync(outputPath, "utf8"))
      : [];
    if (extracted.length === 0) {
      unparsedIterations.push({ iteration, artifact: basename(diagnosticDirectory) });
      continue;
    }
    for (const failure of extracted) {
      let tests = failuresByFile.get(failure.file);
      if (!tests) failuresByFile.set(failure.file, (tests = new Map()));
      let failureIterations = tests.get(failure.title);
      if (!failureIterations) tests.set(failure.title, (failureIterations = new Set()));
      failureIterations.add(iteration);
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
  const sha = [...shas][0];
  const target = [...targets][0];
  const scope = [...scopes][0];
  const runNumber = [...runNumbers][0];
  const runAttempt = [...runAttempts][0];
  const failedList = failedIterations.length === 0
    ? "none"
    : failedIterations.sort((a, b) => a - b).join(", ");

  console.log("## Plasmon flake probe");
  console.log();
  console.log(`- Exact SHA: ${markdownCode(sha)}`);
  console.log(`- Target: ${markdownCode(target)}`);
  console.log(`- Scope: ${markdownCode(scope)}`);
  console.log(`- Configured probe iterations: ${expectedCount}`);
  if (runNumber) console.log(`- Workflow \`run_number\`: ${markdownCode(runNumber)}`);
  if (runAttempt) console.log(`- Workflow \`run_attempt\`: ${markdownCode(runAttempt)}`);
  console.log(`- Fresh probe iterations reported: ${results.length}/${expectedCount}`);
  console.log(`- Iteration-1 passes: ${passed}/${expectedCount}`);
  console.log(`- Failed probe iterations: ${failedList}`);
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
    for (const { iteration, artifact } of unparsedIterations.sort((a, b) => a.iteration - b.iteration)) {
      console.log(
        `- Probe iteration ${iteration}: inspect diagnostic artifact ${markdownCode(artifact)} and ${markdownCode("probe-output.log")}.`,
      );
    }
    console.log();
  }

  if (passed === expectedCount) {
    console.log(`**STABILITY OBSERVED: ${expectedCount}/${expectedCount} fresh probe iterations passed.**`);
  } else {
    console.log(
      `**FLAKE/FAILURE OBSERVED: only ${passed}/${expectedCount} fresh probe iterations passed (${results.length}/${expectedCount} reported).**`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.log("## Plasmon flake probe");
  console.log();
  console.log(`**SUMMARY INTEGRITY FAILURE:** ${String(error?.message ?? error)}`);
  process.exitCode = 1;
}
