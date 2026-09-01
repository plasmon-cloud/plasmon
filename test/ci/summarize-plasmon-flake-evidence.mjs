import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { summarizeFlakeProbe } from "./summarize-flake-probe.mjs";

function firstResultFile(root) {
  if (!existsSync(root)) return null;
  const visit = (directory) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        const nested = visit(path);
        if (nested) return nested;
      } else if (entry === "result.txt") {
        return path;
      }
    }
    return null;
  };
  return visit(root);
}

function assertSummarizableEvidenceShape(resultsRoot) {
  const path = firstResultFile(resultsRoot);
  if (!path) return;
  const result = Object.fromEntries(
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
  const mode = result.mode || "baseline";
  const count = result.iteration_count ? Number(result.iteration_count) : 10;
  const valid =
    (mode === "merge-validation" && count === 1) ||
    (mode === "baseline" && (count === 3 || count === 10)) ||
    (mode === "characterization" && (count === 3 || count === 50)) ||
    (mode === "manual" && (count === 10 || count === 50));
  if (!valid) {
    throw new Error(`unsupported Flake Probe mode/count combination: ${mode}/${count}`);
  }
}

const args = process.argv.slice(2);
assertSummarizableEvidenceShape(args[0]);
process.exitCode = await summarizeFlakeProbe(args, process.env);
