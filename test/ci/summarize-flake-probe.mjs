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
  if (!existsSync(root)) {
    return [];
  }

  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        visit(path);
      } else if (!wantedName || entry === wantedName) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files.sort();
}

function parseResult(path) {
  const fields = Object.fromEntries(
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
  return fields;
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function cleanTitle(value) {
  return stripAnsi(value)
    .replace(/\s+\(\d+(?:\.\d+)?(?:ms|s)\)\s*$/, "")
    .replace(/\s+\[[\d.]+(?:ms|s)\]\s*$/, "")
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

    const playwright = line.match(
      /((?:apps\/plasmon\/|test\/)[^\s:]+\.(?:test|spec)\.[A-Za-z0-9]+):\d+:\d+\s+›\s+(.+)$/,
    );
    if (playwright) {
      found.push({ file: playwright[1], title: cleanTitle(playwright[2]) });
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
    if (!failure.file || !failure.title) {
      continue;
    }
    unique.set(`${failure.file}\0${failure.title}`, failure);
  }
  return [...unique.values()];
}

function markdownCode(value) {
  return `\`${String(value).replaceAll("`", "'")}\``;
}

function attemptsText(attempts) {
  return [...attempts].sort((a, b) => a - b).join(", ");
}

try {
  const resultFiles = walkFiles(resultsRoot, "result.txt");
  const results = resultFiles.map((path) => ({ path, ...parseResult(path) }));
  const attempts = new Set();
  const shas = new Set();
  const targets = new Set();
  const failedAttempts = [];
  let passed = 0;

  for (const result of results) {
    if (!/^(?:[1-9]|10)$/.test(result.attempt ?? "")) {
      throw new Error(
        `invalid or missing probe attempt identity in ${relative(resultsRoot, result.path)}: ${result.attempt ?? ""}`,
      );
    }
    if (!result.sha || result.sha === "unknown") {
      throw new Error(`missing exact SHA in ${relative(resultsRoot, result.path)}`);
    }
    if (!result.target || result.target === "unknown") {
      throw new Error(`missing target in ${relative(resultsRoot, result.path)}`);
    }

    const attempt = Number(result.attempt);
    attempts.add(attempt);
    shas.add(result.sha);
    targets.add(result.target);
    if (result.outcome === "success") {
      passed += 1;
    } else {
      failedAttempts.push(attempt);
    }
  }

  if (results.length !== 10 || attempts.size !== 10) {
    throw new Error(
      `expected ten unique fresh attempt results; saw ${results.length} files and ${attempts.size} unique attempts`,
    );
  }
  if (shas.size !== 1) {
    throw new Error("probe result artifacts disagree on exact SHA");
  }
  if (targets.size !== 1) {
    throw new Error("probe result artifacts disagree on target");
  }

  const changedFiles = new Set(
    existsSync(changedFilesPath)
      ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
      : [],
  );

  const failuresByFile = new Map();
  const unparsedAttempts = [];
  for (const resultPath of walkFiles(diagnosticsRoot, "result.txt")) {
    const result = parseResult(resultPath);
    const attempt = Number(result.attempt);
    if (!failedAttempts.includes(attempt)) {
      continue;
    }

    const diagnosticDirectory = dirname(resultPath);
    const outputPath = join(diagnosticDirectory, "probe-output.log");
    const extracted = existsSync(outputPath)
      ? extractFailures(readFileSync(outputPath, "utf8"))
      : [];

    if (extracted.length === 0) {
      unparsedAttempts.push({
        attempt,
        artifact: basename(diagnosticDirectory),
      });
      continue;
    }

    for (const failure of extracted) {
      let tests = failuresByFile.get(failure.file);
      if (!tests) {
        tests = new Map();
        failuresByFile.set(failure.file, tests);
      }
      let failureAttempts = tests.get(failure.title);
      if (!failureAttempts) {
        failureAttempts = new Set();
        tests.set(failure.title, failureAttempts);
      }
      failureAttempts.add(attempt);
    }
  }

  const failureOccurrences = [...failuresByFile.values()].reduce(
    (fileTotal, tests) =>
      fileTotal +
      [...tests.values()].reduce(
        (testTotal, failureAttempts) => testTotal + failureAttempts.size,
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
  const failedList =
    failedAttempts.length === 0
      ? "none"
      : failedAttempts.sort((a, b) => a - b).join(", ");

  console.log("## Plasmon flake probe");
  console.log();
  console.log(`- Exact SHA: ${markdownCode(sha)}`);
  console.log(`- Target: ${markdownCode(target)}`);
  console.log(`- Fresh attempts reported: ${results.length}/10`);
  console.log(`- First-attempt passes: ${passed}/10`);
  console.log(`- Failed attempts: ${failedList}`);
  console.log(`- Failure occurrences parsed: ${failureOccurrences}`);
  console.log(`- Unique failing tests parsed: ${uniqueFailingTests}`);

  if (failuresByFile.size > 0) {
    console.log();
    console.log("### Failure summary");
    console.log();

    for (const [file, tests] of [...failuresByFile.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const fileOccurrences = [...tests.values()].reduce(
        (total, failureAttempts) => total + failureAttempts.size,
        0,
      );
      const relation =
        process.env.GITHUB_EVENT_NAME === "pull_request"
          ? changedFiles.has(file)
            ? "MODIFIED IN PR"
            : "UNCHANGED IN PR"
          : "PR RELATION N/A";

      console.log(
        `**(${fileOccurrences} failure occurrence(s)) ${markdownCode(file)} — ${relation}**`,
      );
      const sortedTests = [...tests.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      );
      sortedTests.forEach(([title, failureAttempts], index) => {
        const branch = index === sortedTests.length - 1 ? "└─" : "├─";
        console.log(
          `  ${branch} ${markdownCode(title)} — ${failureAttempts.size} occurrence(s), attempt(s) ${attemptsText(failureAttempts)}`,
        );
      });
      console.log();
    }
  }

  if (unparsedAttempts.length > 0) {
    console.log("### Failed attempts without a parsed test identity");
    console.log();
    for (const { attempt, artifact } of unparsedAttempts.sort(
      (a, b) => a.attempt - b.attempt,
    )) {
      console.log(
        `- Attempt ${attempt}: inspect diagnostic artifact ${markdownCode(artifact)} and ${markdownCode("probe-output.log")}.`,
      );
    }
    console.log();
  }

  if (passed === 10) {
    console.log("**STABILITY OBSERVED: 10/10 fresh attempts passed.**");
  } else {
    console.log(
      `**FLAKE/FAILURE OBSERVED: only ${passed}/10 fresh attempts passed (${results.length}/10 reported).**`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.log("## Plasmon flake probe");
  console.log();
  console.log(
    `**SUMMARY INTEGRITY FAILURE:** ${String(error?.message ?? error)}`,
  );
  process.exitCode = 1;
}
