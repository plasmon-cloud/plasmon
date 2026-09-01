import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function positiveInteger(value, label, path, root, { required = true } = {}) {
  if (!value) {
    if (!required) return null;
    throw new Error(`missing ${label} in ${relative(root, path)}`);
  }
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`invalid ${label} in ${relative(root, path)}: ${value}`);
  }
  return Number(value);
}

function normalizeResult(path, root) {
  const result = parseResult(path);
  if (result.iteration && result.attempt && result.iteration !== result.attempt) {
    throw new Error(
      `conflicting probe iteration identities in ${relative(root, path)}: iteration=${result.iteration}, legacy attempt=${result.attempt}`,
    );
  }
  const iteration = positiveInteger(result.iteration ?? result.attempt, "probe iteration", path, root);
  const historicalTenIteration = !result.iteration_count;
  const iterationCount = historicalTenIteration
    ? 10
    : positiveInteger(result.iteration_count, "iteration_count", path, root);
  const mode = result.mode || "baseline";
  if (!/^(?:merge-validation|baseline|characterization|manual)$/.test(mode)) {
    throw new Error(`invalid probe mode in ${relative(root, path)}: ${mode}`);
  }
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
  const runNumber = positiveInteger(result.run_number, "workflow run_number", path, root, {
    required: !historicalTenIteration,
  });
  const runAttempt = positiveInteger(result.run_attempt, "workflow run_attempt", path, root, {
    required: !historicalTenIteration,
  });
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
  if (file.startsWith("test/") || file.startsWith("src/")) return `apps/plasmon/${file}`;
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
      /^\s*[✘×]\s+\d+\s+\[[^\]]+\]\s+›\s+((?:apps\/plasmon\/|test\/)[^\s:]+\.(?:test|spec)\.[A-Za-z0-9]+):(\d+):(\d+)\s+›\s+(.+)$/u,
    );
    if (playwrightRunFailure) {
      found.push({
        file: playwrightRunFailure[1],
        line: Number(playwrightRunFailure[2]),
        column: Number(playwrightRunFailure[3]),
        title: cleanTitle(playwrightRunFailure[4]),
      });
      continue;
    }
    const playwrightDetailFailure = line.match(
      /^\s*\d+\)\s+\[[^\]]+\]\s+›\s+((?:apps\/plasmon\/|test\/)[^\s:]+\.(?:test|spec)\.[A-Za-z0-9]+):(\d+):(\d+)\s+›\s+(.+)$/,
    );
    if (playwrightDetailFailure) {
      found.push({
        file: playwrightDetailFailure[1],
        line: Number(playwrightDetailFailure[2]),
        column: Number(playwrightDetailFailure[3]),
        title: cleanTitle(playwrightDetailFailure[4]),
      });
      continue;
    }
    const vitest = line.match(
      /^\s*FAIL\s+((?:apps\/plasmon\/|test\/)[^\s]+\.(?:test|spec)\.[A-Za-z0-9]+)\s*>\s*(.+)$/,
    );
    if (vitest) {
      found.push({ file: vitest[1], line: null, column: null, title: cleanTitle(vitest[2]) });
      continue;
    }
    const bun = line.match(/^\s*\(fail\)\s+(.+)$/);
    if (bun && currentFile) {
      found.push({ file: currentFile, line: null, column: null, title: cleanTitle(bun[1]) });
      continue;
    }
    const symbolFailure = line.match(/^\s*[✗×]\s+(.+)$/u);
    if (symbolFailure && currentFile) {
      found.push({ file: currentFile, line: null, column: null, title: cleanTitle(symbolFailure[1]) });
    }
  }
  const unique = new Map();
  for (const failure of found) {
    if (!failure.file || !failure.title) continue;
    unique.set(`${failure.file}\0${failure.line ?? ""}\0${failure.column ?? ""}\0${failure.title}`, failure);
  }
  return [...unique.values()];
}

function markdownCode(value) {
  return `\`${String(value).replaceAll("`", "'")}\``;
}

function iterationsText(iterations) {
  return [...iterations].sort((a, b) => a - b).join(", ");
}

function summaryHeading(mode, count) {
  if (mode === "merge-validation") return "## Plasmon approval-stage flake validation";
  if (mode === "characterization") return `## Plasmon ${count}-iteration characterization probe`;
  if (mode === "manual") return "## Plasmon manual flake probe";
  return `## Plasmon ${count}-iteration baseline flake probe`;
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

// run_attempt provenance is retained per selected probe iteration so partial reruns
// reconcile without erasing same-SHA history.
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

function readEventContext(env) {
  const eventName = env.GITHUB_EVENT_NAME || "";
  const isPullRequest = eventName === "pull_request" || eventName === "pull_request_review";
  let payload = null;
  if (env.GITHUB_EVENT_PATH && existsSync(env.GITHUB_EVENT_PATH)) {
    try {
      payload = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    } catch {
      payload = null;
    }
  }
  return {
    eventName,
    isPullRequest,
    baseSha: payload?.pull_request?.base?.sha || env.PLASMON_PR_BASE_SHA || null,
    headSha: payload?.pull_request?.head?.sha || env.PLASMON_PR_HEAD_SHA || null,
  };
}

function changedHeadLineRanges(baseSha, headSha, file) {
  if (!baseSha || !headSha) return [];
  const diff = spawnSync(
    "git",
    ["diff", "--unified=0", "--no-ext-diff", baseSha, headSha, "--", file],
    { encoding: "utf8" },
  );
  if (diff.status !== 0) return [];
  const ranges = [];
  for (const line of (diff.stdout || "").split(/\r?\n/)) {
    const match = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (count > 0) ranges.push({ start, end: start + count - 1 });
  }
  return ranges;
}

function lineInRanges(line, ranges) {
  return Number.isInteger(line) && ranges.some((range) => line >= range.start && line <= range.end);
}

function referencedChangedFiles(output, changedFiles, failingFile) {
  return [...changedFiles]
    .filter((file) => file !== failingFile && file.length >= 4 && output.includes(file))
    .sort();
}

const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const importExtensionCandidates = [
  "", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs",
  "/index.ts", "/index.tsx", "/index.js", "/index.mjs",
];

function staticImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^"'\n]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function slash(path) {
  return path.replaceAll("\\", "/");
}

function resolveRelativeImport(importer, specifier, root) {
  if (!specifier.startsWith(".")) return null;
  const importerAbsolute = resolve(root, importer);
  const base = resolve(dirname(importerAbsolute), specifier);
  for (const suffix of importExtensionCandidates) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return slash(relative(root, candidate));
    }
  }
  return null;
}

function changedSupportDependency(testFile, changedFiles, root = process.cwd()) {
  if (!testFile.startsWith("test/e2e/") || !existsSync(resolve(root, testFile))) return null;
  const visited = new Set();
  const visit = (path) => {
    if (visited.has(path)) return null;
    visited.add(path);
    const absolute = resolve(root, path);
    if (!existsSync(absolute) || !sourceExtensions.has(extname(absolute))) return null;
    const source = readFileSync(absolute, "utf8");
    for (const specifier of staticImportSpecifiers(source)) {
      const dependency = resolveRelativeImport(path, specifier, root);
      if (!dependency) continue;
      if (changedFiles.has(dependency)) return dependency;
      const nested = visit(dependency);
      if (nested) return nested;
    }
    return null;
  };
  return visit(testFile);
}

function failureLocation(failure) {
  if (failure.line == null) return failure.file;
  return `${failure.file}:${failure.line}${failure.column == null ? "" : `:${failure.column}`}`;
}

function classifyFailure({ failure, output, changedFiles, eventContext, changedLineCache }) {
  const relation = eventContext.isPullRequest
    ? changedFiles.has(failure.file) ? "CHANGED IN PR" : "UNCHANGED IN PR"
    : "PR RELATION N/A";

  if (!eventContext.isPullRequest) {
    return { relation, relatedness: "UNKNOWN", evidence: [] };
  }

  if (changedFiles.has(failure.file) && failure.line != null) {
    let ranges = changedLineCache.get(failure.file);
    if (!ranges) {
      ranges = changedHeadLineRanges(eventContext.baseSha, eventContext.headSha, failure.file);
      changedLineCache.set(failure.file, ranges);
    }
    if (lineInRanges(failure.line, ranges)) {
      return {
        relation,
        relatedness: "DIRECT",
        evidence: [`the failing test location line ${failure.line} changed in this PR`],
      };
    }
  }

  if (changedFiles.has(failure.file)) {
    return {
      relation,
      relatedness: "STRONG",
      evidence: ["the failing test file changed in this PR"],
    };
  }

  const referenced = referencedChangedFiles(output, changedFiles, failure.file);
  if (referenced.length > 0) {
    return {
      relation,
      relatedness: "STRONG",
      evidence: [`failure output references changed file ${referenced[0]}`],
    };
  }

  const supportDependency = changedSupportDependency(failure.file, changedFiles);
  if (supportDependency) {
    return {
      relation,
      relatedness: "RELATED",
      evidence: [`the failing test statically depends on changed E2E support ${supportDependency}`],
    };
  }

  return {
    relation,
    relatedness: "UNKNOWN",
    evidence: ["no deterministic relationship to the PR was established; UNKNOWN does not mean unrelated or flaky"],
  };
}

function diagnosticOutputByFailureKey(resultsRoot, diagnosticsRoot, selectedFailureKeys) {
  const outputs = new Map();
  for (const root of [diagnosticsRoot, resultsRoot]) {
    for (const resultPath of walkFiles(root, "result.txt")) {
      let result;
      try {
        result = normalizeResult(resultPath, root);
      } catch {
        continue;
      }
      const key = `${result.iteration}:${result.runAttempt}`;
      if (!selectedFailureKeys.has(key) || outputs.has(key)) continue;
      const outputPath = join(dirname(resultPath), "probe-output.log");
      if (existsSync(outputPath)) outputs.set(key, readFileSync(outputPath, "utf8"));
    }
  }
  return outputs;
}

export async function summarizeFlakeProbe(args = process.argv.slice(2), env = process.env) {
  const [resultsRoot, diagnosticsRoot, changedFilesPath] = args;
  const jsonFileIndex = args.indexOf("--json-file");
  const jsonFilePath = jsonFileIndex === -1 ? null : args[jsonFileIndex + 1] ?? null;
  if (!resultsRoot || !diagnosticsRoot || !changedFilesPath || (jsonFileIndex !== -1 && !jsonFilePath)) {
    console.error(
      "usage: node test/ci/summarize-flake-probe.mjs <results-root> <diagnostics-root> <changed-files> [--json-file <path>]",
    );
    return 2;
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

    const expectedCount = requireSingle(new Set(candidates.map((result) => result.iterationCount)), "iteration_count");
    const mode = requireSingle(new Set(candidates.map((result) => result.mode)), "probe mode");
    const sha = requireSingle(new Set(candidates.map((result) => result.sha)), "exact SHA");
    const target = requireSingle(new Set(candidates.map((result) => result.target)), "target");
    const scope = requireSingle(new Set(candidates.map((result) => result.scope)), "scope");
    const runNumbers = new Set(candidates.map((result) => result.runNumber).filter((value) => value !== null));
    if (runNumbers.size > 1) throw new Error("probe result artifacts disagree on workflow run_number");
    const runNumber = [...runNumbers][0] ?? null;

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
    const failedIterations = failedResults.map((result) => result.iteration).sort((a, b) => a - b);
    const passed = selected.length - failedResults.length;
    const selectedFailureKeys = new Set(failedResults.map((result) => `${result.iteration}:${result.runAttempt}`));
    const provenance = attemptProvenance(selected);
    const supersededFailures = superseded.filter((result) => result.outcome !== "success");
    const legacyResults = selected.filter((result) => result.isLegacyAttempt).length;
    const changedFiles = new Set(
      existsSync(changedFilesPath)
        ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
        : [],
    );
    const eventContext = readEventContext(env);
    const changedLineCache = new Map();
    const diagnosticOutputs = diagnosticOutputByFailureKey(resultsRoot, diagnosticsRoot, selectedFailureKeys);
    const failures = new Map();
    const unparsedIterations = [];

    for (const result of failedResults) {
      const key = `${result.iteration}:${result.runAttempt}`;
      const output = diagnosticOutputs.get(key) || "";
      const extracted = output ? extractFailures(output) : [];
      if (extracted.length === 0) {
        unparsedIterations.push({
          iteration: result.iteration,
          runAttempt: result.runAttempt,
          artifact: basename(dirname(result.path)),
        });
        continue;
      }
      for (const failure of extracted) {
        const failureKey = `${failure.file}\0${failure.line ?? ""}\0${failure.column ?? ""}\0${failure.title}`;
        let aggregate = failures.get(failureKey);
        if (!aggregate) {
          const classification = classifyFailure({
            failure,
            output,
            changedFiles,
            eventContext,
            changedLineCache,
          });
          aggregate = {
            ...failure,
            ...classification,
            iterations: new Set(),
          };
          failures.set(failureKey, aggregate);
        }
        aggregate.iterations.add(result.iteration);
      }
    }

    const orderedFailures = [...failures.values()].sort((a, b) =>
      failureLocation(a).localeCompare(failureLocation(b)) || a.title.localeCompare(b.title),
    );
    const failureOccurrences = orderedFailures.reduce((total, failure) => total + failure.iterations.size, 0);

    console.log(summaryHeading(mode, expectedCount));
    console.log();
    if (failedResults.length > 0) {
      console.log("**FLAKE/FAILURE OBSERVED**");
      console.log();
      console.log("### Failure summary");
      console.log();
      for (const failure of orderedFailures) {
        console.log(`- **${failure.relation}** ${markdownCode(failureLocation(failure))}`);
        console.log(`  - Test: ${markdownCode(failure.title)}`);
        console.log(`  - Relatedness: **${failure.relatedness}**`);
        console.log(
          `  - Occurrences: ${failure.iterations.size}; probe iteration(s): ${iterationsText(failure.iterations)}`,
        );
        for (const evidence of failure.evidence) console.log(`  - Evidence: ${evidence}`);
      }
      if (orderedFailures.length === 0) {
        console.log("- No failing test identity could be parsed from the retained probe output.");
      }
      console.log();
    }

    if (unparsedIterations.length > 0) {
      console.log("### Failed probe iterations without a parsed test identity");
      console.log();
      for (const { iteration, runAttempt, artifact } of unparsedIterations.sort((a, b) => a.iteration - b.iteration)) {
        console.log(
          `- Probe iteration ${iteration} from run_attempt ${runAttempt || "historical"}: inspect retained probe output for ${markdownCode(artifact)}.`,
        );
      }
      console.log();
    }

    console.log("### Probe metadata");
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
    console.log(`- Retry-free passes: ${passed}/${expectedCount}`);
    console.log(`- Failed probe iterations: ${failedIterations.length ? failedIterations.join(", ") : "none"}`);
    console.log(`- Superseded same-run attempt results retained: ${superseded.length}`);
    if (supersededFailures.length > 0) {
      console.log(`- Superseded same-SHA failures retained as provenance: ${supersededFailures.length}`);
    }
    if (legacyResults > 0) console.log(`- Legacy result files parsed: ${legacyResults}`);
    console.log(`- Failure occurrences parsed: ${failureOccurrences}`);
    console.log(`- Unique failing tests parsed: ${orderedFailures.length}`);

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
      failed_iterations: failedIterations,
      failures: orderedFailures.map((failure) => ({
        file: failure.file,
        line: failure.line,
        column: failure.column,
        title: failure.title,
        relation: failure.relation,
        relatedness: failure.relatedness,
        evidence: failure.evidence,
        occurrences: failure.iterations.size,
        iterations: [...failure.iterations].sort((a, b) => a - b),
      })),
      unparsed_iterations: unparsedIterations,
      status: passed === expectedCount ? "stable-observed" : "failure-observed",
    };

    if (jsonFilePath) {
      mkdirSync(dirname(jsonFilePath), { recursive: true });
      writeFileSync(
        jsonFilePath,
        `${JSON.stringify({ schema: "plasmon-flake-summary-v1", evidence_packets: [packet] }, null, 2)}\n`,
      );
    }

    console.log();
    if (passed === expectedCount) {
      console.log(
        `**STABILITY OBSERVED: ${expectedCount}/${expectedCount} fresh retry-free probe iterations passed. This is evidence, not proof that the target cannot flake.**`,
      );
      return 0;
    }
    console.log(
      `**FLAKE/FAILURE OBSERVED: only ${passed}/${expectedCount} fresh retry-free probe iterations passed (${selected.length}/${expectedCount} reported).**`,
    );
    return 1;
  } catch (error) {
    console.log("## Plasmon flake probe");
    console.log();
    console.log(`**SUMMARY INTEGRITY FAILURE:** ${String(error?.message ?? error)}`);
    return 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const status = await summarizeFlakeProbe();
  process.exitCode = status;
}
