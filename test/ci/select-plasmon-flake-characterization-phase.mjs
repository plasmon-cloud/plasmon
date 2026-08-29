import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { selectCharacterization } from "./select-plasmon-flake-characterization.mjs";

function parsePositiveCount(value) {
  const count = Number(value);
  if (![10, 50].includes(count)) {
    throw new Error(`automatic characterization iterations must be 10 or 50; saw ${value}`);
  }
  return count;
}

function selectionHashScope(files, count, profile) {
  const suffix = files.join("|").replace(/[^A-Za-z0-9._-]+/g, "-").slice(-48) || "none";
  return {
    scope: `characterization:${profile}:${count}:${files.length}-files:${suffix}`,
    scope_key: `char-${profile}-${count}-${files.length}-${suffix}`.slice(0, 80),
  };
}

export async function selectPhaseCharacterization({ changedFiles, iterations }) {
  const iteration_count = parsePositiveCount(iterations);
  const base = await selectCharacterization({ changedFiles });

  if (base.applicable) {
    const files = [...base.files].sort();
    const { scope, scope_key } = selectionHashScope(files, iteration_count, "local");
    return {
      ...base,
      iteration_count,
      profile: "local",
      scope,
      scope_key,
    };
  }

  if (
    base.reason === "only-profile-specific-playwright-changes" &&
    Array.isArray(base.deferred_profile_tests) &&
    base.deferred_profile_tests.length > 0
  ) {
    const files = [...base.deferred_profile_tests].sort();
    const { scope, scope_key } = selectionHashScope(files, iteration_count, "demo");
    return {
      ...base,
      applicable: true,
      reason: "profile-specific-playwright-changes",
      target: "exact-set",
      iteration_count,
      profile: "demo",
      files,
      files_json: JSON.stringify(files),
      scope,
      scope_key,
    };
  }

  return {
    ...base,
    iteration_count,
    profile: "none",
  };
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const changedFilesPath = args.find((arg) => !arg.startsWith("--")) ?? null;
  const iterations = optionValue(args, "--iterations");
  const githubOutputPath = optionValue(args, "--github-output");
  const jsonFilePath = optionValue(args, "--json-file");
  if (!changedFilesPath || !iterations) {
    throw new Error("Usage: select-plasmon-flake-characterization-phase.mjs <changed-files.txt> --iterations <10|50> [--github-output <path>] [--json-file <path>]");
  }
  const changedFiles = existsSync(changedFilesPath)
    ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
    : [];
  const selection = await selectPhaseCharacterization({ changedFiles, iterations });
  const json = `${JSON.stringify(selection)}\n`;
  process.stdout.write(json);
  if (jsonFilePath) writeFileSync(jsonFilePath, json);
  if (githubOutputPath) {
    for (const key of [
      "applicable",
      "reason",
      "target",
      "iteration_count",
      "profile",
      "files_json",
      "scope",
      "scope_key",
    ]) {
      appendFileSync(githubOutputPath, `${key}=${selection[key]}\n`);
    }
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
